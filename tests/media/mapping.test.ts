import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediaAssetDTOSchema, uploadMutationEnvelopeSchema, uploadSessionDTOSchema } from '../../lib/media/contracts';
import { mapMediaAssetDTO, mapUploadSessionDTO } from '../../lib/media/dto';

const mediaId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const draftId = '33333333-3333-4333-8333-333333333333';
const now = '2026-10-07T10:00:00.000Z';

const asset = {
  mediaId, status: 'processing', role: 'main', durationSeconds: null, receivedBytes: 1024,
  revision: 2, processingGeneration: 1, processingProgress: 25, deliveryUrl: null,
  error: null, metadata: { width: 1920, height: 1080, syntheticPlayback: true }, createdAt: now, updatedAt: now,
};

const session = {
  sessionId, mediaId, draftId, role: 'main', slot: 'main', language: null,
  state: 'uploaded', revision: 1, transferGeneration: 1, expectedBytes: 4096,
  sourceSha256: 'a'.repeat(64), expiresAt: now, receivedBytes: 4096, transferProgress: 100,
  fileName: 'film.mp4', contentType: 'video/mp4',
};

test('versioned DTO schemas accept whitelisted client fields and matching media identity', () => {
  assert.deepEqual(mediaAssetDTOSchema.parse(asset), asset);
  assert.deepEqual(uploadSessionDTOSchema.parse(session), session);
  assert.deepEqual(uploadMutationEnvelopeSchema.parse({ version: 1, session, asset, draftRevision: 4 }), {
    version: 1, session, asset, draftRevision: 4,
  });
});

test('DTO schemas reject provider, owner, private data, output inventories and identity mismatches', () => {
  assert.equal(mediaAssetDTOSchema.safeParse({ ...asset, provider: 'r2' }).success, false);
  assert.equal(mediaAssetDTOSchema.safeParse({ ...asset, metadata: { ...asset.metadata, outputs: [{ relative: 'master.m3u8' }] } }).success, false);
  assert.equal(uploadSessionDTOSchema.safeParse({ ...session, owner_id: 'untrusted' }).success, false);
  assert.equal(uploadSessionDTOSchema.safeParse({ ...session, provider_data: { oauth: 'secret' } }).success, false);
  assert.equal(uploadSessionDTOSchema.safeParse({ ...session, receivedBytes: session.expectedBytes + 1 }).success, false);
  assert.equal(uploadMutationEnvelopeSchema.safeParse({ version: 1, session, asset: { ...asset, mediaId: draftId }, draftRevision: 4 }).success, false);
});

test('database row mappers whitelist asset metadata and clamp only server-confirmed transfer progress', () => {
  const assetRow = {
    id: mediaId, owner_id: '44444444-4444-4444-8444-444444444444', role: 'main', provider: 'mock', provider_ref: 'secret',
    state: 'processing', expected_input_bytes: 4096, received_bytes: 1024, provider_reported_size: null, duration_seconds: null,
    metadata: { width: 1920, height: 1080, synthetic_playback: true, outputs: [{ relative: 'secret' }], oauth: 'secret' },
    delivery_path: 'private/path', original_bytes: null, processed_bytes: null, auxiliary_bytes: null, revision: 2,
    processing_generation: 1, error_code: null, error_retryable: false, verified_at: null, created_at: now, updated_at: now,
    provider_data: { token: 'secret' },
  };
  const mapped = mapMediaAssetDTO(assetRow);
  assert.deepEqual(mapped.metadata, { width: 1920, height: 1080, syntheticPlayback: true });
  assert.equal(mapped.deliveryUrl, null);
  assert.equal(JSON.stringify(mapped).includes('secret'), false);

  const row = {
    id: sessionId, owner_id: '44444444-4444-4444-8444-444444444444', draft_id: draftId, asset_id: mediaId,
    role: 'main', slot: 'main', language: null, provider: 'mock', provider_ref: null, provider_data: { token: 'secret' },
    object_key: null, multipart_upload_id: null, part_size: 0, transfer_generation: 1, expected_input_bytes: 4096,
    source_sha256: 'a'.repeat(64), content_type: 'video/mp4', file_name: 'film.mp4', max_duration_seconds: 3600,
    expires_at: now, revision: 1, state: 'uploading', quota_confirmed: false, quota_released: false,
    idempotency_key: 'key', request_hash: 'b'.repeat(64), transfer_lease_owner: null, transfer_lease_until: null,
    transfer_fence: 0, retry_count: 0, last_error_code: null, created_at: now, updated_at: now,
  };
  const mappedSession = mapUploadSessionDTO(row, 5000);
  assert.equal(mappedSession.receivedBytes, 4096);
  assert.equal(mappedSession.transferProgress, 100);
  assert.equal(JSON.stringify(mappedSession).includes('token'), false);
});
