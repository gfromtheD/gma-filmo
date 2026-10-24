import {hlsObject,rewritePlaylist} from '@/lib/uploads/hls-delivery';
import {safeMediaPath} from '@/lib/uploads/video-processing';
import { createHash } from 'node:crypto';
import type { UploadReceipt, ProviderSnapshot, JsonObject } from '@/types/media-engine';
import type { PlaybackSource } from '@/types/playback';
import type { MediaCapabilityIssuer, MediaProvider, ProviderAssetContext, ProviderPlaybackContext, ProviderUploadContext, DeletionObservation } from '../provider';
import { R2VideoProvider } from '@/lib/uploads/r2-video';
import { AuxiliaryProvider } from '@/lib/uploads/auxiliary';
import { ProviderError } from '@/lib/uploads/stream';
import { legacySession } from './legacy-context';

const VIDEO_ROLES = new Set(['main', 'trailer', 'extras', 'intro']);
const deletionPending = (safeAfter: string): DeletionObservation => ({ absent: false, writesRevoked: false, safeAfter });

export class R2MediaProvider implements MediaProvider {
  readonly key = 'r2' as const;
  readonly capabilities = { roles: ['main','trailer','extras','extra_image','intro','poster','poster_h','poster_v','subtitles','avatar','banner'] as const, processing: 'local' as const, retry: 'local-job' as const };

  /**
   * `relay`: con pasarela, imágenes y subtítulos se suben a ella (ver gateway/r2-relay.ts), no directamente a R2, cuyas IP
   * bloquean los operadores españoles durante los partidos de LaLiga. Sin ella, se sube a la URL firmada de R2 como antes.
   */
  constructor(private readonly video: R2VideoProvider, private readonly auxiliary: AuxiliaryProvider,
    private readonly relay?: { gatewayUrl: string; issuer: MediaCapabilityIssuer }) {}

  private session(context: ProviderUploadContext) {
    const session = legacySession(context.session, 'r2'); const state = context.privateState;
    return { ...session, provider_ref: session.provider_ref ?? (typeof state.providerRef === 'string' ? state.providerRef : null),
      multipart_upload_id: session.multipart_upload_id ?? (typeof state.multipartUploadId === 'string' ? state.multipartUploadId : null),
      part_size: typeof state.partSize === 'number' ? state.partSize : session.part_size,
      provider_data: { ...session.provider_data, ...state } };
  }
  async provisionUpload(context: ProviderUploadContext) {
    const session = this.session(context);
    if (VIDEO_ROLES.has(session.role)) {
      const transfer = await this.video.createUpload(session);
      const privateState: JsonObject = { providerRef: transfer.providerRef, multipartUploadId: transfer.multipartUploadId ?? null,
        partSize: transfer.partSize ?? null, expiresAt: transfer.expiresAt };
      return { uploadId: transfer.multipartUploadId ?? transfer.providerRef, providerMediaId: null, privateState };
    }
    const transfer = await this.auxiliary.transfer(session);
    const privateState: JsonObject = { providerRef: transfer.providerRef, uploadUrl: transfer.uploadUrl, expiresAt: transfer.expiresAt };
    return { uploadId: transfer.providerRef, providerMediaId: null, privateState };
  }

  async recoverUpload(context: ProviderUploadContext) {
    const session = this.session(context);
    if (!VIDEO_ROLES.has(session.role)) {
      if (!session.provider_ref) return this.provisionUpload(context);
      return { uploadId: session.provider_ref, providerMediaId: null, privateState: context.privateState };
    }
    const transfer = await this.video.createUpload(session);
    return { uploadId: transfer.multipartUploadId ?? transfer.providerRef, providerMediaId: null,
      privateState: { ...context.privateState, providerRef: transfer.providerRef,
        multipartUploadId: transfer.multipartUploadId ?? null, partSize: transfer.partSize ?? null } };
  }

  async getTransfer(context: ProviderUploadContext) {
    const s = this.session(context);
    if (!VIDEO_ROLES.has(s.role)) {
      const url = context.privateState.uploadUrl;
      const expiresAt = context.privateState.expiresAt;
      if (typeof url !== 'string' || typeof expiresAt !== 'string') throw new ProviderError('UPLOAD_PROVISION_PENDING');
      if (this.relay) {
        const grant = this.relay.issuer.issue({ sessionId: s.id, assetId: context.asset.id, generation: context.transferGeneration, scope: 'upload', method: 'PUT',
          namespace: `transfer/${s.id}/${context.transferGeneration}/`, expectedBytes: s.expected_input_bytes, ttlSeconds: 900 });
        const headers: Record<string, string> = { Authorization: `Bearer ${grant.token}`, 'Content-Type': s.content_type };
        return { protocol: 'put' as const, url: `${new URL(this.relay.gatewayUrl).origin}/auxiliary/${s.id}`, headers, expiresAt: new Date(grant.expiresAt).toISOString() };
      }
      return { protocol: 'put' as const, url, headers: { 'Content-Type': s.content_type }, expiresAt };
    }
    return { protocol: 'multipart' as const, inspectUrl: `/api/uploads/${s.id}/parts`,
      partUrl: `/api/uploads/${s.id}/part`, partSize: Number(s.part_size), generation: s.transfer_generation ?? 1, concurrency: 2 as const };
  }

  async inspectUpload(context: ProviderUploadContext): Promise<UploadReceipt> {
    const s = this.session(context);
    if (!VIDEO_ROLES.has(s.role)) {
      const receipt = await this.auxiliary.inspectReceipt(s);
      return { complete:true,receivedBytes:receipt.size,sourceSha256:null,identity:'provider-receipt',providerMediaId:null,
        proof:{kind:'r2-receipt',size:receipt.size,etag:receipt.etag,objectKey:receipt.key,completedPartsHash:createHash('sha256').update(receipt.key+receipt.etag).digest('hex')} };
    }
    const inspection = await this.video.inspectUpload(s);
    if (!inspection.complete) throw new ProviderError('UPLOAD_NOT_COMPLETE');
    const partsHash = createHash('sha256').update(JSON.stringify(inspection.parts.map(({ number, size, etag }) => ({ number, size, etag })))).digest('hex');
    const etag = inspection.etag ?? 'multipart-incomplete';
    const objectKey = s.object_key;
    if (!objectKey) throw new ProviderError('R2_KEY_INVALID');
    return { complete: inspection.complete, receivedBytes: inspection.receivedBytes,
      sourceSha256: inspection.complete ? s.source_sha256 : null, identity: 'provider-receipt', providerMediaId: null,
      proof: { kind: 'r2-receipt', size: inspection.receivedBytes, etag, objectKey, completedPartsHash: partsHash } };
  }

  async completeUpload(context: ProviderUploadContext): Promise<UploadReceipt> {
    const s = this.session(context);
    if (!VIDEO_ROLES.has(s.role)) return this.inspectUpload(context);
    const inspection = await this.video.completeUpload(s);
    const completedPartsHash = createHash('sha256').update(JSON.stringify(inspection.parts)).digest('hex');
    if (!inspection.etag || !s.object_key) throw new ProviderError('R2_RECEIPT_INVALID');
    return { complete: true, receivedBytes: inspection.receivedBytes, sourceSha256: null, identity: 'provider-receipt', providerMediaId: null,
      proof: { kind: 'r2-receipt', size: inspection.receivedBytes, etag: inspection.etag, objectKey: s.object_key, completedPartsHash } };
  }

  async cancelUpload(context: ProviderUploadContext): Promise<DeletionObservation> {
    const s = this.session(context);
    if (VIDEO_ROLES.has(s.role)) await this.video.cancelUpload(s);
    const deadline = VIDEO_ROLES.has(s.role) ? Math.max(context.clock.now(), Date.parse(s.expires_at)) : context.clock.now();
    return deletionPending(new Date(deadline).toISOString());
  }

  async inspectAsset(context: ProviderAssetContext): Promise<ProviderSnapshot> {
    const asset = context.asset;
    if (!VIDEO_ROLES.has(asset.role)) {
      return { status: asset.state === 'ready' ? 'ready' : asset.state === 'failed' ? 'failed' : 'pending',
        durationSeconds: asset.duration_seconds, receivedBytes: asset.received_bytes, metadata: asset.metadata,
        playbackVerified: asset.state === 'ready' && asset.delivery_path !== null,
        error: asset.error_code ? { code: asset.error_code, retryable: asset.error_retryable } : null };
    }
    const inspection = await this.video.verifyObject(this.session(context));
    const outputs = asset.metadata.outputs;
    const hasHls = asset.state === 'ready' && Array.isArray(outputs) && outputs.some((output) =>
      typeof output === 'object' && output !== null && 'relative' in output && typeof output.relative === 'string' && output.relative.endsWith('.m3u8'));
    return { status: hasHls ? 'ready' : asset.state === 'failed' ? 'failed' : inspection.complete ? 'processing' : 'pending',
      durationSeconds: asset.duration_seconds, receivedBytes: inspection.receivedBytes, metadata: asset.metadata,
      playbackVerified: hasHls, error: asset.error_code ? { code: asset.error_code, retryable: asset.error_retryable } : null };
  }

  async validateAsset(context: ProviderAssetContext): Promise<ProviderSnapshot> {
    if (VIDEO_ROLES.has(context.asset.role)) return this.inspectAsset(context);
    const verified = await this.auxiliary.verify(this.session(context));
    return { status:'ready',receivedBytes:verified.received_bytes,durationSeconds:null,playbackVerified:true,error:null,
      metadata:{...verified.metadata,source_sha256:context.session.source_sha256} };
  }

  async getPlayback(context: ProviderPlaybackContext): Promise<PlaybackSource> {
    const common = { version: 1 as const, mediaId: context.asset.id, titleSlug: context.titleSlug, titleId: context.titleId,
      revision: context.asset.revision, expiresAt: null, refreshUrl: context.titleSlug
        ? `/api/titles/${encodeURIComponent(context.titleSlug)}/playback` : `/api/media/${context.asset.id}/playback`,
      subtitles: context.subtitles, posterUrl: context.posterUrl, thumbnails: context.thumbnails };
    return { ...common, kind: 'hls', url: `/api/media/${context.asset.id}/hls/master.m3u8`,
      mimeType: 'application/vnd.apple.mpegurl', p2p: 'none', fallback: context.fallback };
  }

  async getAuxiliaryDelivery(context: ProviderAssetContext) {
    const mimeType = typeof context.asset.metadata.mime === 'string' ? context.asset.metadata.mime : 'application/octet-stream';
    return { url: `/api/media/${context.asset.id}`, mimeType, expiresAt: null };
  }

  async deleteAsset(context: ProviderAssetContext): Promise<DeletionObservation> {
    const s = this.session(context);
    // Un auxiliar (imagen, subtítulos) se da por borrado en cuanto se marca y se quita su ingest: no se espera a que caduque la
    // URL de subida. Si alguien la reutilizara, solo recrearía `ingest/…`, que nada lee y que la regla de ciclo de vida del bucket
    // (`gma-ingest-expira-3-dias`, ver docs/MAPA-MEDIA.md) borra sola.
    const safeAfter = context.clock.now();
    const absent = VIDEO_ROLES.has(s.role) ? await this.video.deleteObject(s) : await this.auxiliary.delete(s, safeAfter);
    return absent ? { absent: true, writesRevoked: true, safeAfter: null }
      : deletionPending(new Date(VIDEO_ROLES.has(s.role) ? Date.parse(s.expires_at) : safeAfter).toISOString());
  }

  async readAuxiliary(context:ProviderAssetContext):Promise<{bytes:Uint8Array;mimeType:'text/vtt'|'image/webp'}> {
    const key=context.asset.metadata.storage_key,mime=context.asset.metadata.mime;
    if(key!==`ready/${context.asset.owner_id}/${context.asset.id}` || mime!=='text/vtt' && mime!=='image/webp')throw new ProviderError('UPLOAD_INVALID_ASSET');
    const object=await this.auxiliary.read(key);if(!object.Body || !object.ContentLength || object.ContentLength>4*1024**2)throw new ProviderError('UPLOAD_INVALID_ASSET');
    const chunks:Uint8Array[]=[];let bytes=0;for await(const chunk of object.Body as AsyncIterable<Uint8Array>){bytes+=chunk.byteLength;if(bytes>4*1024**2)throw new ProviderError('UPLOAD_INVALID_ASSET');chunks.push(chunk);}
    return {bytes:Buffer.concat(chunks),mimeType:mime};
  }
  async deliverHls(context:ProviderAssetContext,relative:string,output:{key:string;mimeType:string|null;sizeBytes:number|null}):Promise<Response> {
    safeMediaPath(relative);if(!output.key.startsWith(`media/${context.asset.id}/hls/`))throw new ProviderError('UPLOAD_NOT_FOUND');
    if(!relative.endsWith('.m3u8'))return new Response(null,{status:307,headers:{Location:await this.video.signRead(output.key,Math.min(86400,Math.max(7200,Math.ceil(context.asset.duration_seconds??0)+3600))),'Cache-Control':'private, no-store'}});
    if(context.asset.state!=='ready')throw new ProviderError('UPLOAD_NOT_FOUND');
    const asset={...context.asset,state:'ready' as const,provider:'r2' as const};hlsObject(asset,relative);const object=await this.video.read(output.key);if(!object.Body)throw new ProviderError('UPLOAD_INVALID_ASSET');
    let length=0;const chunks:Uint8Array[]=[];for await(const chunk of object.Body as AsyncIterable<Uint8Array>){length+=chunk.length;if(length>1024**2)throw new ProviderError('UPLOAD_INVALID_ASSET');chunks.push(chunk);}
    return new Response(rewritePlaylist(asset,relative,Buffer.concat(chunks).toString('utf8')),{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'private, no-store'}});
  }
  async getParts(context: ProviderUploadContext) {
    const result=await this.video.inspectUpload(this.session(context));
    return {...result,partSize:Number(this.session(context).part_size),generation:context.transferGeneration};
  }
  async maintainAsset(context: ProviderAssetContext) {
    const prefixes=context.asset.metadata.orphan_prefixes;
    if(Array.isArray(prefixes))for(const prefix of prefixes){if(typeof prefix!=='string' || !prefix.startsWith(`media/${context.asset.id}/hls/`))throw new ProviderError('UPLOAD_INVALID_ASSET');await this.video.deletePrefix?.(prefix);}
    if(VIDEO_ROLES.has(context.session.role))await this.video.cleanupIngest?.(this.session(context));
    else if(context.clock.now()>=Date.parse(context.session.expires_at))await this.auxiliary.cleanupIngest(this.session(context));
  }
  async getPartTransfer(context: ProviderUploadContext, number: number) {
    if (!this.video.signPart) throw new ProviderError('UPLOAD_PROTOCOL_UNSUPPORTED');
    const result = await this.video.signPart(this.session(context), number);
    return { number: result.number, size: result.size, url: result.url, expiresAt: new Date(result.expiresAt).toISOString() };
  }
}
