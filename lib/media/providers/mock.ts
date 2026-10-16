import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { normalizeSubtitles, normalizeImage } from '../auxiliary-validation';
import { createReadStream } from 'node:fs';
import { MediaError } from '../errors';
import type { JsonObject, ProviderSnapshot, UploadReceipt, TransferDescriptor } from '@/types/media-engine';
import type { PlaybackSource } from '@/types/playback';
import type { MediaCapabilityIssuer, MediaProvider, ProviderAssetContext, ProviderPlaybackContext, ProviderUploadContext, DeletionObservation } from '../provider';
import { MockMediaStorage } from '../mock-storage';

export interface MockChunkRepository {
  transferChunks?(id:string,generation:number):Promise<Array<{start_byte:number;end_byte:number;sha256:string;writer_fence:number}>>;
  commitChunk(ownerId: string, input: {
    sessionId: string; generation: number; writer: string; fence: number;
    startByte: number; endByte: number; sha256: string; storageRelative: string; upstreamConfirmed: boolean;
  }): Promise<unknown>;
}

export class MockMediaProvider implements MediaProvider {
  readonly key = 'mock' as const;
  readonly capabilities = { roles: ['main','trailer','extras','intro','poster','poster_h','poster_v','subtitles','avatar'] as const,
    processing: 'local' as const, retry: 'local-job' as const };

  constructor(private readonly storage: MockMediaStorage, private readonly repository: MockChunkRepository,
    private readonly gatewayUrl = 'http://127.0.0.1:4319', private readonly issuer?:MediaCapabilityIssuer) {}

  private async offset(context:ProviderUploadContext){
    return this.repository.transferChunks?this.storage.recoverCommitted(context.session.id,context.transferGeneration,await this.repository.transferChunks(context.session.id,context.transferGeneration))
      :this.storage.offset(context.session.id,context.transferGeneration);
  }

  async provisionUpload(context: ProviderUploadContext) {
    const uploadId = `mock:${context.session.id}`;
    return { uploadId, providerMediaId: null,
      privateState: { uploadId, assetId: context.asset.id, generation: context.transferGeneration, state: 'receiving' } satisfies JsonObject };
  }

  async recoverUpload(context: ProviderUploadContext) {
    const expectedUploadId = `mock:${context.session.id}`;
    const stored = context.privateState.uploadId;
    if (stored !== undefined && stored !== expectedUploadId) throw new MediaError('IDEMPOTENCY_CONFLICT');
    await this.offset(context);
    return { uploadId: expectedUploadId, providerMediaId: null, privateState: { ...context.privateState, uploadId: expectedUploadId } };
  }

  async getTransfer(context: ProviderUploadContext): Promise<TransferDescriptor> {
    const offset = await this.offset(context);
    const grant=this.issuer?.issue({sessionId:context.session.id,assetId:context.asset.id,generation:context.transferGeneration,scope:'upload',method:'PUT',namespace:`transfer/${context.session.id}/${context.transferGeneration}/`,expectedBytes:context.session.expected_input_bytes,ttlSeconds:900});
    const headers:Record<string,string>=grant?{Authorization:`Bearer ${grant.token}`}:{},expiresAt=grant?new Date(grant.expiresAt).toISOString():context.session.expires_at;
    if (context.session.max_duration_seconds === 0) return { protocol:'put' as const,url:`${this.gatewayUrl}/auxiliary/${context.session.id}`,headers:{...headers,'Content-Type':context.session.content_type},expiresAt };
    return { protocol: 'uploadx' as const, url: `${this.gatewayUrl}/transfer/${context.session.id}`,
      headers, chunkSize: 8 * 1024 * 1024, offset: offset.offset, totalBytes: context.session.expected_input_bytes,
      expiresAt };
  }

  async writeChunk(context: ProviderUploadContext, input: { startByte: number; endByte: number; sha256: string; bytes: Uint8Array }): Promise<number> {
    const session = context.session;
    const fence = session.transfer_fence;
    const writer = session.transfer_lease_owner;
    if (!writer || !Number.isSafeInteger(fence) || fence < 1) throw new MediaError('UPLOAD_REVISION_CONFLICT');
    const storageRelative = `transfer/${session.id}/${context.transferGeneration}/chunks/${input.startByte}-${input.endByte}-${input.sha256}.bin`;
    const offset = await this.storage.writeChunk({ sessionId: session.id, assetId: session.asset_id,
      generation: context.transferGeneration, fence, startByte: input.startByte, endByte: input.endByte,
      expectedBytes: session.expected_input_bytes, sha256: input.sha256, bytes: input.bytes },async()=>{
        await this.repository.commitChunk(session.owner_id, { sessionId: session.id, generation: context.transferGeneration,
          writer, fence, startByte: input.startByte, endByte: input.endByte, sha256: input.sha256, storageRelative, upstreamConfirmed: true });
      });
    return offset;
  }

  async inspectUpload(context: ProviderUploadContext): Promise<UploadReceipt> {
    if((await this.offset(context)).offset!==context.session.expected_input_bytes)throw new MediaError('UPLOAD_NOT_COMPLETE');
    const receipt = await this.storage.complete(context.session.id, context.asset.id, context.transferGeneration,
      context.session.expected_input_bytes, context.session.source_sha256);
    return { complete: true, receivedBytes: receipt.size, sourceSha256: receipt.sha256, identity: 'sha256', providerMediaId: null,
      proof: { kind: 'mock-sha256', size: receipt.size, sha256: receipt.sha256,
        transferGeneration: context.transferGeneration, chunkManifestHash: receipt.chunkManifestHash } };
  }

  completeUpload(context: ProviderUploadContext): Promise<UploadReceipt> { return this.inspectUpload(context); }

  async cancelUpload(context: ProviderUploadContext): Promise<DeletionObservation> {
    await this.storage.cancel(context.session.id, context.transferGeneration);
    return { absent: true, writesRevoked: true, safeAfter: null };
  }

  async inspectAsset(context: ProviderAssetContext): Promise<ProviderSnapshot> {
    const status = context.asset.state;
    const allowed: ProviderSnapshot['status'] = status === 'ready' ? 'ready' : status === 'processing' ? 'processing'
      : status === 'failed' ? 'failed' : status === 'rejected' ? 'rejected' : status === 'deleted' ? 'absent' : 'pending';
    return { status: allowed, durationSeconds: context.asset.duration_seconds, receivedBytes: context.asset.received_bytes,
      metadata: context.asset.metadata, playbackVerified: status === 'ready' && context.asset.delivery_path !== null,
      error: context.asset.error_code ? { code: context.asset.error_code, retryable: context.asset.error_retryable } : null };
  }

  async validateAsset(context: ProviderAssetContext): Promise<ProviderSnapshot> {
    if (context.session.max_duration_seconds > 0) return this.inspectAsset(context);
    const receipt=await this.storage.complete(context.session.id,context.asset.id,context.transferGeneration,context.session.expected_input_bytes,context.session.source_sha256);
    const source=await readFile(receipt.filePath);
    const normalized=context.session.role==='subtitles' ? {data:normalizeSubtitles(source),mimeType:'text/vtt',width:null,height:null}
      : await normalizeImage(source,context.session.role);
    const relative=context.session.role==='subtitles'?'subtitles.vtt':'poster.webp';
    await this.storage.installOutput(context.asset.id,context.processingGeneration,relative,normalized.data);
    return {status:'ready',durationSeconds:null,receivedBytes:receipt.size,playbackVerified:true,error:null,metadata:{
      source_sha256:receipt.sha256,normalized_bytes:normalized.data.length,mime:normalized.mimeType,width:normalized.width,height:normalized.height,
      auxiliary_file:relative,hls_prefix:`mock/${context.asset.id}/${context.processingGeneration}/`,
      outputs:[{relative,bytes:normalized.data.length,mime:normalized.mimeType}],normalized_sha256:createHash('sha256').update(normalized.data).digest('hex') } };
  }

  async getPlayback(context: ProviderPlaybackContext): Promise<PlaybackSource> {
    const relative = typeof context.asset.metadata.hls_master === 'string' ? context.asset.metadata.hls_master : null;
    if (context.asset.state !== 'ready' || !relative) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const grant=this.issuer?.issue({sessionId:context.session.id,assetId:context.asset.id,generation:context.processingGeneration,scope:'playback',method:'GET',namespace:`asset/${context.asset.id}/${context.processingGeneration}/`,expectedBytes:context.asset.expected_input_bytes,ttlSeconds:300});
    const common = { version: 1 as const, mediaId: context.asset.id, titleSlug: context.titleSlug, titleId: context.titleId,
      revision: context.asset.revision, expiresAt: grant?.expiresAt??null, refreshUrl: context.titleSlug
        ? `/api/titles/${encodeURIComponent(context.titleSlug)}/playback` : `/api/media/${context.asset.id}/playback`,
      subtitles: context.subtitles, posterUrl: context.posterUrl, thumbnails: context.thumbnails };
    return { ...common, kind: 'hls', url: `${this.gatewayUrl}/playback/${context.asset.id}/${context.processingGeneration}/${relative}${grant?'?cap='+encodeURIComponent(grant.token):''}`,
      mimeType: 'application/vnd.apple.mpegurl', p2p: 'none', fallback: context.fallback };
  }

  async getAuxiliaryDelivery(context: ProviderAssetContext) {
    const relative = typeof context.asset.metadata.auxiliary_file === 'string' ? context.asset.metadata.auxiliary_file : null;
    if (!relative) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const mimeType = typeof context.asset.metadata.mime === 'string' ? context.asset.metadata.mime : 'application/octet-stream';
    const grant=this.issuer?.issue({sessionId:context.session.id,assetId:context.asset.id,generation:context.processingGeneration,scope:'auxiliary',method:'GET',namespace:`asset/${context.asset.id}/${context.processingGeneration}/`,expectedBytes:context.asset.expected_input_bytes,ttlSeconds:300});
    return { url: `${this.gatewayUrl}/playback/${context.asset.id}/${context.processingGeneration}/${relative}${grant?'?cap='+encodeURIComponent(grant.token):''}`, mimeType, expiresAt: grant?.expiresAt??null };
  }

  async deleteAsset(context: ProviderAssetContext): Promise<DeletionObservation> {
    if (context.privateState.mockScenario === 'delete-pending-once'
      && await this.storage.claimScenarioOnce(context.session.id, 'delete-pending-once')) {
      return { absent: false, writesRevoked: true, safeAfter: context.session.expires_at };
    }
    await this.storage.cancel(context.session.id, context.processingGeneration);
    await this.storage.delete(context.session.id, context.asset.id);
    return { absent: true, writesRevoked: true, safeAfter: null };
  }

  async getPartTransfer(): Promise<never> { throw new MediaError('UPLOAD_PROTOCOL_UNSUPPORTED'); }

  async hashOriginal(context: ProviderUploadContext): Promise<string> {
    const receipt = await this.storage.complete(context.session.id, context.asset.id, context.transferGeneration,
      context.session.expected_input_bytes, context.session.source_sha256);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(receipt.filePath)) hash.update(chunk);
    return hash.digest('hex');
  }
}
