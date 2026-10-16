import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { ProviderUploadContext } from '../../lib/media/provider';
import type { MediaAssetRow, UploadSessionRow } from '../../types/media-engine';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { MockMediaProvider } from '../../lib/media/providers/mock';
import { MediaError } from '../../lib/media/errors';

const owner = '11111111-1111-4111-8111-111111111111';
const draft = '22222222-2222-4222-8222-222222222222';
const now = '2026-10-07T10:00:00.000Z';
const bytes = Buffer.from('durable mock film bytes');
const digest = createHash('sha256').update(bytes).digest('hex');

function context(sessionId = randomUUID()): ProviderUploadContext {
  const session: UploadSessionRow = {
    id: sessionId, owner_id: owner, draft_id: draft, asset_id: randomUUID(), role: 'main', slot: 'main', language: null,
    provider: 'mock', provider_ref: null, provider_data: {}, object_key: null, multipart_upload_id: null, part_size: 16 * 1024 * 1024,
    transfer_generation: 1, expected_input_bytes: bytes.length, source_sha256: digest, content_type: 'video/mp4', file_name: 'movie.mp4',
    max_duration_seconds: 14_400, expires_at: '2026-10-08T10:00:00.000Z', revision: 1, state: 'uploading', quota_confirmed: false,
    quota_released: false, idempotency_key: 'idem', request_hash: 'b'.repeat(64), transfer_lease_owner: 'writer-a',
    transfer_lease_until: '2026-10-07T10:00:30.000Z', transfer_fence: 1, retry_count: 0, last_error_code: null,
    created_at: now, updated_at: now,
  };
  const asset: MediaAssetRow = { id: session.asset_id, owner_id: owner, role: 'main', provider: 'mock', provider_ref: null,
    state: 'received', expected_input_bytes: bytes.length, received_bytes: 0, provider_reported_size: null, duration_seconds: null,
    metadata: {}, delivery_path: null, original_bytes: null, processed_bytes: null, auxiliary_bytes: null, revision: 0,
    processing_generation: 1, error_code: null, error_retryable: false, verified_at: null, created_at: now, updated_at: now };
  return { session, asset, privateState: {}, correlationId: 'test', transferGeneration: 1, expectedAssetRevision: 0,
    signal: new AbortController().signal, clock: { now: () => Date.parse(now) } };
}

test('Mock restart recovers exact disk offset; duplicate chunk replays DB receipt without rewriting bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gma-media-mock-'));
  try {
    const ctx = context(); const commits: string[] = [];
    const repo = { async commitChunk(_owner: string, input: { startByte: number; sha256: string }) { commits.push(`${input.startByte}:${input.sha256}`); } };
    const first = new MockMediaProvider(new MockMediaStorage(root), repo);
    assert.equal((await first.getTransfer(ctx)).protocol, 'uploadx');
    const chunkHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(await first.writeChunk(ctx, { startByte: 0, endByte: bytes.length - 1, sha256: chunkHash, bytes }), bytes.length);
    const restarted = new MockMediaProvider(new MockMediaStorage(root), repo);
    const transfer=await restarted.getTransfer(ctx);assert.ok(transfer.protocol==='uploadx');assert.equal(transfer.offset,bytes.length);
    assert.equal(await restarted.writeChunk(ctx, { startByte: 0, endByte: bytes.length - 1, sha256: chunkHash, bytes }), bytes.length);
    const receipt = await restarted.completeUpload(ctx);
    assert.equal(receipt.complete, true);
    assert.equal(receipt.sourceSha256, digest);
    assert.deepEqual(commits, [`0:${chunkHash}`, `0:${chunkHash}`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Mock rejects changed/out-of-order chunks, source SHA mismatch, and writes after cancel tombstone', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gma-media-mock-'));
  try {
    const ctx = context(); const provider = new MockMediaProvider(new MockMediaStorage(root), { async commitChunk() {} });
    const chunkHash = createHash('sha256').update(bytes.subarray(0, 5)).digest('hex');
    await assert.rejects(provider.writeChunk(ctx, { startByte: 1, endByte: 5, sha256: chunkHash, bytes: bytes.subarray(0, 5) }),
      (error: unknown) => error instanceof MediaError && error.code === 'UPLOAD_REVISION_CONFLICT');
    await provider.writeChunk(ctx, { startByte: 0, endByte: 4, sha256: chunkHash, bytes: bytes.subarray(0, 5) });
    const different = Buffer.from('other'); const differentHash = createHash('sha256').update(different).digest('hex');
    await assert.rejects(provider.writeChunk(ctx, { startByte: 0, endByte: 4, sha256: differentHash, bytes: different }),
      (error: unknown) => error instanceof MediaError && ['UPLOAD_REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(error.code));
    const wrongSource = { ...ctx, session: { ...ctx.session, expected_input_bytes: 5, source_sha256: 'c'.repeat(64) } };
    await assert.rejects(provider.completeUpload(wrongSource), (error: unknown) => error instanceof MediaError && error.code === 'UPLOAD_SOURCE_MISMATCH');
    await provider.cancelUpload(ctx);
    await assert.rejects(provider.writeChunk(ctx, { startByte: 5, endByte: bytes.length - 1,
      sha256: createHash('sha256').update(bytes.subarray(5)).digest('hex'), bytes: bytes.subarray(5) }),
      (error: unknown) => error instanceof MediaError && error.code === 'UPLOAD_CANCELLED');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Mock deletion pending is durable across provider restart and confirms absence only on retry', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gma-media-delete-'));
  try {
    const ctx = context();
    const assetContext = { ...ctx, privateState: { mockScenario: 'delete-pending-once' }, processingGeneration: 1 };
    const first = new MockMediaProvider(new MockMediaStorage(root), { async commitChunk() {} });
    const pending = await first.deleteAsset(assetContext);
    assert.deepEqual(pending, { absent: false, writesRevoked: true, safeAfter: ctx.session.expires_at });
    const restarted = new MockMediaProvider(new MockMediaStorage(root), { async commitChunk() {} });
    const deleted = await restarted.deleteAsset(assetContext);
    assert.deepEqual(deleted, { absent: true, writesRevoked: true, safeAfter: null });
  } finally { await rm(root, { recursive: true, force: true }); }
});
