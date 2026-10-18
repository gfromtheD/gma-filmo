import type { UploadSessionRow } from '@/types/media-engine';
import type { UploadSession } from '@/lib/uploads/types';

export function legacySession(session: UploadSessionRow, provider: 'r2' | 'stream'): UploadSession {
  if (session.provider !== provider) throw new Error('MEDIA_PROVIDER_SESSION_MISMATCH');
  return {
    id: session.id, owner_id: session.owner_id, draft_id: session.draft_id, asset_id: session.asset_id,
    role: session.role, slot: session.slot, language: session.language, provider,
    provider_ref: session.provider_ref, provider_data: session.provider_data,
    object_key: session.object_key, multipart_upload_id: session.multipart_upload_id, part_size: session.part_size,
    transfer_generation: session.transfer_generation, expected_input_bytes: session.expected_input_bytes,
    source_sha256: session.source_sha256, content_type: session.content_type, file_name: session.file_name,
    max_duration_seconds: session.max_duration_seconds, expires_at: session.expires_at,
    revision: session.revision, state: session.state,
  };
}
