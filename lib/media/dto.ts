import { z } from 'zod';
import type { MediaAssetDTO, MediaAssetRow, UploadSessionDTO, UploadSessionRow } from '@/types/media-engine';
import { mediaAssetDTOSchema, uploadSessionDTOSchema } from './contracts';

const assetRowSchema = z.object({
  id: z.string().uuid(), owner_id: z.string().uuid(), role: z.enum(['main','trailer','extras','intro','poster','poster_h','poster_v','subtitles','avatar']),
  provider: z.enum(['r2','stream','mock','peertube']), provider_ref: z.string().nullable(),
  state: z.enum(['received','validating','processing','ready','failed','rejected','deleting','deleted']),
  expected_input_bytes: z.number().int().nonnegative(), received_bytes: z.number().int().nonnegative().nullable(),
  provider_reported_size: z.number().int().nonnegative().nullable(), duration_seconds: z.number().nonnegative().nullable(),
  metadata: z.record(z.string(), z.unknown()), delivery_path: z.string().nullable(), original_bytes: z.number().int().nonnegative().nullable(),
  processed_bytes: z.number().int().nonnegative().nullable(), auxiliary_bytes: z.number().int().nonnegative().nullable(),
  revision: z.number().int().nonnegative(), processing_generation: z.number().int().positive(), error_code: z.string().nullable(),
  error_retryable: z.boolean(), verified_at: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
}).passthrough();

const sessionRowSchema = z.object({
  id: z.string().uuid(), owner_id: z.string().uuid(), draft_id: z.string().uuid(), asset_id: z.string().uuid(),
  role: z.enum(['main','trailer','extras','intro','poster','poster_h','poster_v','subtitles','avatar']),
  slot: z.string(), language: z.string().nullable(), provider: z.enum(['r2','stream','mock','peertube']),
  provider_ref: z.string().nullable(), provider_data: z.record(z.string(), z.unknown()), object_key: z.string().nullable(),
  multipart_upload_id: z.string().nullable(), part_size: z.number().int().nonnegative(), transfer_generation: z.number().int().positive(),
  expected_input_bytes: z.number().int().positive(), source_sha256: z.string().regex(/^[a-f0-9]{64}$/), content_type: z.string(),
  file_name: z.string(), max_duration_seconds: z.number().nonnegative(), expires_at: z.string(), revision: z.number().int().nonnegative(),
  state: z.enum(['provisioning','uploading','paused','uploaded','cancelling','cancelled','expired','failed']),
  quota_confirmed: z.boolean(), quota_released: z.boolean(), idempotency_key: z.string(), request_hash: z.string(),
  transfer_lease_owner: z.string().nullable(), transfer_lease_until: z.string().nullable(), transfer_fence: z.number().int().nonnegative(),
  retry_count: z.number().int().nonnegative(), last_error_code: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
}).passthrough();

export function mapMediaAssetDTO(input: unknown): MediaAssetDTO {
  const row = assetRowSchema.parse(input);
  const metadata = row.metadata;
  const dto: MediaAssetDTO = {
    mediaId: row.id, status: row.state, role: row.role, durationSeconds: row.duration_seconds,
    receivedBytes: row.received_bytes, revision: row.revision, processingGeneration: row.processing_generation,
    processingProgress: typeof metadata.processing_progress === 'number' && Number.isFinite(metadata.processing_progress)
      ? Math.max(0, Math.min(100, metadata.processing_progress)) : null,
    deliveryUrl: null,
    error: row.error_code ? { code: row.error_code, retryable: row.error_retryable } : null,
    metadata: {
      ...(typeof metadata.width === 'number' && Number.isInteger(metadata.width) && metadata.width > 0 ? { width: metadata.width } : {}),
      ...(typeof metadata.height === 'number' && Number.isInteger(metadata.height) && metadata.height > 0 ? { height: metadata.height } : {}),
      ...(metadata.synthetic_playback === true ? { syntheticPlayback: true } : {}),
    }, createdAt: row.created_at, updatedAt: row.updated_at,
  };
  return mediaAssetDTOSchema.parse(dto);
}

export function mapUploadSessionDTO(input: unknown, confirmedReceivedBytes: number): UploadSessionDTO {
  const row = sessionRowSchema.parse(input);
  const receivedBytes = Number.isSafeInteger(confirmedReceivedBytes)
    ? Math.max(0, Math.min(row.expected_input_bytes, confirmedReceivedBytes)) : 0;
  const dto: UploadSessionDTO = {
    sessionId: row.id, mediaId: row.asset_id, draftId: row.draft_id, role: row.role, slot: row.slot,
    language: row.language, state: row.state, revision: row.revision, transferGeneration: row.transfer_generation,
    expectedBytes: row.expected_input_bytes, sourceSha256: row.source_sha256, expiresAt: row.expires_at,
    receivedBytes, transferProgress: Math.floor(receivedBytes / row.expected_input_bytes * 100),
    fileName: row.file_name, contentType: row.content_type,
  };
  return uploadSessionDTOSchema.parse(dto);
}

export function parseMediaAssetRow(input: unknown): MediaAssetRow {
  return assetRowSchema.parse(input) as MediaAssetRow;
}

export function parseUploadSessionRow(input: unknown): UploadSessionRow {
  return sessionRowSchema.parse(input) as UploadSessionRow;
}

export const draftDTOSchema = z.object({
 id:z.string().uuid(),purpose:z.enum(['title','avatar']),state:z.enum(['draft','published','abandoned']),revision:z.number().int().nonnegative(),titleId:z.number().nullable(),
 metadata:z.object({title:z.string().optional(),synopsis:z.string().nullable().optional(),year:z.string().optional(),language:z.string().optional(),genre:z.string().optional()}).strict(),createdAt:z.string(),updatedAt:z.string(),
}).strict();
export function mapDraftDTO(row: import('@/types/media-engine').UploadDraftRow) {
 const metadata=row.metadata; const safe:Record<string,unknown>={};
 for(const key of ['title','synopsis','year','language','genre'])if(typeof metadata[key]==='string' || key==='synopsis' && metadata[key]===null)safe[key]=metadata[key];
 return draftDTOSchema.parse({id:row.id,purpose:row.purpose,state:row.state,revision:row.revision,titleId:row.title_id,metadata:safe,createdAt:row.created_at,updatedAt:row.updated_at});
}
