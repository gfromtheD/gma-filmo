import { createHash } from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UploadSession } from "./types";
import { ProviderError } from "./stream";
import { requiredEnv } from "./config";

export function normalizeSubtitles(input: Uint8Array): Buffer {
  let decoded:string;try{decoded=new TextDecoder("utf-8",{fatal:true}).decode(input);}catch{throw new ProviderError("SUBTITLE_INVALID");}
  const text = decoded.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").trim();
  if (!text || text.includes("\0") || /<(?:script|iframe|style)\b/i.test(text)) throw new ProviderError("SUBTITLE_INVALID");
  const body=text.replace(/^WEBVTT[^\n]*(?:\n[^\n]+)*?\n\n/,'').replace(/^WEBVTT\s*$/,'').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2');
  const timestamp=(value:string)=>{
    const parts=value.split(':');const seconds=Number(parts.pop()),minutes=Number(parts.pop()),hours=Number(parts.pop()??0);
    if(!Number.isFinite(seconds)||minutes>59||seconds>=60)throw new ProviderError('SUBTITLE_INVALID');
    return hours*3600+minutes*60+seconds;
  };
  const cues:string[]=[];
  for(const block of body.split(/\n\s*\n/)) {
    if(/^NOTE(?:\s|$)/.test(block))continue;
    const lines=block.trim().split('\n');const index=lines[0]?.includes('-->')?0:1;
    const timing=lines[index]?.match(/^((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})(?:\s+[^\n]*)?$/);
    if(!timing||lines.length<=index+1||timestamp(timing[1]!)>=timestamp(timing[2]!))throw new ProviderError('SUBTITLE_INVALID');
    const content=lines.slice(index+1).join('\n');
    if(content.includes('-->')||content.length>20000)throw new ProviderError('SUBTITLE_INVALID');
    cues.push(timing[1]+' --> '+timing[2]+'\n'+content);
  }
  if(!cues.length||cues.length>50000)throw new ProviderError('SUBTITLE_INVALID');
  return Buffer.from('WEBVTT\n\n'+cues.join('\n\n')+'\n');
}
export class AuxiliaryProvider {
  private client: S3Client;
  constructor(private bucket: string, client?: S3Client) {
    this.client = client ?? new S3Client({ region:"auto",
      endpoint:"https://" + requiredEnv("CLOUDFLARE_ACCOUNT_ID") + ".r2.cloudflarestorage.com",
      credentials:{accessKeyId:requiredEnv("R2_ACCESS_KEY_ID"),secretAccessKey:requiredEnv("R2_SECRET_ACCESS_KEY")},maxAttempts:2 });
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
      const image=sharp(input,{limitInputPixels:25000000,animated:false});
      const metadata=await image.metadata();
      if(!["jpeg","png","webp","avif"].includes(metadata.format??"") || !metadata.width || !metadata.height)
        throw new ProviderError("IMAGE_INVALID");
      const normalized=await image.rotate().resize({width:session.role==="avatar"?512:2400,height:2400,fit:"inside",withoutEnlargement:true})
        .webp({quality:85}).timeout({seconds:20}).toBuffer({resolveWithObject:true});
      output=normalized.data;mime="image/webp";width=normalized.info.width;height=normalized.info.height;
      }catch{throw new ProviderError("IMAGE_INVALID");}
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
