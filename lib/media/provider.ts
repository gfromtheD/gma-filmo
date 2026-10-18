import type {
  AssetRole,
  JsonObject,
  MediaPlaybackContext,
  MediaProviderKey,
  MediaProof,
  ProviderSnapshot,
  TransferDescriptor,
  UploadReceipt,
  UploadSessionRow,
  MediaAssetRow,
} from '@/types/media-engine';
import type { PlaybackSource } from '@/types/playback';

export interface MediaProviderCapabilities {
  roles: readonly AssetRole[];
  processing: 'local' | 'managed';
  retry: 'local-job' | 'observe-only' | 'replacement-required';
}

export interface ProviderClock {
  now(): number;
}

export interface ProviderUploadContext {
  session: UploadSessionRow;
  asset: MediaAssetRow;
  privateState: JsonObject;
  correlationId: string;
  transferGeneration: number;
  expectedAssetRevision: number;
  signal: AbortSignal;
  clock: ProviderClock;
}

export interface ProviderAssetContext extends ProviderUploadContext {
  processingGeneration: number;
}

export interface ProviderPlaybackContext extends ProviderAssetContext, MediaPlaybackContext {}

export interface ProviderBinding {
  uploadId: string;
  providerMediaId: string | null;
  privateState: JsonObject;
}

/** `absent=false` means unknown or still present; it never means deletion succeeded. */
export interface DeletionObservation {
  absent: boolean;
  writesRevoked: boolean;
  safeAfter: string | null;
}

export interface AuxiliaryDelivery {
  url: string;
  mimeType: string;
  expiresAt: number | null;
}

export interface PartTransferDescriptor {
  number: number;
  size: number;
  url: string;
  expiresAt: string;
}

export interface MediaCapabilityInput {
  sessionId: string;
  assetId: string;
  generation: number;
  scope: 'upload' | 'playback' | 'auxiliary';
  method: 'PUT' | 'GET';
  namespace: string;
  expectedBytes: number;
  ttlSeconds: number;
}

/** Implemented by the server capability signer; provider tests inject a non-secret double. */
export interface MediaCapabilityIssuer {
  issue(input: MediaCapabilityInput): { token: string; expiresAt: number };
}

export interface MediaProvider {
  readonly key: MediaProviderKey;
  readonly capabilities: MediaProviderCapabilities;

  provisionUpload(context: ProviderUploadContext): Promise<ProviderBinding>;
  recoverUpload(context: ProviderUploadContext): Promise<ProviderBinding | null>;
  getTransfer(context: ProviderUploadContext): Promise<TransferDescriptor>;
  inspectUpload(context: ProviderUploadContext): Promise<UploadReceipt>;
  completeUpload(context: ProviderUploadContext): Promise<UploadReceipt>;
  cancelUpload(context: ProviderUploadContext): Promise<DeletionObservation>;
  inspectAsset(context: ProviderAssetContext): Promise<ProviderSnapshot>;
  validateAsset?(context: ProviderAssetContext): Promise<ProviderSnapshot>;
  getPlayback(context: ProviderPlaybackContext): Promise<PlaybackSource>;
  getAuxiliaryDelivery(context: ProviderAssetContext): Promise<AuxiliaryDelivery>;
  deleteAsset(context: ProviderAssetContext): Promise<DeletionObservation>;
  readAuxiliary?(context:ProviderAssetContext):Promise<{bytes:Uint8Array;mimeType:'text/vtt'|'image/webp'}>;
  deliverHls?(context:ProviderAssetContext,relative:string,output:{key:string;mimeType:string|null;sizeBytes:number|null}):Promise<Response>;
  getParts?(context: ProviderUploadContext): Promise<{parts:Array<{number:number;size:number;etag:string}>;complete:boolean;receivedBytes:number;partSize:number;generation:number}>;
  maintainAsset?(context: ProviderAssetContext): Promise<void>;
  getPartTransfer?(context: ProviderUploadContext, number: number): Promise<PartTransferDescriptor>;
}

export type ProviderProof = MediaProof;
