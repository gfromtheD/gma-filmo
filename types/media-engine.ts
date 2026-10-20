export const MEDIA_PROVIDER_KEYS = ['r2', 'stream', 'mock', 'peertube'] as const;
export type MediaProviderKey = (typeof MEDIA_PROVIDER_KEYS)[number];

export const ASSET_ROLES = [
  'main',
  'trailer',
  'extras',
  'intro',
  'poster',
  'poster_h',
  'poster_v',
  'subtitles',
  'avatar',
  'banner',
] as const;
export type AssetRole = (typeof ASSET_ROLES)[number];

export const MEDIA_ASSET_STATUSES = [
  'received',
  'validating',
  'processing',
  'ready',
  'failed',
  'rejected',
  'deleting',
  'deleted',
] as const;
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export const TRANSFER_STATES = [
  'provisioning',
  'uploading',
  'paused',
  'uploaded',
  'cancelling',
  'cancelled',
  'expired',
  'failed',
] as const;
export type TransferState = (typeof TRANSFER_STATES)[number];

export type LegacyMediaAssetStatus = Exclude<MediaAssetStatus, 'failed'>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

/** Row shape returned by PostgreSQL. It is deliberately distinct from the catalogue MediaAsset. */
export interface MediaAssetRow {
  id: string;
  owner_id: string;
  role: AssetRole;
  provider: MediaProviderKey;
  provider_ref: string | null;
  state: MediaAssetStatus;
  expected_input_bytes: number;
  received_bytes: number | null;
  provider_reported_size: number | null;
  duration_seconds: number | null;
  metadata: JsonObject;
  delivery_path: string | null;
  original_bytes: number | null;
  processed_bytes: number | null;
  auxiliary_bytes: number | null;
  revision: number;
  processing_generation: number;
  error_code: string | null;
  error_retryable: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape returned by PostgreSQL. Never serialize provider_data as a client DTO. */
export interface UploadSessionRow {
  id: string;
  owner_id: string;
  draft_id: string;
  asset_id: string;
  role: AssetRole;
  slot: string;
  language: string | null;
  provider: MediaProviderKey;
  provider_ref: string | null;
  provider_data: JsonObject;
  object_key: string | null;
  multipart_upload_id: string | null;
  part_size: number;
  transfer_generation: number;
  expected_input_bytes: number;
  source_sha256: string;
  content_type: string;
  file_name: string;
  max_duration_seconds: number;
  expires_at: string;
  revision: number;
  state: TransferState;
  quota_confirmed: boolean;
  quota_released: boolean;
  idempotency_key: string;
  request_hash: string;
  transfer_lease_owner: string | null;
  transfer_lease_until: string | null;
  transfer_fence: number;
  retry_count: number;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadDraftRow {
  id: string;
  owner_id: string;
  purpose: 'title' | 'avatar';
  state: 'draft' | 'published' | 'abandoned';
  metadata: JsonObject;
  revision: number;
  title_id: number | null;
  created_at: string;
  updated_at: string;
}

export type UploadJobKind = 'provision' | 'verify' | 'delete' | 'reconcile' | 'process';
export type UploadJobState = 'pending' | 'running' | 'done' | 'dead';

export interface UploadJobRow {
  id: string;
  kind: UploadJobKind;
  session_id: string | null;
  payload: JsonObject;
  dedupe_key: string;
  state: UploadJobState;
  attempts: number;
  run_after: string;
  lease_owner: string | null;
  lease_until: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAssetDTO {
  mediaId: string;
  status: MediaAssetStatus;
  role: AssetRole;
  durationSeconds: number | null;
  receivedBytes: number | null;
  revision: number;
  processingGeneration: number;
  processingProgress: number | null;
  deliveryUrl: string | null;
  error: { code: string; retryable: boolean } | null;
  metadata: { width?: number; height?: number; syntheticPlayback?: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface UploadSessionDTO {
  sessionId: string;
  mediaId: string;
  draftId: string;
  role: AssetRole;
  slot: string;
  language: string | null;
  state: TransferState;
  revision: number;
  transferGeneration: number;
  expectedBytes: number;
  sourceSha256: string;
  expiresAt: string;
  receivedBytes: number;
  transferProgress: number;
  fileName: string;
  contentType: string;
}

export interface PutTransferDescriptor {
  protocol: 'put';
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface MultipartTransferDescriptor {
  protocol: 'multipart';
  inspectUrl: string;
  partUrl: string;
  partSize: number;
  generation: number;
  concurrency: 2;
}

export interface TusTransferDescriptor {
  protocol: 'tus';
  url: string;
  chunkSize: number;
  expiresAt: string;
}

export interface UploadxTransferDescriptor {
  protocol: 'uploadx';
  url: string;
  headers: Record<string, string>;
  chunkSize: number;
  offset: number;
  totalBytes: number;
  expiresAt: string;
}

export type TransferDescriptor =
  | PutTransferDescriptor
  | MultipartTransferDescriptor
  | TusTransferDescriptor
  | UploadxTransferDescriptor;

export type MediaProof =
  | {
      kind: 'mock-sha256';
      size: number;
      sha256: string;
      transferGeneration: number;
      chunkManifestHash: string;
    }
  | {
      kind: 'r2-receipt';
      size: number;
      etag: string;
      objectKey: string;
      completedPartsHash: string;
    }
  | {
      kind: 'peertube-gateway';
      uploadId: string;
      videoUUID: string;
      totalBytes: number;
      upstreamReceivedBytes: number;
      gmaSha256: string;
      correlationName: string;
      finalizingAt: string;
    }
  | { kind: 'stream-receipt'; uid: string; receivedBytes: number; inspectedAt: string };

export interface UploadReceipt {
  complete: boolean;
  receivedBytes: number;
  sourceSha256: string | null;
  identity: 'sha256' | 'provider-receipt';
  providerMediaId: string | null;
  proof: MediaProof;
}

export interface ProviderSnapshot {
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'rejected' | 'absent' | 'unknown';
  durationSeconds: number | null;
  receivedBytes: number | null;
  metadata: JsonObject;
  playbackVerified: boolean;
  error: { code: string; retryable: boolean } | null;
}

export interface MediaPlaybackContext {
  authorization: 'owner-preview' | 'published-title';
  titleSlug: string | null;
  titleId: number | null;
  titleRevision: number | null;
  subtitles: import('./playback').SubtitleSource[];
  posterUrl: string | null;
  thumbnails: import('./playback').PlaybackThumbnailSource | null;
  fallback: { kind: 'mp4'; url: string } | null;
}
