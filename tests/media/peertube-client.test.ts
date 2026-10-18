import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { PeerTubeClient } from '../../lib/media/providers/peertube-client';

async function bodyOf(request: IncomingMessage): Promise<string> { const parts: Buffer[] = []; for await (const part of request) parts.push(Buffer.from(part)); return Buffer.concat(parts).toString(); }
function reply(response: ServerResponse, status: number, body = '', headers: Record<string, string> = {}) { response.writeHead(status, headers); response.end(body); }

test('PeerTube client uses server OAuth singleflight and exact resumable wire contract without replaying uncertain POST', async (t) => {
  let tokenCalls = 0; let initCalls = 0; let mode: 'ok' | 'lost' = 'ok'; let origin = '';
  const server = createServer((request, response) => { void (async () => {
    const body = await bodyOf(request); const url = new URL(request.url ?? '/', origin);
    if (request.method === 'GET' && url.pathname === '/api/v1/oauth-clients/local') reply(response, 200, JSON.stringify({ client_id: 'fixture-client', client_secret: 'fixture-secret' }));
    else if (request.method === 'POST' && url.pathname === '/api/v1/users/token') { tokenCalls++; reply(response, 200, JSON.stringify({ access_token: 'server-token', refresh_token: 'refresh', expires_in: 3600 })); }
    else if (request.method === 'GET' && url.pathname === '/api/v1/config') reply(response, 200, JSON.stringify({ serverVersion: '8.3.1', tracker: { enabled: false }, transcoding: { hls: { enabled: true } } }));
    else if (request.method === 'GET' && url.pathname === '/api/v1/users/me') reply(response, 200, JSON.stringify({ id: 1, videoChannels: [{ id: 73, name: 'GMA' }] }));
    else if (request.method === 'POST' && url.pathname === '/api/v1/videos/upload-resumable') {
      initCalls++; assert.equal(request.headers.authorization, 'Bearer server-token'); assert.equal(request.headers['x-upload-content-length'], '12');
      assert.equal(request.headers['x-upload-content-type'], 'video/mp4'); assert.equal(JSON.parse(body).privacy, 3); assert.equal(JSON.parse(body).waitTranscoding, true); assert.equal(JSON.parse(body).filename, 'gma-test.mp4');
      if (mode === 'lost') { request.socket.destroy(); return; }
      reply(response, 201, '', { Location: `${origin}/api/v1/videos/upload-resumable?upload_id=lease-1` });
    } else if (request.method === 'PUT' && url.searchParams.has('upload_id')) {
      if (request.headers['content-range'] === 'bytes */12') { assert.equal(body, ''); assert.equal(request.headers['content-length'], '0'); reply(response, 308, '', { Range: 'bytes=0-7' }); }
      else if (request.headers['content-range'] === 'bytes 8-11/12') reply(response, 200, JSON.stringify({ video: { id: 1, shortUUID: 'dfhVxfm7eLqTNCRWz1gwj4', uuid: '66666666-6666-4666-8666-666666666666' } }));
      else reply(response, 308, '', { Range: 'bytes=0-7' });
    } else reply(response, 404);
  })().catch(() => reply(response, 500)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  const client = new PeerTubeClient({ baseUrl: origin, username: 'technical', password: 'secret', channelId: 73, timeoutMs: 500 });
  const [instance, upload] = await Promise.all([client.validateInstance(), client.createResumableUpload({ name: 'gma-media-a1', description: 'correlation:gma-media-a1', channelId: 73, totalBytes: 12, contentType: 'video/mp4', filename: 'gma-test.mp4' })]);
  assert.equal(instance.version, '8.3.1'); assert.equal(upload.uploadId, 'lease-1'); assert.equal(tokenCalls, 1);
  assert.deepEqual(await client.queryUploadOffset(upload.location, 12), { status: 308, range: 'bytes=0-7' });
  assert.deepEqual(await client.putUploadChunk(upload.location, 8, 11, 12, new TextEncoder().encode('abcd')), { status: 200, range: null, uuid: '66666666-6666-4666-8666-666666666666' });
  mode = 'lost';
  await assert.rejects(client.createResumableUpload({ name: 'gma-media-a2', description: 'correlation:gma-media-a2', channelId: 73, totalBytes: 12, contentType: 'video/mp4', filename: 'gma-test.mp4' }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'UPLOAD_PROVISION_RECOVERY_REQUIRED');
  assert.equal(initCalls, 2, 'the client must not retry a POST whose response was lost');
});

test('PeerTube client rejects foreign Location before any upload forwarding', async () => {
  const client = new PeerTubeClient({ baseUrl: 'https://peertube.example', username: 'u', password: 'p', channelId: 1, fetch: async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/oauth-clients/local') return new Response(JSON.stringify({ client_id: 'id', client_secret: 'secret' }), { status: 200 });
    if (url.pathname === '/api/v1/users/token') return new Response(JSON.stringify({ access_token: 'only-server', expires_in: 3600 }), { status: 200 });
    return new Response('', { status: 201, headers: { Location: 'https://attacker.example/api/v1/videos/upload-resumable?upload_id=x' } });
  } });
  await assert.rejects(client.createResumableUpload({ name: 'gma-x-a1', description: 'x', channelId: 1, totalBytes: 1, contentType: 'video/mp4', filename: 'gma-test.mp4' }));
});

test('PeerTube maps 404/429/503 safely and coalesces simultaneous OAuth refreshes', async () => {
  for (const [status, expectedCode] of [[404, 'UPLOAD_NOT_FOUND'], [429, 'MEDIA_PROVIDER_UNAVAILABLE'], [503, 'MEDIA_PROVIDER_UNAVAILABLE']] as const) {
    const client = new PeerTubeClient({ baseUrl: 'https://peertube.example', username: 'u', password: 'p', channelId: 1, fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/v1/oauth-clients/local') return new Response(JSON.stringify({ client_id: 'id', client_secret: 'secret' }), { status: 200 });
      if (url.pathname === '/api/v1/users/token') return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200 });
      return new Response('{}', { status });
    } });
    if (status === 404) assert.equal(await client.getVideo('66666666-6666-4666-8666-666666666666'), null);
    else await assert.rejects(client.getVideo('66666666-6666-4666-8666-666666666666'), (error: unknown) => error instanceof Error && 'code' in error && error.code === expectedCode);
  }

  let tokenCalls = 0; let oldTokenCalls = 0;
  const client = new PeerTubeClient({ baseUrl: 'https://peertube.example', username: 'u', password: 'p', channelId: 1, fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/oauth-clients/local') return new Response(JSON.stringify({ client_id: 'id', client_secret: 'secret' }), { status: 200 });
    if (url.pathname === '/api/v1/users/token') { tokenCalls++; return new Response(JSON.stringify({ access_token: tokenCalls === 1 ? 'old' : 'new', refresh_token: 'refresh', expires_in: 3600 }), { status: 200 }); }
    if (url.pathname === `/api/v1/videos/${'66666666-6666-4666-8666-666666666666'}` && init?.method === 'GET') {
      if (new Headers(init?.headers).get('Authorization') === 'Bearer old') { oldTokenCalls++; return new Response('{}', { status: 401 }); }
      return new Response(JSON.stringify({ uuid: '66666666-6666-4666-8666-666666666666', duration: 12, state: { id: 1 }, streamingPlaylists: [] }), { status: 200 });
    }
    if (url.pathname.endsWith('/token')) {
      if (new Headers(init?.headers).get('Authorization') === 'Bearer old') { oldTokenCalls++; return new Response('{}', { status: 401 }); }
      return new Response(JSON.stringify({ files: { token: 'private', expires: '2026-10-07T10:05:00.000Z' } }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  } });
  await Promise.all([client.getVideo('66666666-6666-4666-8666-666666666666'), client.getPrivateFileToken('66666666-6666-4666-8666-666666666666')]);
  assert.equal(oldTokenCalls, 2);
  assert.equal(tokenCalls, 2, 'one initial token plus one coalesced refresh');
});

test('putUploadChunk reads the final UUID from the real PeerTube body and from the legacy flat body, and rejects anything else', async () => {
  const uuid = '77777777-7777-4777-8777-777777777777';
  const bodies: unknown[] = [{ video: { id: 1, shortUUID: 'dfhVxfm7eLqTNCRWz1gwj4', uuid } }, { uuid }, { video: { id: 1 } }];
  let current: unknown = null;
  const client = new PeerTubeClient({ baseUrl: 'https://peertube.example', username: 'u', password: 'p', channelId: 1, fetch: async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/oauth-clients/local') return new Response(JSON.stringify({ client_id: 'id', client_secret: 'secret' }), { status: 200 });
    if (url.pathname === '/api/v1/users/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify(current), { status: 200 });
  } });
  const location = 'https://peertube.example/api/v1/videos/upload-resumable?upload_id=lease-1';
  for (const [index, body] of bodies.entries()) {
    current = body;
    const attempt = client.putUploadChunk(location, 0, 3, 4, new TextEncoder().encode('abcd'));
    if (index < 2) assert.equal((await attempt).uuid, uuid);
    else await assert.rejects(attempt, (error: unknown) => error instanceof Error && 'code' in error && error.code === 'MEDIA_PROVIDER_UNAVAILABLE');
  }
});
