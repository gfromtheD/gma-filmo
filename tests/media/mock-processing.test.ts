import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { ProviderAssetContext } from '../../lib/media/provider';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { MockMediaProcessing, verifyMockFixture } from '../../lib/media/mock-processing';

const fixtureRoot = path.resolve(process.cwd(), 'tests/media/fixtures/hls');
const clock = { now: () => Date.parse('2026-10-07T12:00:00.000Z'), async wait() {} };
function assetContext(): ProviderAssetContext {
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const assetId = '33333333-3333-4333-8333-333333333333';
  const time = '2026-10-07T10:00:00.000Z';
  return {
    session: { id: sessionId, owner_id: '11111111-1111-4111-8111-111111111111', draft_id: '44444444-4444-4444-8444-444444444444',
      asset_id: assetId, role: 'main', slot: 'main', language: null, provider: 'mock', provider_ref: null, provider_data: {}, object_key: null,
      multipart_upload_id: null, part_size: 16 * 1024 * 1024, transfer_generation: 1, expected_input_bytes: 1, source_sha256: 'a'.repeat(64),
      content_type: 'video/mp4', file_name: 'fixture.mp4', max_duration_seconds: 14_400, expires_at: '2026-10-08T10:00:00.000Z',
      revision: 1, state: 'uploaded', quota_confirmed: true, quota_released: false, idempotency_key: 'idempotency', request_hash: 'b'.repeat(64),
      transfer_lease_owner: null, transfer_lease_until: null, transfer_fence: 1, retry_count: 0, last_error_code: null, created_at: time, updated_at: time },
    asset: { id: assetId, owner_id: '11111111-1111-4111-8111-111111111111', role: 'main', provider: 'mock', provider_ref: null,
      state: 'processing', expected_input_bytes: 1, received_bytes: 1, provider_reported_size: null, duration_seconds: null, metadata: {},
      delivery_path: null, original_bytes: 1, processed_bytes: null, auxiliary_bytes: null, revision: 1, processing_generation: 1,
      error_code: null, error_retryable: false, verified_at: null, created_at: time, updated_at: time },
    privateState: {}, correlationId: 'processing-test', transferGeneration: 1, expectedAssetRevision: 1,
    processingGeneration: 1, signal: new AbortController().signal, clock: { now: () => Date.parse(time) },
  };
}

test('fixture is hash-verified, small, two-rendition HLS with MP4 audio and playable references', async () => {
  const fixture = await verifyMockFixture(fixtureRoot);
  assert.ok(fixture.bytes < 10 * 1024 * 1024);
  const master = await readFile(path.join(fixtureRoot, 'master.m3u8'), 'utf8');
  assert.match(master, /v0\/index\.m3u8/);
  assert.match(master, /v1\/index\.m3u8/);
  const mp4 = fixture.files.find((file) => file.relative === 'legacy.mp4');
  assert.ok(mp4 && mp4.size > 0);
  assert.ok(fixture.files.some((file) => file.relative === 'subtitles.en.vtt'));
  assert.ok(fixture.files.some((file) => file.relative === 'subtitles.es.vtt'));
  assert.ok(fixture.files.some((file) => file.relative === 'poster.webp'));
});

test('mock processing stages immutable verified fixture only on ready and fails once by generation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gma-processing-'));
  try {
    const storage = new MockMediaStorage(root); const engine = new MockMediaProcessing(storage, fixtureRoot, clock);
    const first = assetContext();
    const failed = await engine.run(first, 'processing-fails-once');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error?.retryable, true);
    assert.equal(failed.metadata.outputs, undefined);

    const retried = { ...first, processingGeneration: 2 };
    const ready = await engine.run(retried, 'processing-fails-once');
    assert.equal(ready.status, 'ready');
    assert.equal(ready.durationSeconds, 12);
    assert.equal(ready.metadata.synthetic_playback, true);
    assert.equal(await readFile(storage.assetPath(first.asset.id, 2, 'master.m3u8'), 'utf8').then((value) => value.startsWith('#EXTM3U')), true);
    assert.equal(await readFile(storage.assetPath(first.asset.id, 1, 'master.m3u8')).then(() => true, () => false), false);

    const rejected = await engine.run(first, 'reject-invalid');
    assert.equal(rejected.status, 'rejected');
    const cancelled = await engine.run(first, 'cancel-during-processing', { cancelled: true });
    assert.equal(cancelled.status, 'cancelled');
  } finally { await rm(root, { recursive: true, force: true }); }
});
