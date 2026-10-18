import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEDIA_ERROR_CODES, MediaError } from '../../lib/media/errors';
import type {
  DeletionObservation,
  MediaProvider,
  ProviderAssetContext,
  ProviderPlaybackContext,
  ProviderUploadContext,
} from '../../lib/media/provider';
import type {
  AssetRole,
  MediaProviderKey,
  MediaProof,
  ProviderSnapshot,
  TransferDescriptor,
  UploadReceipt,
} from '../../types/media-engine';
import { mediaProofSchema, playbackSourceSchema, transferDescriptorSchema } from '../../lib/media/contracts';
import { MEDIA_PROVIDER_KEYS } from '../../types/media-engine';

const ownerId = '11111111-1111-4111-8111-111111111111';
const draftId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const mediaId = '44444444-4444-4444-8444-444444444444';
const sourceSha256 = 'a'.repeat(64);
const expectedBytes = 1024;

const context: ProviderUploadContext = {
  session: {
    id: sessionId,
    owner_id: ownerId,
    draft_id: draftId,
    asset_id: mediaId,
    role: 'main',
    slot: 'main',
    language: null,
    provider: 'mock',
    provider_ref: null,
    provider_data: {},
    object_key: null,
    multipart_upload_id: null,
    part_size: 8 * 1024 * 1024,
    transfer_generation: 1,
    expected_input_bytes: expectedBytes,
    source_sha256: sourceSha256,
    content_type: 'video/mp4',
    file_name: 'fixture.mp4',
    max_duration_seconds: 14_400,
    expires_at: '2026-10-08T10:00:00.000Z',
    revision: 0,
    state: 'uploading',
    quota_confirmed: false,
    quota_released: false,
    idempotency_key: 'fixture-reserve',
    request_hash: 'b'.repeat(64),
    transfer_lease_owner: null,
    transfer_lease_until: null,
    transfer_fence: 0,
    retry_count: 0,
    last_error_code: null,
    created_at: '2026-10-07T10:00:00.000Z',
    updated_at: '2026-10-07T10:00:00.000Z',
  },
  asset: {
    id: mediaId,
    owner_id: ownerId,
    role: 'main',
    provider: 'mock',
    provider_ref: null,
    state: 'received',
    expected_input_bytes: expectedBytes,
    received_bytes: 0,
    provider_reported_size: null,
    duration_seconds: null,
    metadata: {},
    delivery_path: null,
    original_bytes: null,
    processed_bytes: null,
    auxiliary_bytes: null,
    revision: 0,
    processing_generation: 1,
    error_code: null,
    error_retryable: false,
    verified_at: null,
    created_at: '2026-10-07T10:00:00.000Z',
    updated_at: '2026-10-07T10:00:00.000Z',
  },
  privateState: {},
  correlationId: 'request-contract-test',
  transferGeneration: 1,
  expectedAssetRevision: 0,
  signal: new AbortController().signal,
  clock: { now: () => Date.parse('2026-10-07T10:00:00.000Z') },
};

const roles = ['main', 'trailer', 'extras', 'intro', 'poster', 'poster_h', 'poster_v', 'subtitles', 'avatar'] as const satisfies readonly AssetRole[];

function proofFor(provider: MediaProviderKey): MediaProof {
  if (provider === 'mock') {
    return { kind: 'mock-sha256', size: expectedBytes, sha256: sourceSha256, transferGeneration: 1, chunkManifestHash: 'c'.repeat(64) };
  }
  if (provider === 'r2') {
    return { kind: 'r2-receipt', size: expectedBytes, etag: 'etag-not-a-sha', objectKey: `ingest/${mediaId}/source`, completedPartsHash: 'd'.repeat(64) };
  }
  if (provider === 'peertube') {
    return {
      kind: 'peertube-gateway', uploadId: 'uploadx-fixture', videoUUID: mediaId,
      totalBytes: expectedBytes, upstreamReceivedBytes: expectedBytes, gmaSha256: sourceSha256,
      correlationName: `gma-${mediaId}-a1`, finalizingAt: '2026-10-07T10:00:00.000Z',
    };
  }
  return { kind: 'stream-receipt', uid: 'stream-fixture-uid', receivedBytes: expectedBytes, inspectedAt: '2026-10-07T10:00:00.000Z' };
}

function transferFor(provider: MediaProviderKey): TransferDescriptor {
  if (provider === 'r2') {
    return { protocol: 'multipart', inspectUrl: '/api/uploads/test/parts', partUrl: '/api/uploads/test/part', partSize: 8 * 1024 * 1024, generation: 1, concurrency: 2 };
  }
  if (provider === 'stream') {
    return { protocol: 'tus', url: 'https://stream.example/upload/test', chunkSize: 8 * 1024 * 1024, expiresAt: '2026-10-08T10:00:00.000Z' };
  }
  return { protocol: 'uploadx', url: 'http://127.0.0.1:4319/transfer/test', headers: {}, chunkSize: 8 * 1024 * 1024, offset: 0, totalBytes: expectedBytes, expiresAt: '2026-10-07T10:05:00.000Z' };
}

function receiptFor(provider: MediaProviderKey): UploadReceipt {
  return {
    complete: true,
    receivedBytes: expectedBytes,
    sourceSha256: provider === 'stream' ? null : sourceSha256,
    identity: provider === 'stream' || provider === 'r2' ? 'provider-receipt' : 'sha256',
    providerMediaId: provider === 'peertube' ? mediaId : null,
    proof: proofFor(provider),
  };
}

function providerDouble(key: MediaProviderKey): MediaProvider {
  const providerRoles = key === 'peertube' ? roles.slice(0, 4) : roles;
  const capabilities = {
    roles: providerRoles,
    processing: key === 'peertube' || key === 'stream' ? 'managed' as const : 'local' as const,
    retry: key === 'peertube' ? 'observe-only' as const : key === 'stream' ? 'replacement-required' as const : 'local-job' as const,
  };
  const absence: DeletionObservation = { absent: false, writesRevoked: false, safeAfter: null };
  const snapshot: ProviderSnapshot = {
    status: 'pending', durationSeconds: null, receivedBytes: 0, metadata: {}, playbackVerified: false, error: null,
  };

  return {
    key,
    capabilities,
    async provisionUpload() {
      return { uploadId: `${key}:test`, providerMediaId: key === 'peertube' ? null : null, privateState: {} };
    },
    async recoverUpload() {
      return null;
    },
    async getTransfer() {
      return transferFor(key);
    },
    async inspectUpload() {
      return receiptFor(key);
    },
    async completeUpload() {
      return receiptFor(key);
    },
    async cancelUpload() {
      return absence;
    },
    async inspectAsset() {
      return snapshot;
    },
    async getPlayback() {
      const source = {
        version: 1 as const,
        kind: 'hls' as const,
        mediaId,
        titleSlug: null,
        titleId: null,
        revision: 0,
        url: 'https://media.example/mock/master.m3u8?cap=fixture',
        mimeType: 'application/vnd.apple.mpegurl' as const,
        p2p: 'none' as const,
        fallback: null,
        expiresAt: Date.parse('2026-10-07T10:05:00.000Z'),
        refreshUrl: `/api/media/${mediaId}/playback`,
        subtitles: [],
        posterUrl: null,
        thumbnails: null,
      };
      return playbackSourceSchema.parse(source);
    },
    async getAuxiliaryDelivery() {
      if (key === 'peertube') throw new MediaError(MEDIA_ERROR_CODES.protocolUnsupported);
      return { url: `/api/media/${mediaId}`, mimeType: 'image/webp', expiresAt: null };
    },
    async deleteAsset() {
      return absence;
    },
  };
}

test('all adapters satisfy the same upload, inspection, playback and deletion contract without network access', async () => {
  for (const key of MEDIA_PROVIDER_KEYS) {
    const provider = providerDouble(key);
    const uploadContext: ProviderUploadContext = {
      ...context,
      session: { ...context.session, provider: key },
      asset: { ...context.asset, provider: key },
    };
    const assetContext: ProviderAssetContext = { ...uploadContext, processingGeneration: 1 };
    const playbackContext: ProviderPlaybackContext = {
      ...assetContext,
      authorization: 'owner-preview',
      titleSlug: null,
      titleId: null,
      titleRevision: null,
      subtitles: [],
      posterUrl: null,
      thumbnails: null,
      fallback: null,
    };
    assert.equal(provider.key, key);
    assert.equal(uploadContext.asset.provider, key);
    assert.equal(uploadContext.session.provider, key);
    assert.ok(provider.capabilities.roles.includes('main'));

    const binding = await provider.provisionUpload(uploadContext);
    assert.equal(binding.providerMediaId, null);
    assert.equal(await provider.recoverUpload(uploadContext), null);
    const descriptor = transferDescriptorSchema.parse(await provider.getTransfer(uploadContext));
    assert.equal(descriptor.protocol, transferFor(key).protocol);
    const inspectedReceipt = await provider.inspectUpload(uploadContext);
    assert.equal(inspectedReceipt.complete, true);
    assert.equal(mediaProofSchema.parse(inspectedReceipt.proof).kind, proofFor(key).kind);
    const completedReceipt = await provider.completeUpload(uploadContext);
    assert.equal(completedReceipt.receivedBytes, expectedBytes);
    if (key === 'stream') {
      assert.equal(completedReceipt.identity, 'provider-receipt');
      assert.equal(completedReceipt.sourceSha256, null);
    } else if (key === 'r2') {
      assert.equal(completedReceipt.identity, 'provider-receipt');
      assert.equal(completedReceipt.sourceSha256, sourceSha256);
    } else {
      assert.equal(completedReceipt.identity, 'sha256');
      assert.equal(completedReceipt.sourceSha256, sourceSha256);
    }
    assert.equal((await provider.inspectAsset(assetContext)).status, 'pending');
    assert.equal(playbackSourceSchema.parse(await provider.getPlayback(playbackContext)).kind, 'hls');
    assert.equal((await provider.cancelUpload(uploadContext)).absent, false);
    assert.equal((await provider.deleteAsset(assetContext)).writesRevoked, false);

    if (key === 'peertube') {
      assert.deepEqual(provider.capabilities.roles, ['main', 'trailer', 'extras', 'intro']);
      await assert.rejects(provider.getAuxiliaryDelivery(assetContext), (error: unknown) =>
        error instanceof MediaError && error.code === MEDIA_ERROR_CODES.protocolUnsupported,
      );
    } else {
      assert.equal((await provider.getAuxiliaryDelivery(assetContext)).mimeType, 'image/webp');
    }
  }
});
