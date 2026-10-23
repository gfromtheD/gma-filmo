import type { MediaAssetDTO, UploadSessionDTO } from '@/types/media-engine';
export type UploadRole = "main" | "trailer" | "intro" | "extras" | "extra_image" | "poster" | "poster_h" | "poster_v" | "subtitles" | "avatar" | "banner";
export type ClientUploadState = "pending" | "hashing" | "uploading" | "paused" | "processing" | "done" | "error" | "cancelling";

export type ManagedClientUploadState = 'pending' | 'uploading' | 'paused' | 'processing' | 'done' | 'error' | 'cancelling';
export function managedClientState(session: UploadSessionDTO, asset: MediaAssetDTO, hasLocalFile = true): ManagedClientUploadState {
  if (session.state === 'cancelling' || asset.status === 'deleting') return 'cancelling';
  if (asset.status === 'ready') return 'done';
  if (asset.status === 'failed' || asset.status === 'rejected' || ['failed', 'expired', 'cancelled'].includes(session.state)) return 'error';
  if (session.state === 'paused') return 'paused';
  if (session.state === 'uploading') return hasLocalFile ? 'uploading' : 'paused';
  if (asset.status === 'processing' || asset.status === 'validating' || asset.status === 'received' || session.state === 'uploaded') return 'processing';
  return 'pending';
}
export interface ClientUploadSession {
  id: string;
  draft_id: string | null;
  asset_id: string;
  role: UploadRole;
  slot: string;
  language: string | null;
  state: string;
  provider: "stream" | "r2";
  revision: number;
  expected_input_bytes: number;
  source_sha256: string;
  expires_at: string;
  file_name: string;
  content_type: string;
}

export interface ClientMediaAsset {
  id: string;
  state: string;
  provider: "stream" | "r2";
  provider_ref: string | null;
  delivery_path: string | null;
  duration_seconds: number | null;
  received_bytes: number | null;
  metadata: Record<string, unknown>;
}

export interface ClientUploadDraft {
  id: string;
  revision: number;
  purpose: "title" | "avatar" | "banner";
  state: string;
  metadata: Record<string, unknown>;
}

export interface ClientDraftResponse {
  draft: ClientUploadDraft;
  sessions: ClientUploadSession[];
  assets: ClientMediaAsset[];
  media: { asset_id: string; role: UploadRole; slot: string; language: string | null }[];
}

export interface ClientTransfer {
  provider: "stream" | "r2";
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresAt?: string;
  chunkSize?: number;
}

export interface ClientSessionResponse {
  session: ClientUploadSession;
  asset?: ClientMediaAsset | null;
  transfer?: ClientTransfer | null;
}

export function clientState(session: ClientUploadSession, asset?: ClientMediaAsset | null): ClientUploadState {
  if (session.state === "cancelling") return "cancelling";
  if (["rejected", "failed", "deleted"].includes(asset?.state ?? "") || ["failed", "expired", "cancelled"].includes(session.state)) return "error";
  if (asset?.state === "ready") return "done";
  if (session.state === "provisioning") return "pending";
  if (session.state === "uploading") return "uploading";
  if (session.state === "paused") return "paused";
  if (session.state === "uploaded" || ["received", "validating", "processing"].includes(asset?.state ?? "")) return "processing";
  return "pending";
}

export function sameSource(session: Pick<ClientUploadSession, "source_sha256" | "expected_input_bytes">, sha256: string, bytes: number): boolean {
  return /^[a-f0-9]{64}$/.test(sha256) && session.source_sha256 === sha256 && session.expected_input_bytes === bytes;
}

// Reordering preserves the role bound to an asset. Exchanging roles after a
// successful upload would make the parent publish the wrong original file.
export function moveQueueItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
