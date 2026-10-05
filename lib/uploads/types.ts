export type AssetRole = "main" | "trailer" | "extras" | "intro" | "poster" | "poster_h" | "poster_v" | "subtitles" | "avatar";
export type UploadProvider = "stream" | "r2";
export type TransferState = "provisioning" | "uploading" | "paused" | "uploaded" | "cancelling" | "cancelled" | "expired" | "failed";
export type MediaState = "received" | "validating" | "processing" | "ready" | "rejected" | "deleting" | "deleted";
export interface UploadSession {
  id: string;
  owner_id: string;
  draft_id: string | null;
  asset_id: string;
  role: AssetRole;
  slot: string;
  language: string | null;
  provider: UploadProvider;
  provider_ref: string | null;
  provider_data: Record<string, unknown>;
  expected_input_bytes: number;
  source_sha256: string;
  content_type: string;
  file_name: string;
  max_duration_seconds: number;
  expires_at: string;
  revision: number;
  state: TransferState;
}
export interface MediaAsset {
  id: string;
  owner_id: string;
  provider: UploadProvider;
  provider_ref: string | null;
  state: MediaState;
  role: AssetRole;
  metadata: Record<string, unknown>;
  delivery_path: string | null;
  expected_input_bytes: number;
  received_bytes: number | null;
  provider_reported_size: number | null;
  duration_seconds: number | null;
}
export interface ProvisionedUpload { providerRef: string; uploadUrl: string; expiresAt: string }
export interface VideoObservation {
  found: boolean;
  state: "pending" | "processing" | "ready" | "rejected";
  readyToStream: boolean;
  processingProgress: number;
  durationSeconds: number | null;
  providerReportedSize: number | null;
  receivedBytes: number | null;
}
export interface VerifiedAuxiliary {
  providerRef: string;
  storageKey: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  width: number | null;
  height: number | null;
}
export interface UploadDraft {
  id: string; owner_id: string; purpose: "title" | "avatar";
  state: "draft" | "published" | "abandoned"; revision: number;
  metadata: Record<string, unknown>; title_id: number | null;
}
export interface UploadJob {
  id: string; kind: "provision" | "verify" | "delete" | "reconcile";
  session_id: string | null; payload: Record<string, unknown>;
  attempts: number; lease_owner: string | null; lease_until: string | null;
}
