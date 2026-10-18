import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { UploadReceipt } from '../../types/media-engine';
import { Ed25519MediaCapabilityIssuer } from '../../lib/media/capabilities';
import { createMediaGateway } from '../../lib/media/gateway/server';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { PeerTubeClient } from '../../lib/media/providers/peertube-client';
import { PeerTubeMediaProvider } from '../../lib/media/providers/peertube';
import { MediaService } from '../../lib/media/service';
import { MediaProviderRegistry } from '../../lib/media/registry';
import { database, OWNER } from './database';
import { serviceRepository } from './service-fixture';

const videoUUID = '66666666-6666-4666-8666-666666666666';
interface VideoListing { uuid: string; name: string; channel: { id: number }; privacy: { id: number } }
async function bodyOf(request: IncomingMessage) {
  const parts: Buffer[] = [];
  for await (const part of request) parts.push(Buffer.from(part));
  return Buffer.concat(parts);
}
function reply(response: ServerResponse, status: number, value?: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(value === undefined ? '' : JSON.stringify(value));
}
async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function stop(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

/** Both HTTP listeners bind loopback; every checkpoint and fence is a real SQL RPC. */
async function peerTubeHarness() {
  const db = await database(); const repo = serviceRepository(db);
  const root = await mkdtemp(path.join(os.tmpdir(), 'gma-pt-gateway-'));
  const storage = new MockMediaStorage(root); const source = Buffer.from('abcdefghijkl');
  const calls = { post: 0, put: [] as string[], cancel: 0, deleted: [] as string[], pages: [] as number[] };
  let offset = 0; let final = false; let dropFinal = false; let videoExists = true; let correlation = ''; let responseUUID = videoUUID;
  let listings: VideoListing[] | null = null; let afterChunk: (() => Promise<void>) | null = null;
  const upstream = createServer((request, response) => { void (async () => {
    const body = await bodyOf(request); const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/api/v1/oauth-clients/local') reply(response, 200, { client_id: 'fixture', client_secret: 'local-only' });
    else if (url.pathname === '/api/v1/users/token') reply(response, 200, { access_token: 'local-only-oauth', expires_in: 3600 });
    else if (url.pathname === '/api/v1/videos/upload-resumable' && request.method === 'POST') {
      calls.post++; const metadata = JSON.parse(body.toString()) as { name: string; channelId: number; privacy: number };
      assert.equal(metadata.channelId, 73); assert.equal(metadata.privacy, 3); assert.equal(metadata.name, correlation);
      reply(response, 201, undefined, { Location: `${upstreamOrigin}/api/v1/videos/upload-resumable?upload_id=lease-1` });
    } else if (url.pathname === '/api/v1/videos/upload-resumable' && request.method === 'PUT') {
      assert.equal(request.headers.authorization, 'Bearer local-only-oauth');
      const range = String(request.headers['content-range']);
      if (range === 'bytes */12') {
        assert.equal(body.length, 0);
        if (final) reply(response, 404);
        else reply(response, 308, undefined, { Range: `bytes=0-${offset - 1}` });
        return;
      }
      calls.put.push(range); const match = /^bytes (\d+)-(\d+)\/12$/.exec(range); assert.ok(match);
      assert.equal(Number(match[1]), offset); assert.equal(body.length, Number(match[2]) - Number(match[1]) + 1);
      offset = Number(match[2]) + 1;
      if (afterChunk) { const action = afterChunk; afterChunk = null; await action(); }
      if (offset === 12) {
        final = true;
        if (dropFinal) { dropFinal = false; response.destroy(); return; }
        reply(response, 200, { video: { id: 1, shortUUID: 'dfhVxfm7eLqTNCRWz1gwj4', uuid: videoUUID } });
      } else reply(response, 308, undefined, { Range: `bytes=0-${offset - 1}` });
    } else if (url.pathname === '/api/v1/users/me/videos' && request.method === 'GET') {
      const all = listings ?? [{ uuid: videoUUID, name: correlation, channel: { id: 73 }, privacy: { id: 3 } }];
      const start = Number(url.searchParams.get('start')); calls.pages.push(start);
      reply(response, 200, { total: all.length, data: all.slice(start, start + 100) });
    } else if (url.pathname === '/api/v1/videos/upload-resumable' && request.method === 'DELETE') {
      calls.cancel++; reply(response, 204);
    } else if (url.pathname === `/api/v1/videos/${videoUUID}` && request.method === 'GET') {
      if (!videoExists) reply(response, 404);
      else reply(response, 200, { uuid: responseUUID, duration: 12, state: { id: 2 }, streamingPlaylists: [] });
    } else if (url.pathname === `/api/v1/videos/${videoUUID}` && request.method === 'DELETE') {
      calls.deleted.push(videoUUID); videoExists = false; reply(response, 204);
    } else reply(response, 404);
  })().catch(() => reply(response, 500)); });
  const upstreamOrigin = await listen(upstream);
  const client = new PeerTubeClient({ baseUrl: upstreamOrigin, username: 'fixture', password: 'fixture', channelId: 73, timeoutMs: 1500 });
  await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
  const draft = await repo.uploadCommand(OWNER, 'create_draft', { purpose: 'title' }) as { id: string; revision: number };
  const reserved = await repo.reserve(OWNER, { draft_id: draft.id, revision: draft.revision, role: 'main', bytes: source.length,
    sha256: createHash('sha256').update(source).digest('hex'), content_type: 'video/mp4', file_name: 'fixture.mp4',
    idempotency_key: randomUUID(), request_hash: 'a'.repeat(64), video_provider: 'peertube', auxiliary_provider: 'mock' });
  const id = reserved.session.id; correlation = `gma-${reserved.session.asset_id}-a1`;
  const binding = await client.createResumableUpload({ name: correlation, description: correlation, channelId: 73, totalBytes: source.length, contentType: 'video/mp4', filename: 'gma-test.mp4' });
  await repo.command(OWNER, 'bind_upload', { session_id: id, transfer_generation: 1, upload_id: binding.uploadId,
    private_state: { uploadId: binding.uploadId, uploadLocation: binding.location, correlationName: correlation } });
  await db.query("UPDATE gma_upload_jobs SET state='done' WHERE session_id=$1 AND kind='provision'", [id]);
  const keys = generateKeyPairSync('ed25519'); const issuer = new Ed25519MediaCapabilityIssuer(keys.privateKey, 'test');
  const grant = issuer.issue({ sessionId: id, assetId: reserved.session.asset_id, generation: 1, scope: 'upload', method: 'PUT',
    namespace: `transfer/${id}/1/`, expectedBytes: source.length, ttlSeconds: 900 });
  const headers = { Authorization: `Bearer ${grant.token}` };
  let gateway = createMediaGateway({ repository: repo, storage, publicKeys: { test: keys.publicKey }, origins: [], peerTube: client });
  let origin = await listen(gateway);
  const service = new MediaService(repo);
  return { db, repo, storage, service, id, source, calls, client, issuer, get correlation() { return correlation; },
    async put(start: number, bytes: Buffer) { return fetch(`${origin}/transfer/${id}`, { method: 'PUT', headers: { ...headers, 'Content-Range': `bytes ${start}-${start + bytes.length - 1}/12` }, body: new Uint8Array(bytes) }); },
    async query() { return fetch(`${origin}/transfer/${id}`, { method: 'PUT', headers: { ...headers, 'Content-Range': 'bytes */12', 'Content-Length': '0' } }); },
    async restart() { await stop(gateway); gateway = createMediaGateway({ repository: repo, storage: new MockMediaStorage(root), publicKeys: { test: keys.publicKey }, origins: [], peerTube: client }); origin = await listen(gateway); },
    setDropFinal() { dropFinal = true; }, setListings(value: VideoListing[]) { listings = value; }, setVideoExists(value: boolean) { videoExists = value; }, setVideoIdentity(value: string) { responseUUID = value; },
    setAfterChunk(action: () => Promise<void>) { afterChunk = action; },
    async receipt() { return (await repo.privateState(id)).provisional_receipt as unknown as UploadReceipt; },
    async close() { await stop(gateway); await stop(upstream); await db.close(); await rm(root, { recursive: true, force: true }); },
  };
}

test('5.2 PeerTube HTTP resumes confirmed offset after gateway restart and persists one fenced SHA receipt', async () => {
  const h = await peerTubeHarness(); try {
    assert.equal((await h.query()).status, 308);
    assert.equal((await h.put(0, h.source.subarray(0, 8))).status, 308);
    assert.equal(await h.repo.confirmedOffset(h.id, 1), 8);
    await h.restart(); assert.equal((await h.query()).headers.get('range'), 'bytes=0-7');
    assert.equal((await h.put(8, h.source.subarray(8))).status, 200);
    const state = await h.repo.privateState(h.id);
    assert.equal(state.localOffset, 12); assert.equal(state.upstreamOffset, 12); assert.equal(state.finalization_pending, false);
    assert.equal(typeof state.finalizingAt, 'string'); assert.equal(state.local_offset, undefined);
    assert.equal((await h.receipt()).providerMediaId, videoUUID); assert.equal((await h.repo.session(h.id)).provider_ref, videoUUID);
    assert.equal((await h.query()).status, 200); assert.equal(h.calls.post, 1);
    assert.deepEqual(h.calls.put, ['bytes 0-7/12', 'bytes 8-11/12']);
    assert.ok((await h.repo.transferChunks(h.id, 1)).every(chunk => chunk.upstream_confirmed));
  } finally { await h.close(); }
});

test('5.2 lost final PeerTube response recovers retired Location by exact private channel correlation across pages, never another POST', async () => {
  const h = await peerTubeHarness(); try {
    assert.equal((await h.put(0, h.source.subarray(0, 8))).status, 308); h.setDropFinal();
    assert.equal((await h.put(8, h.source.subarray(8))).status, 503);
    assert.equal((await h.repo.privateState(h.id)).finalization_pending, true);
    assert.equal((await h.repo.privateState(h.id)).provisional_receipt, undefined);
    const decoys = Array.from({ length: 100 }, (_, index) => ({ uuid: randomUUID(), name: h.correlation,
      channel: { id: index % 2 ? 74 : 73 }, privacy: { id: index % 2 ? 3 : 1 } }));
    h.setListings([...decoys, { uuid: videoUUID, name: h.correlation, channel: { id: 73 }, privacy: { id: 3 } }]);
    await h.restart(); assert.equal((await h.query()).status, 200);
    assert.deepEqual(h.calls.pages, [0, 100]); assert.equal(h.calls.post, 1); assert.equal(h.calls.put.length, 2);
    const provider = new PeerTubeMediaProvider(h.client, 'http://127.0.0.1:4319', h.issuer, { get: () => h.receipt() });
    const context = await h.service.context(h.id);
    assert.equal((await provider.inspectUpload(context)).providerMediaId, videoUUID);
    assert.equal((await provider.getTransfer(context)).offset, 12);
    h.setVideoExists(false); await assert.rejects(provider.inspectUpload(context), /transferencia/i);
    h.setVideoExists(true); h.setVideoIdentity(randomUUID()); await assert.rejects(provider.inspectUpload(context));
    const invalid = new PeerTubeMediaProvider(h.client, 'http://127.0.0.1:4319', h.issuer, { get: async () => ({ ...(await h.receipt()), sourceSha256: 'f'.repeat(64) }) });
    await assert.rejects(invalid.inspectUpload(context));
  } finally { await h.close(); }
});

test('5.2 full source SHA is verified before the final PeerTube PUT and mismatched scratch is cancelled', async () => {
  const h = await peerTubeHarness(); try {
    assert.equal((await h.put(0, h.source.subarray(0, 8))).status, 308);
    assert.equal((await h.put(8, Buffer.from('xxxx'))).status, 400);
    assert.deepEqual(h.calls.put, ['bytes 0-7/12']); assert.equal(h.calls.cancel, 1);
    assert.equal((await h.repo.privateState(h.id)).provisional_receipt, undefined);
    assert.equal((await h.repo.privateState(h.id)).finalization_pending, undefined);
  } finally { await h.close(); }
});

test('5.2 late PeerTube writer cannot confirm bytes after fence takeover; the next writer reconciles upstream', async () => {
  const h = await peerTubeHarness(); try {
    h.setAfterChunk(async () => { await h.db.query("UPDATE gma_upload_sessions SET transfer_fence=transfer_fence+1,transfer_lease_owner=NULL,transfer_lease_until=NULL WHERE id=$1", [h.id]); });
    assert.equal((await h.put(0, h.source.subarray(0, 8))).status, 409);
    assert.equal(await h.repo.confirmedOffset(h.id, 1), 0);
    assert.equal((await h.repo.privateState(h.id)).upstreamOffset, 0);
    const result = await h.query(); assert.equal(result.status, 308); assert.equal(result.headers.get('range'), 'bytes=0-7');
    assert.equal(await h.repo.confirmedOffset(h.id, 1), 8); assert.equal(h.calls.put.length, 1); assert.equal(h.calls.post, 1);
  } finally { await h.close(); }
});

test('5.2 ambiguous finalization remains pending and cannot invent a UUID or duplicate upload', async () => {
  const h = await peerTubeHarness(); try {
    assert.equal((await h.put(0, h.source.subarray(0, 8))).status, 308); h.setDropFinal();
    assert.equal((await h.put(8, h.source.subarray(8))).status, 503);
    h.setListings([videoUUID, randomUUID()].map(uuid => ({ uuid, name: h.correlation, channel: { id: 73 }, privacy: { id: 3 } })));
    assert.equal((await h.query()).status, 503); assert.equal((await h.repo.privateState(h.id)).finalization_pending, true);
    assert.equal((await h.repo.privateState(h.id)).provisional_receipt, undefined); assert.equal(h.calls.post, 1);
    assert.equal((await h.repo.session(h.id)).provider_ref, null);
  } finally { await h.close(); }
});

test('5.2 a final receipt arriving after cancellation deletes its verified late UUID; missing SHA checkpoint keeps cleanup unconfirmed', async () => {
  const h = await peerTubeHarness(); try {
    assert.equal((await h.put(0, h.source)).status, 200); const receipt = await h.receipt();
    const context = await h.service.context(h.id); context.asset.provider_ref = null;
    context.privateState = { ...context.privateState, videoUUID: null, finalization_pending: true };
    let read = 0;
    const provider = new PeerTubeMediaProvider(h.client, 'http://127.0.0.1:4319', h.issuer, { get: async () => ++read === 1 ? null : receipt });
    assert.equal((await provider.deleteAsset(context)).absent, true); assert.equal(h.calls.cancel, 1); assert.deepEqual(h.calls.deleted, [videoUUID]);
    const unknown = new PeerTubeMediaProvider(h.client, 'http://127.0.0.1:4319', h.issuer, { get: async () => null });
    assert.equal((await unknown.deleteAsset({ ...context, privateState: { ...context.privateState, sourceSha256: null } })).absent, false);
  } finally { await h.close(); }
});


test('5.2 durable cancellation during the final upstream PUT recovers only for cleanup and releases quota after absence', async () => {
  const h = await peerTubeHarness(); try {
    assert.equal((await h.put(0, h.source.subarray(0, 8))).status, 308);
    h.setAfterChunk(async () => {
      const current = await h.repo.session(h.id);
      await h.repo.transferAction(OWNER, h.id, 'cancel', current.revision);
      assert.equal((await h.repo.session(h.id)).quota_released, false);
      const quota = await h.db.query<{ reserved_bytes: number }>("SELECT reserved_bytes FROM gma_upload_quota WHERE account_key='global'");
      assert.equal(Number(quota.rows[0]?.reserved_bytes), 12);
    });
    assert.equal((await h.put(8, h.source.subarray(8))).status, 409);
    const state = await h.repo.privateState(h.id); assert.equal(state.finalization_pending, true);
    assert.equal(state.localOffset, 12); assert.equal(state.sourceSha256, createHash('sha256').update(h.source).digest('hex'));
    assert.equal(typeof state.finalizingAt, 'string'); assert.equal(state.provisional_receipt, undefined);
    assert.equal((await h.repo.session(h.id)).provider_ref, null);
    const provider = new PeerTubeMediaProvider(h.client, 'http://127.0.0.1:4319', h.issuer, { get: async () => null });
    const registry = new MediaProviderRegistry({ peertube: () => provider,
      mock: () => { throw new Error('mock not expected'); }, r2: () => { throw new Error('R2 not expected'); }, stream: () => { throw new Error('Stream not expected'); } });
    const service = new MediaService(h.repo, registry); const context = await service.context(h.id);
    assert.equal(context.asset.state, 'deleting'); assert.equal(context.session.state, 'cancelling');
    assert.equal(await h.repo.cleanupAllowed(OWNER, h.id), true);
    await service.remove(context);
    const deleted = await h.repo.session(h.id); assert.equal(deleted.state, 'cancelled'); assert.equal(deleted.quota_released, true);
    assert.equal((await h.repo.asset(deleted.asset_id)).state, 'deleted'); assert.equal(h.calls.post, 1);
    assert.deepEqual(h.calls.deleted, [videoUUID]); assert.equal(h.calls.cancel, 1);
    const ledger = await h.db.query<{ events: number }>("SELECT count(*)::integer events FROM gma_upload_ledger WHERE session_id=$1 AND event='release'", [h.id]);
    assert.equal(ledger.rows[0]?.events, 3);
    await service.remove(await service.context(h.id));
    assert.equal((await h.db.query<{ events: number }>("SELECT count(*)::integer events FROM gma_upload_ledger WHERE session_id=$1 AND event='release'", [h.id])).rows[0]?.events, 3);
  } finally { await h.close(); }
});
