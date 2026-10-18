import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProviderUploadContext, ProviderAssetContext, ProviderPlaybackContext } from '../../lib/media/provider';
import type { MediaAssetRow, UploadSessionRow } from '../../types/media-engine';
import { R2MediaProvider } from '../../lib/media/providers/r2';
import { StreamMediaProvider } from '../../lib/media/providers/stream';
import type { R2VideoProvider } from '../../lib/uploads/r2-video';
import type { AuxiliaryProvider } from '../../lib/uploads/auxiliary';
import type { StreamProvider } from '../../lib/uploads/stream';
import { playbackSourceSchema, mediaProofSchema, transferDescriptorSchema } from '../../lib/media/contracts';
import { legacyMediaUrl, resolveLegacyPlayback } from '../../lib/media/legacy-playback';

const owner = '11111111-1111-4111-8111-111111111111';
const draft = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const now = '2026-10-07T10:00:00.000Z';

test('legacy playback exposes sprites only for an allowlisted historical MP4 and keeps YouTube neutral', () => {
  const env = { NEXT_PUBLIC_R2_PUBLIC_URL: 'https://legacy.example', LEGACY_MEDIA_ALLOWED_HOSTS: 'legacy.example' };
  const source = resolveLegacyPlayback({ id: 23, slug: 'old-film', r2_video_url: 'https://legacy.example/videos/old.mp4',
    youtube_url: null, r2_subtitle_url: null, r2_poster_url: null }, env);
  assert.equal(source.kind, 'mp4');
  assert.deepEqual(source.thumbnails, { vttUrl: '/api/sprites/old-film', imageUrl: 'https://legacy.example/sprites/old-film.jpg', tileWidth: 160, tileHeight: 90 });
  assert.throws(() => resolveLegacyPlayback({ id: 24, slug: 'private-film', r2_video_url: 'https://attacker.invalid/video.mp4' }, env));
  const youtube = resolveLegacyPlayback({ id: 25, slug: 'old-youtube', youtube_url: 'https://youtu.be/abcdefghijk' }, env);
  assert.equal(youtube.kind, 'youtube');
  assert.equal(youtube.thumbnails, null);
});

test('legacy media allowlist accepts only the explicit local subtitle fixtures in isolated Mock mode', () => {
  const env = { UPLOAD_ENVIRONMENT: 'local', MEDIA_MOCK_ENABLED: 'true', SUPABASE_URL: 'http://127.0.0.1:54341' };
  assert.equal(legacyMediaUrl('http://127.0.0.1:4319/fixtures/subtitles.es.vtt', env), 'http://127.0.0.1:4319/fixtures/subtitles.es.vtt');
  assert.equal(legacyMediaUrl('http://127.0.0.1:4319/private/secret.vtt', env), null);
  assert.equal(legacyMediaUrl('http://127.0.0.1:4319/fixtures/subtitles.es.vtt?url=https://evil.test', env), null);
});
function contexts(provider: 'r2' | 'stream', role: 'main' | 'poster' = 'main') {
  const session: UploadSessionRow = {
    id, owner_id: owner, draft_id: draft, asset_id: id, role, slot: role, language: null, provider,
    provider_ref: provider === 'stream' ? 'stream-uid-12345678' : null, provider_data: {}, object_key: `ingest/${owner}/${id}/upload`,
    multipart_upload_id: 'multipart-id', part_size: 8 * 1024 * 1024, transfer_generation: 1, expected_input_bytes: 100,
    source_sha256: 'a'.repeat(64), content_type: role === 'main' ? 'video/mp4' : 'image/png', file_name: 'source', max_duration_seconds: 14_400,
    expires_at: '2026-10-08T10:00:00.000Z', revision: 1, state: 'uploading', quota_confirmed: false, quota_released: false,
    idempotency_key: 'idem', request_hash: 'b'.repeat(64), transfer_lease_owner: null, transfer_lease_until: null,
    transfer_fence: 0, retry_count: 0, last_error_code: null, created_at: now, updated_at: now,
  };
  const asset: MediaAssetRow = {
    id, owner_id: owner, role, provider, provider_ref: null, state: 'ready', expected_input_bytes: 100, received_bytes: 100,
    provider_reported_size: null, duration_seconds: 120, metadata: { outputs: [{ relative: 'master.m3u8' }], hls_prefix: `media/${id}/hls/` },
    delivery_path: `/api/media/${id}/hls/master.m3u8`, original_bytes: null, processed_bytes: null, auxiliary_bytes: null,
    revision: 2, processing_generation: 1, error_code: null, error_retryable: false, verified_at: now, created_at: now, updated_at: now,
  };
  const base = { session, asset, privateState: {}, correlationId: 'test', transferGeneration: 1, expectedAssetRevision: 2,
    signal: new AbortController().signal, clock: { now: () => Date.parse(now) } };
  return { upload: base satisfies ProviderUploadContext, assetContext: { ...base, processingGeneration: 1 } satisfies ProviderAssetContext,
    playback: { ...base, processingGeneration: 1, authorization: 'published-title', titleSlug: 'film', titleId: 1,
      titleRevision: 2, subtitles: [], posterUrl: null, thumbnails: null, fallback: null } satisfies ProviderPlaybackContext };
}

test('R2 adapter delegates multipart, preserves ETag as provider receipt, and keeps deletion grace', async () => {
  const calls: string[] = [];
  const video = {
    async createUpload() { calls.push('create'); return { providerRef: `ingest/${owner}/${id}/upload`, multipartUploadId: 'multipart-id', partSize: 8 * 1024 * 1024, expiresAt: '2026-10-08T10:00:00.000Z' }; },
    async inspectUpload() { return { complete: true, receivedBytes: 100, parts: [], etag: 'multipart-etag-not-sha' }; },
    async completeUpload() { calls.push('complete'); return { complete: true, receivedBytes: 100, parts: [], etag: 'multipart-etag-not-sha' }; },
    async cancelUpload() { calls.push('cancel'); }, async verifyObject() { return { complete: true, receivedBytes: 100, parts: [], etag: 'etag' }; },
    async deleteObject() { return false; },
  } as unknown as R2VideoProvider;
  const auxiliary = { async transfer() { return { providerRef: 'key', uploadUrl: 'https://upload.example/signed', expiresAt: '2026-10-08T10:00:00.000Z' }; },
    async verify() { return { received_bytes: 100, delivery_path: '/api/media/x', metadata: { storage_key: 'ready/object', normalized_sha256: 'c'.repeat(64) } }; },
    async delete() { return false; } } as unknown as AuxiliaryProvider;
  const provider = new R2MediaProvider(video, auxiliary);
  const ctx = contexts('r2');
  assert.equal((await provider.provisionUpload(ctx.upload)).uploadId, 'multipart-id');
  assert.deepEqual(transferDescriptorSchema.parse(await provider.getTransfer(ctx.upload)), {
    protocol: 'multipart', inspectUrl: `/api/uploads/${id}/parts`, partUrl: `/api/uploads/${id}/part`, partSize: 8 * 1024 * 1024, generation: 1, concurrency: 2,
  });
  const receipt = await provider.completeUpload(ctx.upload);
  assert.equal(mediaProofSchema.parse(receipt.proof).kind, 'r2-receipt');
  assert.equal(receipt.proof.kind === 'r2-receipt' ? receipt.proof.etag : '', 'multipart-etag-not-sha');
  const deletion = await provider.cancelUpload(ctx.upload);
  assert.deepEqual(deletion, { absent: false, writesRevoked: false, safeAfter: '2026-10-08T10:00:00.000Z' });
  assert.deepEqual(calls, ['create', 'complete', 'cancel']);
});

test('Stream adapter preserves tus recovery, signed playback, observe-only status and rejects auxiliary roles', async () => {
  const stream = {
    async provision() { return { providerRef: 'stream-uid-12345678', uploadUrl: 'https://upload.videodelivery.net/tus', expiresAt: '2026-10-08T10:00:00.000Z' }; },
    async recover() { return 'stream-uid-12345678'; },
    async received() { return 100; },
    async observe() { return { found: true, state: 'ready', readyToStream: true, processingProgress: 100, durationSeconds: 120, providerReportedSize: 100, receivedBytes: 100 }; },
    playback() { return { url: 'https://customer.example/token/manifest/video.m3u8', expiresAt: Date.parse('2026-10-07T12:00:00Z') }; },
    async delete() { return true; }, assertTransferUrl() {},
  } as unknown as StreamProvider;
  const provider = new StreamMediaProvider(stream);
  const ctx = contexts('stream');
  const binding = await provider.provisionUpload(ctx.upload);
  assert.equal(binding.providerMediaId, 'stream-uid-12345678');
  assert.equal((await provider.recoverUpload(ctx.upload))?.providerMediaId, 'stream-uid-12345678');
  assert.equal((await provider.inspectUpload(ctx.upload)).proof.kind, 'stream-receipt');
  assert.equal((await provider.inspectAsset(ctx.assetContext)).status, 'ready');
  const playback = playbackSourceSchema.parse(await provider.getPlayback(ctx.playback));
  assert.equal(playback.kind, 'hls');
  if (playback.kind === 'hls') assert.match(playback.url, /manifest\/video\.m3u8$/);
  await assert.rejects(provider.getAuxiliaryDelivery(), /UPLOAD_PROTOCOL_UNSUPPORTED/);
});
