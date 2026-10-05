import {createHash} from 'node:crypto';
import {S3Client, CreateMultipartUploadCommand, ListMultipartUploadsCommand, ListPartsCommand, UploadPartCommand,
 CompleteMultipartUploadCommand, AbortMultipartUploadCommand, HeadObjectCommand, DeleteObjectCommand,
 ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, CopyObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {requiredEnv} from './config';
import {ProviderError} from './stream';
import type {UploadSession} from './types';
import type {VideoIngestProvider, VideoUploadInspection, ReceivedPart} from './video-provider';

export function privateR2Client() {
 return new S3Client({region:'auto',endpoint:'https://'+requiredEnv('CLOUDFLARE_ACCOUNT_ID')+'.r2.cloudflarestorage.com',
  credentials:{accessKeyId:requiredEnv('R2_ACCESS_KEY_ID'),secretAccessKey:requiredEnv('R2_SECRET_ACCESS_KEY')},maxAttempts:1,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
}
const missing=(e:unknown)=>(e as {name?:string;$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404 || (e as {name?:string}).name==='NoSuchUpload';
export class R2VideoProvider implements VideoIngestProvider {
 constructor(readonly bucket:string,readonly client:S3Client=privateR2Client()){}
 key(s:UploadSession) {
  const expected='ingest/'+s.owner_id+'/'+s.id+'/';
  if(!s.object_key?.startsWith(expected)||!/^ingest\/[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+$/.test(s.object_key))throw new ProviderError('R2_KEY_INVALID');
  return s.object_key;
 }
 async openUploads(s:UploadSession):Promise<string[]> {
  const ids:string[]=[];let keyMarker:string|undefined,uploadIdMarker:string|undefined;
  do {
   const page=await this.client.send(new ListMultipartUploadsCommand({Bucket:this.bucket,Prefix:this.key(s),KeyMarker:keyMarker,UploadIdMarker:uploadIdMarker}),{abortSignal:AbortSignal.timeout(30000)});
   for(const u of page.Uploads??[])if(u.Key===s.object_key && u.UploadId)ids.push(u.UploadId);
   if(!page.IsTruncated)break;
   if(!page.NextKeyMarker)throw new ProviderError('R2_PAGINATION_INVALID');
   keyMarker=page.NextKeyMarker;uploadIdMarker=page.NextUploadIdMarker;
  }while(true);
  return ids;
 }
 async createUpload(s:UploadSession) {
  const ids=await this.openUploads(s);
  if(ids.length>1)throw new ProviderError('R2_MULTIPART_AMBIGUOUS');
  let id=ids[0];
  if(!id) {
   // A lost Create response is recovered by ListMultipartUploads, never by blind POST retry.
   if(s.provider_data.provision_started)throw new ProviderError('R2_CREATE_UNCERTAIN',true);
   try {
    const result=await this.client.send(new CreateMultipartUploadCommand({Bucket:this.bucket,Key:this.key(s),ContentType:'application/octet-stream',
     Metadata:{gma_session:s.id,gma_asset:s.asset_id,gma_expected_sha256:s.source_sha256}}),{abortSignal:AbortSignal.timeout(30000)});
    id=result.UploadId;
   }catch{throw new ProviderError('R2_CREATE_UNCERTAIN',true);}
  }
  if(!id)throw new ProviderError('R2_CREATE_UNCERTAIN',true);
  return {providerRef:this.key(s),multipartUploadId:id,partSize:Number(s.part_size??16*1024**2),expiresAt:s.expires_at};
 }
 async parts(s:UploadSession):Promise<ReceivedPart[]> {
  if(!s.multipart_upload_id)throw new ProviderError('R2_MULTIPART_UNBOUND');
  const parts:ReceivedPart[]=[];let marker:string|undefined;
  do {
   const page=await this.client.send(new ListPartsCommand({Bucket:this.bucket,Key:this.key(s),UploadId:s.multipart_upload_id,PartNumberMarker:marker}),{abortSignal:AbortSignal.timeout(30000)});
   for(const p of page.Parts??[]) {
    if(!p.PartNumber||!p.ETag||!Number.isSafeInteger(p.Size))throw new ProviderError('R2_PART_INVALID');
    parts.push({number:p.PartNumber,size:p.Size!,etag:p.ETag});
   }
   if(!page.IsTruncated)break;
   if(!page.NextPartNumberMarker)throw new ProviderError('R2_PAGINATION_INVALID');
   marker=page.NextPartNumberMarker;
  }while(true);
  return parts.sort((a,b)=>a.number-b.number);
 }
 async verifyObject(s:UploadSession):Promise<VideoUploadInspection> {
  let object;
  try{object=await this.client.send(new HeadObjectCommand({Bucket:this.bucket,Key:this.key(s)}),{abortSignal:AbortSignal.timeout(30000)});}
  catch(e){if(missing(e))return {complete:false,receivedBytes:0,parts:[]};throw e;}
  if(object.ContentLength!==s.expected_input_bytes || object.Metadata?.gma_session!==s.id || object.Metadata?.gma_asset!==s.asset_id || !object.ETag)throw new ProviderError('R2_OBJECT_INVALID');
  // Metadata and multipart ETag are receipts, not a trusted full-file checksum. Worker hashes actual bytes.
  return {complete:true,receivedBytes:object.ContentLength,parts:[],etag:object.ETag};
 }
 async inspectUpload(s:UploadSession):Promise<VideoUploadInspection> {
  const object=await this.verifyObject(s);if(object.complete)return object;
  try {const parts=await this.parts(s);return {parts,complete:false,receivedBytes:parts.reduce((n,p)=>n+p.size,0)};}
  catch(e){if(missing(e))throw new ProviderError('R2_MULTIPART_MISSING');throw e;}
 }
 resumeUpload(s:UploadSession){return this.inspectUpload(s);}
 async signPart(s:UploadSession,number:number) {
  const partSize=Number(s.part_size),count=Math.ceil(s.expected_input_bytes/partSize);
  if(!s.multipart_upload_id||!Number.isInteger(number)||number<1||number>count)throw new ProviderError('R2_PART_INVALID');
  const size=Math.min(partSize,s.expected_input_bytes-(number-1)*partSize);
  const ttl=Math.min(900,Math.floor((Date.parse(s.expires_at)-Date.now())/1000));if(ttl<1)throw new ProviderError('UPLOAD_EXPIRED');
  const url=await getSignedUrl(this.client,new UploadPartCommand({Bucket:this.bucket,Key:this.key(s),UploadId:s.multipart_upload_id,PartNumber:number,ContentLength:size}),{expiresIn:ttl});
  return {number,size,url,expiresAt:Date.now()+ttl*1000};
 }
 async completeUpload(s:UploadSession) {
  const object=await this.verifyObject(s);if(object.complete)return object;
  const parts=await this.parts(s),size=Number(s.part_size),count=Math.ceil(s.expected_input_bytes/size);
  if(parts.length!==count || parts.some((p,i)=>p.number!==i+1 || p.size!==Math.min(size,s.expected_input_bytes-i*size)))throw new ProviderError('R2_PARTS_INCOMPLETE');
  try{await this.client.send(new CompleteMultipartUploadCommand({Bucket:this.bucket,Key:this.key(s),UploadId:s.multipart_upload_id!,
   MultipartUpload:{Parts:parts.map(p=>({PartNumber:p.number,ETag:p.etag}))}}),{abortSignal:AbortSignal.timeout(30000)});}
  catch(e){const recovered=await this.verifyObject(s);if(recovered.complete)return recovered;throw e;}
  const verified=await this.verifyObject(s);if(!verified.complete)throw new ProviderError('R2_COMPLETE_UNCERTAIN',true);return verified;
 }
 async cancelUpload(s:UploadSession) {
  const ids=new Set(await this.openUploads(s));if(s.multipart_upload_id)ids.add(s.multipart_upload_id);
  for(const id of ids)try{await this.client.send(new AbortMultipartUploadCommand({Bucket:this.bucket,Key:this.key(s),UploadId:id}),{abortSignal:AbortSignal.timeout(30000)});}catch(e){if(!missing(e))throw e;}
 }
 async deletePrefix(prefix:string) {
  // Repeat from the beginning after deletes; no opaque pagination token over a changing listing.
  for(let pages=0;pages<100;pages++) {
   const page=await this.client.send(new ListObjectsV2Command({Bucket:this.bucket,Prefix:prefix,MaxKeys:1000}),{abortSignal:AbortSignal.timeout(30000)});
   const keys=(page.Contents??[]).flatMap(o=>o.Key?[{Key:o.Key}]:[]);if(!keys.length)return;
   const deleted=await this.client.send(new DeleteObjectsCommand({Bucket:this.bucket,Delete:{Objects:keys,Quiet:true}}),{abortSignal:AbortSignal.timeout(30000)});
   if(deleted.Errors?.length)throw new ProviderError('R2_DELETE_FAILED');
  }
  throw new ProviderError('R2_CLEANUP_LIMIT');
 }
 async deleteObject(s:UploadSession) {
  await this.cancelUpload(s);
  await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:this.key(s)}),{abortSignal:AbortSignal.timeout(30000)});
  await this.deletePrefix('media/'+s.asset_id+'/');
  return Date.now()>=Date.parse(s.expires_at) && (await this.openUploads(s)).length===0 && !(await this.verifyObject(s)).complete;
 }
 async read(key:string,etag?:string) {
  return this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key,IfMatch:etag}),{abortSignal:AbortSignal.timeout(300000)});
 }
 async put(key:string,body:Uint8Array,mime:string) {
  await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:body,ContentType:mime,ContentLength:body.byteLength,ContentMD5:createHash('md5').update(body).digest('base64'),Metadata:{gma_sha256:createHash('sha256').update(body).digest('hex')}}),{abortSignal:AbortSignal.timeout(30000)});
 }
 async verifyOutput(key:string,size:number,sha256:string) {
  const head=await this.client.send(new HeadObjectCommand({Bucket:this.bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});
  if(head.ContentLength!==size||head.Metadata?.gma_sha256!==sha256)throw new ProviderError('VIDEO_R2_OUTPUT_INVALID');
 }
 async retainOriginal(s:UploadSession,etag:string) {
  const key='media/'+s.asset_id+'/original/source';
  await this.client.send(new CopyObjectCommand({Bucket:this.bucket,Key:key,CopySource:this.bucket+'/'+this.key(s),CopySourceIfMatch:etag}),{abortSignal:AbortSignal.timeout(120000)});
  const head=await this.client.send(new HeadObjectCommand({Bucket:this.bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});
  if(head.ContentLength!==s.expected_input_bytes||head.Metadata?.gma_session!==s.id)throw new ProviderError('R2_ORIGINAL_INVALID');
  return key;
 }
 async signRead(key:string,expiresIn=3600) {
  return getSignedUrl(this.client,new GetObjectCommand({Bucket:this.bucket,Key:key}),{expiresIn});
 }
 async cleanupIngest(s:UploadSession) {
  // Called only after SQL ready: permanent private original and verified HLS already exist.
  // Multipart is closed, so old part URLs cannot replace the completed source.
  await this.cancelUpload(s);await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:this.key(s)}));
 }
}
