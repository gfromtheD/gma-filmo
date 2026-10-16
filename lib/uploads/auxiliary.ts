import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UploadSession } from "./types";
import { ProviderError } from "./stream";
import { requiredEnv } from "./config";
import { AuxiliaryValidationError, normalizeImage, normalizeSubtitles as normalizeSubtitlesPure } from '@/lib/media/auxiliary-validation';

export function normalizeSubtitles(input: Uint8Array): Buffer {
  try { return normalizeSubtitlesPure(input); }
  catch (error) { throw new ProviderError(error instanceof AuxiliaryValidationError ? error.code : 'SUBTITLE_INVALID'); }
}
export class AuxiliaryProvider {
  private client: S3Client;
  constructor(private bucket: string, client?: S3Client) {
    this.client = client ?? new S3Client({ region:"auto",
      endpoint:"https://" + requiredEnv("CLOUDFLARE_ACCOUNT_ID") + ".r2.cloudflarestorage.com",
      credentials:{accessKeyId:requiredEnv("R2_ACCESS_KEY_ID"),secretAccessKey:requiredEnv("R2_SECRET_ACCESS_KEY")},maxAttempts:2,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED' });
  }
  ingestKey(session:UploadSession){ return "ingest/" + session.owner_id + "/" + session.id; }
  finalKey(session:UploadSession){return "ready/" + session.owner_id + "/" + session.asset_id;}
  async transfer(session:UploadSession) {
    const uploadUrl=await getSignedUrl(this.client,new PutObjectCommand({Bucket:this.bucket,Key:this.ingestKey(session),
      ContentLength:session.expected_input_bytes,ContentType:session.content_type}),{expiresIn:Math.max(1,Math.min(3600,Math.floor((Date.parse(session.expires_at)-Date.now())/1000)))});
    return {providerRef:this.ingestKey(session),uploadUrl,expiresAt:session.expires_at};
  }
  async head(key:string) {
    try {return await this.client.send(new HeadObjectCommand({Bucket:this.bucket,Key:key}),{abortSignal:AbortSignal.timeout(20000)});}
    catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404)return null;throw new ProviderError("R2_HEAD_FAILED");}
  }
  async inspectReceipt(session:UploadSession) {
    const head=await this.head(this.ingestKey(session));
    if (!head || head.ContentLength!==session.expected_input_bytes || !head.ETag) throw new ProviderError('UPLOAD_NOT_COMPLETE');
    return { size:head.ContentLength,etag:head.ETag,key:this.ingestKey(session) };
  }
  async verify(session:UploadSession) {
    const head=await this.head(this.ingestKey(session));
    if (!head || head.ContentLength!==session.expected_input_bytes) throw new ProviderError("R2_RECEIPT_INVALID");
    const response=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:this.ingestKey(session),IfMatch:head.ETag}),{abortSignal:AbortSignal.timeout(20000)});
    if(!response.Body)throw new ProviderError("R2_RECEIPT_INVALID");
    const chunks: Uint8Array[]=[];let length=0;
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      length+=chunk.length;if(length>session.expected_input_bytes || length>10*1024**2)throw new ProviderError("R2_RECEIPT_INVALID");
      chunks.push(chunk);
    }
    const input=Buffer.concat(chunks);
    if(input.length!==session.expected_input_bytes || createHash("sha256").update(input).digest("hex")!==session.source_sha256)
      throw new ProviderError("R2_IDENTITY_INVALID");
    let output:Buffer,mime:string,width:number|null=null,height:number|null=null;
    if(session.role==="subtitles"){output=normalizeSubtitles(input);mime="text/vtt";}
    else {
      try {
        const normalized=await normalizeImage(input,session.role);
        output=normalized.data;mime=normalized.mimeType;width=normalized.width;height=normalized.height;
      } catch(error) {
        throw new ProviderError(error instanceof AuxiliaryValidationError ? error.code : 'IMAGE_INVALID');
      }
    }
    if(output.length>4*1024**2)throw new ProviderError("NORMALIZED_ASSET_TOO_LARGE");
    // Only the server can write this key. Never copy a mutable ingest key after validation.
    const digest=createHash('sha256').update(output).digest('hex');
    try {
      await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:this.finalKey(session),Body:output,ContentType:mime,
        IfNoneMatch:'*',Metadata:{gma_normalized_sha256:digest}}),{abortSignal:AbortSignal.timeout(20000)});
    }catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode!==412)throw e;}
    const final=await this.head(this.finalKey(session));
    if(final?.ContentLength!==output.length || final.Metadata?.gma_normalized_sha256!==digest)throw new ProviderError("R2_FINALIZATION_FAILED");
    return {received_bytes:input.length,delivery_path:"/api/media/" + session.asset_id,
      metadata:{storage_key:this.finalKey(session),mime,normalized_bytes:output.length,width,height,
        normalized_sha256:createHash("sha256").update(output).digest("hex")}};
  }
  async read(key:string) { return this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key}),{abortSignal:AbortSignal.timeout(20000)}); }
  async cleanupIngest(session:UploadSession) {
    if(Date.now()<Date.parse(session.expires_at))throw new ProviderError('R2_SIGNATURE_NOT_EXPIRED');
    await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:this.ingestKey(session)}),{abortSignal:AbortSignal.timeout(20000)});
    if(await this.head(this.ingestKey(session)))throw new ProviderError('R2_CLEANUP_UNCONFIRMED');
  }
  async delete(session:UploadSession) {
    // A zero-byte tombstone blocks late conditional finalization, including after a worker lease expires.
    // The original media is gone; keeping this marker prevents an in-flight writer from resurrecting it.
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:this.finalKey(session),Body:Buffer.alloc(0),
      ContentType:'application/octet-stream',Metadata:{gma_deleted:'true'}}),{abortSignal:AbortSignal.timeout(20000)});
    await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:this.ingestKey(session)}),{abortSignal:AbortSignal.timeout(20000)});
    const final=await this.head(this.finalKey(session));
    const absent=(await this.head(this.ingestKey(session)))===null && final?.ContentLength===0 && final.Metadata?.gma_deleted==='true';
    // A still-valid PUT can recreate ingest after deletion. Keep its reservation until expiry.
    return absent && Date.now()>=Date.parse(session.expires_at);
  }
}
