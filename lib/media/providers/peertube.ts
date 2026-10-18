import { z } from 'zod';
import type { ProviderSnapshot, UploadReceipt, JsonObject } from '@/types/media-engine';
import type { PlaybackSource } from '@/types/playback';
import type { MediaCapabilityIssuer, MediaProvider, ProviderAssetContext, ProviderPlaybackContext, ProviderUploadContext, DeletionObservation } from '../provider';
import { MediaError } from '../errors';
import { PeerTubeClient } from './peertube-client';
import { mapPeerTubeState } from './peertube-mapping';
import { rewritePeerTubeManifest } from '../gateway/hls';

export interface PeerTubeGatewayReceiptLookup {
  get(context: ProviderUploadContext): Promise<UploadReceipt | null>;
}
const proofSchema = z.object({ kind: z.literal('peertube-gateway'), uploadId: z.string().min(1), videoUUID: z.string().uuid(), totalBytes: z.number().int().positive(),
  upstreamReceivedBytes: z.number().int().nonnegative(), gmaSha256: z.string().regex(/^[a-f0-9]{64}$/), correlationName: z.string().min(1), finalizingAt: z.string().datetime() }).strict();

const VIDEO_EXTENSIONS: Readonly<Record<string, string>> = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv', 'video/webm': '.webm' };

/** PeerTube validates the extension of `filename`; the user's own file name is never forwarded. */
export function videoExtension(contentType: string): string {
  const [mime = ''] = contentType.split(';');
  return VIDEO_EXTENSIONS[mime.trim().toLowerCase()] ?? '.mp4';
}

/** PeerTube is an upstream engine only; playback is always addressed through the GMA gateway. */
export class PeerTubeMediaProvider implements MediaProvider {
  readonly key = 'peertube' as const;
  readonly capabilities = { roles: ['main','trailer','extras','intro'] as const, processing: 'managed' as const, retry: 'observe-only' as const };
  private readonly gatewayOrigin: URL;

  constructor(private readonly client: PeerTubeClient, private readonly gatewayUrl: string,
    private readonly issuer: MediaCapabilityIssuer, private readonly receipts: PeerTubeGatewayReceiptLookup) {
    this.gatewayOrigin = new URL(gatewayUrl);
    if (!['http:', 'https:'].includes(this.gatewayOrigin.protocol) || this.gatewayOrigin.username || this.gatewayOrigin.password) throw new MediaError('UPLOAD_INVALID_INPUT');
  }

  async provisionUpload(context: ProviderUploadContext) {
    const correlationName = `gma-${context.asset.id}-a${context.transferGeneration}`;
    const binding = await this.client.createResumableUpload({ name: correlationName, description: `GMA correlation ${correlationName}`,
      channelId: this.client.channelId, totalBytes: context.session.expected_input_bytes, contentType: context.session.content_type,
      filename: `${correlationName}${videoExtension(context.session.content_type)}` });
    const privateState: JsonObject = { uploadId: binding.uploadId, uploadLocation: binding.location, correlationName, state: 'receiving' };
    return { uploadId: binding.uploadId, providerMediaId: null, privateState };
  }

  async recoverUpload(context: ProviderUploadContext) {
    const location = context.privateState.uploadLocation; const uploadId = context.privateState.uploadId;
    if (typeof location !== 'string' || typeof uploadId !== 'string') return null;
    const expected = `gma-${context.asset.id}-a${context.transferGeneration}`;
    if (context.privateState.correlationName !== expected) throw new MediaError('IDEMPOTENCY_CONFLICT');
    return { uploadId, providerMediaId: typeof context.privateState.videoUUID === 'string' ? context.privateState.videoUUID : null, privateState: context.privateState };
  }

  async getTransfer(context: ProviderUploadContext) {
    const uploadId = context.privateState.uploadId;
    const location = context.privateState.uploadLocation;
    if (typeof uploadId !== 'string' || typeof location !== 'string') throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    let offset: number;
    try {
      const upstream = await this.client.queryUploadOffset(location, context.session.expected_input_bytes);
      const range = upstream.range ? /^bytes=0-(\d+)$/.exec(upstream.range) : null;
      if (upstream.range && !range) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
      offset = upstream.status === 200 ? context.session.expected_input_bytes : range ? Number(range[1]) + 1 : 0;
    } catch (error) {
      if (!(error instanceof MediaError) || error.code !== 'UPLOAD_NOT_FOUND') throw error;
      const receipt = await this.finalReceipt(context);
      if (!receipt.providerMediaId || !(await this.client.getVideo(receipt.providerMediaId))) throw new MediaError('UPLOAD_NOT_COMPLETE');
      offset = context.session.expected_input_bytes;
    }
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > context.session.expected_input_bytes) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    const grant=this.issuer.issue({sessionId:context.session.id,assetId:context.asset.id,generation:context.transferGeneration,scope:'upload',method:'PUT',namespace:`transfer/${context.session.id}/${context.transferGeneration}/`,expectedBytes:context.session.expected_input_bytes,ttlSeconds:900});
    return { protocol: 'uploadx' as const, url: `${this.gatewayOrigin.origin}/transfer/${context.session.id}`,
      headers: {Authorization:`Bearer ${grant.token}`}, chunkSize: 8 * 1024 * 1024, offset, totalBytes: context.session.expected_input_bytes, expiresAt: new Date(grant.expiresAt).toISOString() };
  }

  private async finalReceipt(context: ProviderUploadContext): Promise<UploadReceipt> {
    const receipt = await this.receipts.get(context);
    const proof = receipt ? proofSchema.safeParse(receipt.proof) : null;
    if (!receipt?.complete || receipt.receivedBytes !== context.session.expected_input_bytes || !proof?.success
      || receipt.identity !== 'sha256' || receipt.sourceSha256 !== context.session.source_sha256
      || receipt.providerMediaId !== proof.data.videoUUID || proof.data.uploadId !== context.privateState.uploadId
      || proof.data.totalBytes !== context.session.expected_input_bytes || proof.data.upstreamReceivedBytes !== context.session.expected_input_bytes
      || proof.data.gmaSha256 !== context.session.source_sha256 || proof.data.correlationName !== `gma-${context.asset.id}-a${context.transferGeneration}`) {
      throw new MediaError('UPLOAD_NOT_COMPLETE');
    }
    return receipt;
  }

  async inspectUpload(context: ProviderUploadContext): Promise<UploadReceipt> {
    const location = context.privateState.uploadLocation;
    if (typeof location !== 'string') throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    try {
      const upstream = await this.client.queryUploadOffset(location, context.session.expected_input_bytes);
      const match = upstream.range ? /^bytes=0-(\d+)$/.exec(upstream.range) : null;
      if (upstream.range && !match) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
      const received = upstream.status === 200 ? context.session.expected_input_bytes : match ? Number(match[1]) + 1 : 0;
      if (received !== context.session.expected_input_bytes) throw new MediaError('UPLOAD_NOT_COMPLETE');
    } catch (error) {
      if (!(error instanceof MediaError) || error.code !== 'UPLOAD_NOT_FOUND') throw error;
      // uploadx may retire the Location after finalization. A missing lease is never proof of completion.
      const receipt = await this.finalReceipt(context);
      if (!receipt.providerMediaId || !(await this.client.getVideo(receipt.providerMediaId))) throw new MediaError('UPLOAD_NOT_COMPLETE');
      return receipt;
    }
    return this.finalReceipt(context);
  }

  completeUpload(context: ProviderUploadContext): Promise<UploadReceipt> { return this.inspectUpload(context); }

  async cancelUpload(context: ProviderUploadContext): Promise<DeletionObservation> {
    const location = context.privateState.uploadLocation;
    if (typeof location !== 'string') return { absent: false, writesRevoked: false, safeAfter: context.session.expires_at };
    const absent = await this.client.cancelUpload(location);
    return { absent, writesRevoked: absent, safeAfter: absent ? null : context.session.expires_at };
  }

  async inspectAsset(context: ProviderAssetContext): Promise<ProviderSnapshot> {
    const videoUUID = context.asset.provider_ref ?? (typeof context.privateState.videoUUID === 'string' ? context.privateState.videoUUID : null);
    if (!videoUUID) return { status: 'pending', durationSeconds: null, receivedBytes: context.asset.received_bytes, metadata: {}, playbackVerified: false, error: null };
    const video = await this.client.getVideo(videoUUID);
    if (!video) return { status: 'absent', durationSeconds: null, receivedBytes: context.asset.received_bytes, metadata: {}, playbackVerified: false, error: null };
    const mapped = mapPeerTubeState(video.stateId);
    let validHls = false;
    if (video.streamingPlaylists.length > 0) {
      try { this.client.validatePlaylistReference(video.streamingPlaylists[0]!.playlistUrl); validHls = true; }
      catch { validHls = false; }
    }
    let verifiedReceipt = false;
    if (mapped.status === 'published' && validHls) {
      const receipt = await this.receipts.get(context);
      const proof = receipt ? proofSchema.safeParse(receipt.proof) : null;
      verifiedReceipt = Boolean(receipt?.complete && receipt.providerMediaId === video.uuid && receipt.receivedBytes === context.session.expected_input_bytes
        && proof?.success && proof.data.videoUUID === video.uuid && proof.data.totalBytes === context.session.expected_input_bytes);
    }
    const ready = mapped.status === 'published' && video.duration > 0 && video.duration <= context.session.max_duration_seconds && validHls && verifiedReceipt;
    const status: ProviderSnapshot['status'] = ready ? 'ready' : mapped.status === 'published' ? 'processing'
      : mapped.status === 'unknown' ? 'unknown' : mapped.status;
    return { status, durationSeconds: video.duration || null, receivedBytes: context.asset.received_bytes,
      metadata: { peertube_state_id: video.stateId, hls_playlist_count: video.streamingPlaylists.length, hls_reference_valid: validHls },
      playbackVerified: ready, error: mapped.code ? { code: mapped.code, retryable: mapped.retryable } : null };
  }

  async getPlayback(context: ProviderPlaybackContext): Promise<PlaybackSource> {
    if (!context.asset.provider_ref || context.asset.state !== 'ready') throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const video = await this.client.getVideo(context.asset.provider_ref);
    if (!video || mapPeerTubeState(video.stateId).status !== 'published' || video.duration <= 0 || video.streamingPlaylists.length === 0) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    this.client.validatePlaylistReference(video.streamingPlaylists[0]!.playlistUrl);
    const receipt = await this.receipts.get(context);
    const proof = receipt ? proofSchema.safeParse(receipt.proof) : null;
    if (!receipt?.complete || !proof?.success || proof.data.videoUUID !== video.uuid) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const namespace = `asset/${context.asset.id}/${context.processingGeneration}/`;
    const capability = this.issuer.issue({ sessionId: context.session.id, assetId: context.asset.id, generation: context.processingGeneration,
      scope: 'playback', method: 'GET', namespace, expectedBytes: context.asset.expected_input_bytes, ttlSeconds: 300 });
    const common = { version: 1 as const, mediaId: context.asset.id, titleSlug: context.titleSlug, titleId: context.titleId,
      revision: context.asset.revision, expiresAt: capability.expiresAt, refreshUrl: context.titleSlug
        ? `/api/titles/${encodeURIComponent(context.titleSlug)}/playback` : `/api/media/${context.asset.id}/playback`,
      subtitles: context.subtitles, posterUrl: context.posterUrl, thumbnails: context.thumbnails };
    return { ...common, kind: 'hls', url: `${this.gatewayOrigin.origin}/playback/${context.asset.id}/${context.processingGeneration}/master.m3u8?cap=${encodeURIComponent(capability.token)}`,
      mimeType: 'application/vnd.apple.mpegurl', p2p: 'none', fallback: context.fallback };
  }

  /** Prepared delivery hook for the VPS gateway; the local gateway remains Mock-only. */
  rewriteHlsManifest(bytes: Uint8Array, playlistReference: string, assetId: string, generation: number, token: string, namespaceReference = playlistReference): Buffer {
    return rewritePeerTubeManifest(bytes, playlistReference, this.client, `/playback/${assetId}/${generation}/`, token, namespaceReference);
  }

  async getAuxiliaryDelivery(): Promise<{ url: string; mimeType: string; expiresAt: number | null }> { throw new MediaError('UPLOAD_PROTOCOL_UNSUPPORTED'); }

  private cleanupUUID(receipt:UploadReceipt|null,context:ProviderUploadContext):string|null {
    if(!receipt)return null;const parsed=proofSchema.safeParse(receipt.proof);
    if(!receipt.complete || receipt.identity!=='sha256' || receipt.sourceSha256!==context.session.source_sha256 || receipt.receivedBytes!==context.session.expected_input_bytes
      || !parsed.success || parsed.data.videoUUID!==receipt.providerMediaId || parsed.data.uploadId!==context.privateState.uploadId
      || parsed.data.correlationName!==`gma-${context.asset.id}-a${context.transferGeneration}` || parsed.data.gmaSha256!==context.session.source_sha256
      || parsed.data.totalBytes!==context.session.expected_input_bytes || parsed.data.upstreamReceivedBytes!==context.session.expected_input_bytes)throw new MediaError('UPLOAD_CLEANUP_UNCONFIRMED');
    return parsed.data.videoUUID;
  }
  async deleteAsset(context: ProviderAssetContext): Promise<DeletionObservation> {
    const videoUUID = context.asset.provider_ref ?? (typeof context.privateState.videoUUID === 'string' ? context.privateState.videoUUID : null);
    if (videoUUID) {
      const absent = await this.client.deleteVideo(videoUUID);
      return { absent, writesRevoked: absent, safeAfter: absent ? null : context.session.expires_at };
    }
    const before=await this.receipts.get(context);
    const beforeUUID=this.cleanupUUID(before,context);
    if(beforeUUID){const absent=await this.client.deleteVideo(beforeUUID);return {absent,writesRevoked:absent,safeAfter:null};}
    const cancelled=await this.cancelUpload(context);const late=await this.receipts.get(context);
    const lateUUID=this.cleanupUUID(late,context);
    if(lateUUID){const absent=await this.client.deleteVideo(lateUUID);return {absent,writesRevoked:absent,safeAfter:null};}
    // Cancel may race the last PUT: the old writer then correctly loses its SQL lease and cannot save its UUID.
    // Recovery is cleanup-only and requires the durable full-SHA checkpoint written BEFORE that PUT.
    if(context.privateState.finalization_pending===true) {
      const checkpoint=z.object({uploadId:z.string().min(1),uploadLocation:z.string().url(),correlationName:z.string(),
        localOffset:z.number().int().positive(),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),finalizingAt:z.string().datetime()}).passthrough().safeParse(context.privateState);
      if(!cancelled.writesRevoked || !checkpoint.success || checkpoint.data.localOffset!==context.session.expected_input_bytes
        || checkpoint.data.sourceSha256!==context.session.source_sha256 || checkpoint.data.correlationName!==`gma-${context.asset.id}-a${context.transferGeneration}`
        || new URL(checkpoint.data.uploadLocation).searchParams.get('upload_id')!==checkpoint.data.uploadId
        || Date.parse(checkpoint.data.finalizingAt)>context.clock.now()+30_000) {
        return {absent:false,writesRevoked:cancelled.writesRevoked,safeAfter:context.session.expires_at};
      }
      const recovered=await this.client.recoverVideoByCorrelation(checkpoint.data.correlationName);
      if(!recovered)return {absent:false,writesRevoked:true,safeAfter:context.session.expires_at};
      const absent=await this.client.deleteVideo(recovered);
      return {absent,writesRevoked:absent,safeAfter:absent?null:context.session.expires_at};
    }
    return cancelled;
  }
}
