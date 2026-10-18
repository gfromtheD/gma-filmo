import type { ProviderSnapshot, UploadReceipt, JsonObject } from '@/types/media-engine';
import type { PlaybackSource } from '@/types/playback';
import type { MediaProvider, ProviderAssetContext, ProviderPlaybackContext, ProviderUploadContext, DeletionObservation } from '../provider';
import { ProviderError, StreamProvider } from '@/lib/uploads/stream';
import { FutureManagedVideoProvider } from '@/lib/uploads/future-managed-video';
import { legacySession } from './legacy-context';

const VIDEO_ROLES = ['main', 'trailer', 'extras', 'intro'] as const;

export class StreamMediaProvider implements MediaProvider {
  readonly key = 'stream' as const;
  readonly capabilities = { roles: VIDEO_ROLES, processing: 'managed' as const, retry: 'replacement-required' as const };

  constructor(private readonly stream: StreamProvider) {}

  async provisionUpload(context: ProviderUploadContext) {
    const s = legacySession(context.session, 'stream');
    const transfer = await new FutureManagedVideoProvider(this.stream).createUpload(s);
    const privateState: JsonObject = { uploadUrl: ('uploadUrl' in transfer ? transfer.uploadUrl : null) ?? null, expiresAt: transfer.expiresAt };
    return { uploadId: transfer.providerRef, providerMediaId: transfer.providerRef, privateState };
  }

  async recoverUpload(context: ProviderUploadContext) {
    const s = legacySession(context.session, 'stream');
    const providerMediaId = s.provider_ref ?? await this.stream.recover(s);
    if (!providerMediaId) return null;
    return { uploadId: providerMediaId, providerMediaId, privateState: context.privateState };
  }

  async getTransfer(context: ProviderUploadContext) {
    const url = context.privateState.uploadUrl;
    const expiresAt = context.privateState.expiresAt;
    if (typeof url !== 'string' || typeof expiresAt !== 'string') throw new ProviderError('UPLOAD_PROVISION_PENDING');
    this.stream.assertTransferUrl(url);
    return { protocol: 'tus' as const, url, chunkSize: 8 * 1024 * 1024, expiresAt };
  }

  async inspectUpload(context: ProviderUploadContext): Promise<UploadReceipt> {
    const s = legacySession(context.session, 'stream');
    const receivedBytes = await this.stream.received(s);
    if (receivedBytes !== s.expected_input_bytes || !s.provider_ref) throw new ProviderError('UPLOAD_NOT_COMPLETE');
    return { complete: true, receivedBytes, sourceSha256: null, identity: 'provider-receipt', providerMediaId: s.provider_ref,
      proof: { kind: 'stream-receipt', uid: s.provider_ref, receivedBytes, inspectedAt: new Date(context.clock.now()).toISOString() } };
  }

  completeUpload(context: ProviderUploadContext): Promise<UploadReceipt> { return this.inspectUpload(context); }

  async cancelUpload(context: ProviderUploadContext): Promise<DeletionObservation> {
    const s = legacySession(context.session, 'stream');
    if (!s.provider_ref) return { absent: false, writesRevoked: false, safeAfter: s.expires_at };
    const absent = await this.stream.delete(s.provider_ref);
    return { absent, writesRevoked: absent, safeAfter: absent ? null : s.expires_at };
  }

  async inspectAsset(context: ProviderAssetContext): Promise<ProviderSnapshot> {
    const s = legacySession(context.session, 'stream');
    if (!s.provider_ref) return { status: 'unknown', durationSeconds: null, receivedBytes: null, metadata: {}, playbackVerified: false, error: null };
    const observed = await this.stream.observe(s.provider_ref);
    const status = !observed.found ? 'absent' : observed.state === 'rejected' ? 'failed' : observed.state;
    return { status, durationSeconds: observed.durationSeconds, receivedBytes: context.asset.received_bytes??observed.receivedBytes,
      metadata: { processing_progress: Math.max(0, Math.min(100, observed.processingProgress)), readyToStream: observed.readyToStream },
      playbackVerified: observed.found && observed.state === 'ready' && observed.readyToStream,
      error: observed.state === 'rejected' ? { code: 'STREAM_PROCESSING_FAILED', retryable: false } : null };
  }

  async getPlayback(context: ProviderPlaybackContext): Promise<PlaybackSource> {
    const s = legacySession(context.session, 'stream');
    if (!s.provider_ref || !context.asset.duration_seconds) throw new ProviderError('UPLOAD_INVALID_ASSET');
    const playback = this.stream.playback(s.provider_ref, context.asset.duration_seconds);
    const common = { version: 1 as const, mediaId: context.asset.id, titleSlug: context.titleSlug, titleId: context.titleId,
      revision: context.asset.revision, expiresAt: playback.expiresAt, refreshUrl: context.titleSlug
        ? `/api/titles/${encodeURIComponent(context.titleSlug)}/playback` : `/api/media/${context.asset.id}/playback`,
      subtitles: context.subtitles, posterUrl: context.posterUrl, thumbnails: context.thumbnails };
    return { ...common, kind: 'hls', url: playback.url, mimeType: 'application/vnd.apple.mpegurl', p2p: 'none', fallback: context.fallback };
  }

  async getAuxiliaryDelivery(): Promise<{ url: string; mimeType: string; expiresAt: number | null }> {
    throw new ProviderError('UPLOAD_PROTOCOL_UNSUPPORTED');
  }

  async deleteAsset(context: ProviderAssetContext): Promise<DeletionObservation> {
    const s = legacySession(context.session, 'stream');
    if (!s.provider_ref) return { absent: false, writesRevoked: false, safeAfter: s.expires_at };
    const absent = await this.stream.delete(s.provider_ref);
    return { absent, writesRevoked: absent, safeAfter: absent ? null : s.expires_at };
  }
}
