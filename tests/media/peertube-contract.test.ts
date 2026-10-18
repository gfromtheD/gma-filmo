import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';

const fixtureRoot = 'tests/media/fixtures/peertube';

interface UploadxFixture {
  start: { method: string; path: string; status: number; location: string; body: null };
  firstChunk: { method: string; contentRange: string; body: string; status: number; range: string };
  queryOffset: { method: string; contentRange: string; contentLength: number; body: string; status: number; range: string };
  finalChunk: { method: string; contentRange: string; body: string; status: number; bodyJson: { video: { id: number; shortUUID: string; uuid: string } } };
  freshOffset: { method: string; contentRange: string; contentLength: number; body: string; status: number; range: string };
  cancelUpload: { method: string; status: number; body: string };
}

async function fixture<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(`${fixtureRoot}/${file}`, 'utf8')) as T;
}

interface HttpResult {
  status: number;
  headers: IncomingMessage['headers'];
  body: string;
}

function send(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(new URL(url), { method, headers }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      incoming.on('end', () => resolve({
        status: incoming.statusCode ?? 0,
        headers: incoming.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.on('error', reject);
    if (body !== undefined) outgoing.write(body);
    outgoing.end();
  });
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function respond(response: ServerResponse, status: number, body = '', headers: Record<string, string> = {}) {
  response.writeHead(status, headers);
  response.end(body);
}

test('PeerTube fixture hashes identify the exact sanitized API shapes', async () => {
  const manifest = await readFile(`${fixtureRoot}/sha256sums.txt`, 'utf8');
  const entries = manifest.trim().split('\n').map((line) => {
    const match = /^([a-f0-9]{64})  ([a-z0-9-]+\.json)$/.exec(line);
    assert.ok(match, `invalid fixture manifest line: ${line}`);
    return { digest: match[1]!, file: match[2]! };
  });
  assert.equal(entries.length, 6);

  for (const { digest, file } of entries) {
    const bytes = await readFile(`${fixtureRoot}/${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, file);
  }
});

test('PeerTube v8.3.1 contract shapes retain channel discovery, uploadx states and private playback', async (t) => {
  const [config, me, upload, videoStates, privateToken, deletion] = await Promise.all([
    fixture<{ response: { serverVersion: string; tracker: { enabled: boolean }; transcoding: { hls: { enabled: boolean } } } }>('config.json'),
    fixture<{ response: { id: number; videoChannels: Array<{ id: number; name: string }> } }>('me.json'),
    fixture<UploadxFixture>('uploadx.json'),
    fixture<{ video: { uuid: string; state: { id: number }; streamingPlaylists: Array<{ playlistUrl: string }> }; stateIds: number[]; unknownStateId: number }>('video-states.json'),
    fixture<{ response: { files: { token: string; expires: string } } }>('private-file-token.json'),
    fixture<{ deleteUploadLocation: { status: number; body: string }; deleteFinalizedVideo: { status: number; body: string }; videoAlreadyAbsent: { status: number } }>('delete.json'),
  ]);

  assert.equal(config.response.serverVersion, '8.3.1');
  assert.equal(config.response.tracker.enabled, false);
  assert.equal(config.response.transcoding.hls.enabled, true);
  assert.ok(Array.isArray(me.response.videoChannels));
  assert.equal(me.response.videoChannels[0]?.id, 73);
  assert.equal(upload.start.status, 201);
  assert.equal(upload.firstChunk.status, 308);
  assert.equal(upload.finalChunk.status, 200);
  assert.deepEqual(videoStates.stateIds, Array.from({ length: 12 }, (_, index) => index + 1));
  assert.ok(!videoStates.stateIds.includes(videoStates.unknownStateId));
  assert.equal(videoStates.video.streamingPlaylists.length, 1);
  assert.equal(privateToken.response.files.token, 'TEST_ONLY_REDACTED_FILE_TOKEN');
  assert.equal(deletion.deleteFinalizedVideo.status, 204);
  assert.equal(deletion.videoAlreadyAbsent.status, 404);

  let uploadOffset = 0;
  const videoUuid = videoStates.video.uuid;
  const server = createServer((request, response) => {
    void (async () => {
      const body = await readBody(request);
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

      if (request.method === 'GET' && path === '/api/v1/config') {
        respond(response, 200, JSON.stringify(config.response), { 'Content-Type': 'application/json' });
      } else if (request.method === 'GET' && path === '/api/v1/users/me') {
        respond(response, 200, JSON.stringify(me.response), { 'Content-Type': 'application/json' });
      } else if (request.method === 'POST' && path === upload.start.path) {
        respond(response, 201, '', { Location: `${origin}${upload.start.location}` });
      } else if (path === '/api/v1/videos/upload-resumable' && request.method === 'PUT') {
        const range = request.headers['content-range'];
        if (range === upload.queryOffset.contentRange) {
          if (body !== '' || request.headers['content-length'] !== '0') {
            respond(response, 400);
            return;
          }
          respond(response, 308, '', { Range: `bytes=0-${uploadOffset - 1}` });
        } else if (range === upload.firstChunk.contentRange && body === upload.firstChunk.body) {
          uploadOffset = 8;
          respond(response, 308, '', { Range: `bytes=0-${uploadOffset - 1}` });
        } else if (range === upload.finalChunk.contentRange && body === upload.finalChunk.body) {
          uploadOffset = 12;
          respond(response, 200, JSON.stringify({ video: { id: 1, shortUUID: 'dfhVxfm7eLqTNCRWz1gwj4', uuid: videoUuid } }), { 'Content-Type': 'application/json' });
        } else {
          respond(response, 409);
        }
      } else if (request.method === 'DELETE' && path === '/api/v1/videos/upload-resumable') {
        respond(response, deletion.deleteUploadLocation.status);
      } else if (request.method === 'GET' && path === `/api/v1/videos/${videoUuid}`) {
        respond(response, 200, JSON.stringify(videoStates.video), { 'Content-Type': 'application/json' });
      } else if (request.method === 'POST' && path === `/api/v1/videos/${videoUuid}/token`) {
        respond(response, 200, JSON.stringify(privateToken.response), { 'Content-Type': 'application/json' });
      } else if (request.method === 'DELETE' && /^\/api\/v1\/videos\/[0-9a-f-]+$/.test(path)) {
        respond(response, path === `/api/v1/videos/${videoUuid}` ? deletion.deleteFinalizedVideo.status : deletion.videoAlreadyAbsent.status);
      } else {
        respond(response, 404, JSON.stringify({ error: 'fixture-route-not-found' }), { 'Content-Type': 'application/json' });
      }
    })().catch(() => respond(response, 500));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;

  const configResponse = await send(`${origin}/api/v1/config`, 'GET');
  assert.equal(configResponse.status, 200);
  assert.equal(JSON.parse(configResponse.body).serverVersion, '8.3.1');

  const meResponse = await send(`${origin}/api/v1/users/me`, 'GET');
  assert.equal(meResponse.status, 200);
  assert.equal(JSON.parse(meResponse.body).videoChannels[0].id, 73);
  assert.equal((await send(`${origin}/api/v1/users/me/video-channels`, 'GET')).status, 404);

  const initResponse = await send(`${origin}${upload.start.path}`, 'POST', { 'Content-Type': 'application/json' }, '{"name":"gma-fixture"}');
  assert.equal(initResponse.status, 201);
  const uploadLocation = initResponse.headers.location;
  assert.equal(uploadLocation, `${origin}${upload.start.location}`);

  const firstChunk = await send(uploadLocation!, 'PUT', {
    'Content-Type': 'application/octet-stream',
    'Content-Range': upload.firstChunk.contentRange,
    'Content-Length': String(upload.firstChunk.body.length),
  }, upload.firstChunk.body);
  assert.equal(firstChunk.status, 308);
  assert.equal(firstChunk.headers.range, 'bytes=0-7');

  const offsetQuery = await send(uploadLocation!, 'PUT', {
    'Content-Range': upload.queryOffset.contentRange,
    'Content-Length': '0',
  });
  assert.equal(offsetQuery.status, 308);
  assert.equal(offsetQuery.headers.range, 'bytes=0-7');

  const finalChunk = await send(uploadLocation!, 'PUT', {
    'Content-Type': 'application/octet-stream',
    'Content-Range': upload.finalChunk.contentRange,
    'Content-Length': String(upload.finalChunk.body.length),
  }, upload.finalChunk.body);
  assert.equal(finalChunk.status, 200);
  assert.equal(JSON.parse(finalChunk.body).video.uuid, videoUuid);

  const details = await send(`${origin}/api/v1/videos/${videoUuid}`, 'GET');
  assert.equal(details.status, 200);
  assert.equal(JSON.parse(details.body).state.id, 1);
  const fileToken = await send(`${origin}/api/v1/videos/${videoUuid}/token`, 'POST', { 'Content-Type': 'application/json' }, '{}');
  assert.equal(JSON.parse(fileToken.body).files.token, 'TEST_ONLY_REDACTED_FILE_TOKEN');
  assert.equal((await send(`${origin}${upload.start.location}`, 'DELETE')).status, 204);
  assert.equal((await send(`${origin}/api/v1/videos/${videoUuid}`, 'DELETE')).status, 204);
  assert.equal((await send(`${origin}/api/v1/videos/77777777-7777-4777-8777-777777777777`, 'DELETE')).status, 404);
});
