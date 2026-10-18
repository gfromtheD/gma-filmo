import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProviderPlaybackContext, ProviderUploadContext } from '../../lib/media/provider';
import { PeerTubeClient } from '../../lib/media/providers/peertube-client';
import { PeerTubeMediaProvider } from '../../lib/media/providers/peertube';
import { mapPeerTubeState } from '../../lib/media/providers/peertube-mapping';

const owner = '11111111-1111-4111-8111-111111111111'; const draft = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333'; const mediaId = '44444444-4444-4444-8444-444444444444';
const videoUUID = '66666666-6666-4666-8666-666666666666';
function context(): ProviderUploadContext {
  const at = '2026-10-07T10:00:00.000Z';
  return { session: { id: sessionId, owner_id: owner, draft_id: draft, asset_id: mediaId, role: 'main', slot: 'main', language: null, provider: 'peertube',
    provider_ref: null, provider_data: {}, object_key: null, multipart_upload_id: null, part_size: 8_388_608, transfer_generation: 1,
    expected_input_bytes: 12, source_sha256: 'a'.repeat(64), content_type: 'video/mp4', file_name: 'film.mp4', max_duration_seconds: 14400,
    expires_at: '2026-10-08T10:00:00.000Z', revision: 1, state: 'uploading', quota_confirmed: false, quota_released: false,
    idempotency_key: 'idempotency', request_hash: 'b'.repeat(64), transfer_lease_owner: null, transfer_lease_until: null, transfer_fence: 0,
    retry_count: 0, last_error_code: null, created_at: at, updated_at: at },
    asset: { id: mediaId, owner_id: owner, role: 'main', provider: 'peertube', provider_ref: videoUUID, state: 'processing', expected_input_bytes: 12,
      received_bytes: 12, provider_reported_size: 12, duration_seconds: null, metadata: {}, delivery_path: null, original_bytes: 12,
      processed_bytes: null, auxiliary_bytes: null, revision: 1, processing_generation: 1, error_code: null, error_retryable: false,
      verified_at: null, created_at: at, updated_at: at }, privateState: { uploadId: 'lease-1', uploadLocation: 'https://peertube.example/api/v1/videos/upload-resumable?upload_id=lease-1',
      correlationName: `gma-${mediaId}-a1` }, correlationId: 'adapter-test', transferGeneration: 1, expectedAssetRevision: 1,
    signal: new AbortController().signal, clock: { now: () => Date.parse(at) } };
}
const validReceipt = { complete: true, receivedBytes: 12, sourceSha256: 'a'.repeat(64), identity: 'sha256' as const, providerMediaId: videoUUID,
  proof: { kind: 'peertube-gateway' as const, uploadId: 'lease-1', videoUUID, totalBytes: 12, upstreamReceivedBytes: 12, gmaSha256: 'a'.repeat(64),
    correlationName: `gma-${mediaId}-a1`, finalizingAt: '2026-10-07T10:00:00.000Z' } };

function clientWithVideo(stateId: number, playlist = '/static/streaming-playlists/hls/video/master.m3u8') {
  const client = new PeerTubeClient({ baseUrl: 'https://peertube.example', username: 'service', password: 'secret', channelId: 73, fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/oauth-clients/local') return new Response(JSON.stringify({ client_id: 'client', client_secret: 'secret' }), { status: 200 });
    if (url.pathname === '/api/v1/users/token') return new Response(JSON.stringify({ access_token: 'server-only', expires_in: 3600 }), { status: 200 });
    if (url.pathname === `/api/v1/videos/${videoUUID}` && init?.method === 'GET') return new Response(JSON.stringify({ uuid: videoUUID, duration: 12, state: { id: stateId }, streamingPlaylists: [{ playlistUrl: playlist, files: [] }] }), { status: 200 });
    return new Response('', { status: 404 });
  } });
  return client;
}

test('PeerTube v8.3.1 state mapping handles every documented state and never treats unknown as ready', () => {
  assert.deepEqual(Array.from({ length: 12 }, (_, index) => mapPeerTubeState(index + 1).status), [
    'published', 'processing', 'processing', 'rejected', 'rejected', 'processing', 'failed', 'failed', 'processing', 'processing', 'failed', 'failed',
  ]);
  assert.deepEqual(mapPeerTubeState(999), { status: 'unknown', retryable: false, code: 'PROVIDER_STATE_UNSUPPORTED' });
});

test('PeerTube adapter requires receipt and valid HLS before READY or private GMA playback', async () => {
  const ctx = context();
  const missingReceipt = new PeerTubeMediaProvider(clientWithVideo(1), 'https://media.example', { issue: () => ({ token: 'test-cap', expiresAt: 1_800_000_000_000 }) }, { get: async () => null });
  assert.equal((await missingReceipt.inspectAsset({ ...ctx, processingGeneration: 1 })).status, 'processing');
  const ready = new PeerTubeMediaProvider(clientWithVideo(1), 'https://media.example', { issue: () => ({ token: 'test-cap', expiresAt: 1_800_000_000_000 }) }, { get: async () => validReceipt });
  assert.equal((await ready.inspectAsset({ ...ctx, processingGeneration: 1 })).status, 'ready');
  const playbackContext: ProviderPlaybackContext = { ...ctx, asset: { ...ctx.asset, state: 'ready' }, processingGeneration: 1, authorization: 'published-title', titleSlug: 'fixture', titleId: 1,
    titleRevision: 2, subtitles: [], posterUrl: null, thumbnails: null, fallback: null };
  const source = await ready.getPlayback(playbackContext);
  assert.equal(source.kind, 'hls');
  if (source.kind === 'hls') { assert.match(source.url, /^https:\/\/media\.example\/playback\//); assert.match(source.url, /cap=test-cap/); assert.equal(source.p2p, 'none'); }
  const malformed = new PeerTubeMediaProvider(clientWithVideo(1, 'https://attacker.example/evil.m3u8'), 'https://media.example', { issue: () => ({ token: 'cap', expiresAt: 1 }) }, { get: async () => validReceipt });
  assert.notEqual((await malformed.inspectAsset({ ...ctx, processingGeneration: 1 })).status, 'ready');
});
test('4.4/4.8 final receipt after offset200 and late UUID cancellation cannot leave an orphan',async()=>{
 const ctx=context();ctx.asset.provider_ref=null;let read=0;const deleted:string[]=[];
 const client={queryUploadOffset:async()=>({status:200,range:null}),cancelUpload:async()=>true,deleteVideo:async(id:string)=>{deleted.push(id);return true;}} as unknown as PeerTubeClient;
 const provider=new PeerTubeMediaProvider(client,'https://media.example',{issue:()=>({token:'contract-double',expiresAt:1800000000000})},{get:async()=>validReceipt});
 assert.equal((await provider.completeUpload(ctx)).receivedBytes,12);
 const late=new PeerTubeMediaProvider(client,'https://media.example',{issue:()=>({token:'double',expiresAt:1800000000000})},{get:async()=>++read===1?null:validReceipt});
 const observation=await late.deleteAsset({...ctx,processingGeneration:1});assert.equal(observation.absent,true);assert.deepEqual(deleted,[videoUUID]);
 const foreign=new PeerTubeMediaProvider(client,'https://media.example',{issue:()=>({token:'double',expiresAt:1800000000000})},{get:async()=>({...validReceipt,proof:{...validReceipt.proof,correlationName:'other asset'}})});
 await assert.rejects(foreign.deleteAsset({...ctx,processingGeneration:1}));assert.deepEqual(deleted,[videoUUID]);
 const uncertain=new PeerTubeMediaProvider(client,'https://media.example',{issue:()=>({token:'double',expiresAt:1800000000000})},{get:async()=>null});
 assert.equal((await uncertain.deleteAsset({...ctx,privateState:{...ctx.privateState,finalization_pending:true},processingGeneration:1})).absent,false);
});
