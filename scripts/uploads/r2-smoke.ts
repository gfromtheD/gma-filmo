import {randomUUID,createHash} from 'node:crypto';
import {R2VideoProvider} from '../../lib/uploads/r2-video';
import {getUploadConfig} from '../../lib/uploads/config';
import type {UploadSession} from '../../lib/uploads/types';
// Explicit isolated-bucket smoke; creates ~5 MiB, never touches the legacy bucket.
async function main(){
 if(process.env.UPLOAD_R2_SMOKE_ACK!=='isolated-bucket-only'||process.env.UPLOAD_ENVIRONMENT!=='staging')throw new Error('R2_SMOKE_ISOLATION_REQUIRED');
 const config=getUploadConfig(),provider=new R2VideoProvider(config.bucket),owner=randomUUID(),id=randomUUID(),bytes=5*1024**2+17,buffer=Buffer.alloc(bytes,23);
 const s={id,owner_id:owner,asset_id:randomUUID(),role:'main',provider:'r2',state:'uploading',object_key:'ingest/'+owner+'/'+id+'/'+randomUUID(),provider_data:{},expected_input_bytes:bytes,source_sha256:createHash('sha256').update(buffer).digest('hex'),part_size:5*1024**2,expires_at:new Date(Date.now()+3600000).toISOString()} as UploadSession;
 try {
  const created=await provider.createUpload(s);s.multipart_upload_id=created.multipartUploadId;
  await Promise.all([1,2].map(async n=>{const signed=await provider.signPart(s,n),body=buffer.subarray((n-1)*s.part_size!,n*s.part_size!);
   const response=await fetch(signed.url,{method:'PUT',headers:{'Content-Length':String(body.length),'Content-Type':'application/octet-stream'},body,signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('R2_SIGNED_PART_FAILED:'+response.status);
  }));
  const inspection=await provider.inspectUpload(s);if(inspection.parts.length!==2)throw new Error('R2_LIST_PARTS_FAILED');
  const receipt=await provider.completeUpload(s);if(!receipt.complete||!(await provider.completeUpload(s)).complete)throw new Error('R2_COMPLETE_FAILED');
  const object=await provider.read(s.object_key!,receipt.etag),hash=createHash('sha256');let received=0;
  for await(const chunk of object.Body as AsyncIterable<Uint8Array>){hash.update(chunk);received+=chunk.length;}
  if(received!==bytes||hash.digest('hex')!==s.source_sha256)throw new Error('R2_HASH_FAILED');
  await provider.retainOriginal(s,receipt.etag!);
  const key='media/'+s.asset_id+'/hls/smoke/1/master.m3u8',playlist=Buffer.from('#EXTM3U\n');await provider.put(key,playlist,'application/vnd.apple.mpegurl');await provider.verifyOutput(key,playlist.length,createHash('sha256').update(playlist).digest('hex'));
  const playback=await fetch(await provider.signRead(key),{signal:AbortSignal.timeout(30000)});if(!playback.ok||await playback.text()!==playlist.toString())throw new Error('R2_SIGNED_READ_FAILED');
  console.log(JSON.stringify({status:'PROBADO CONTRA R2 REAL',multipart:true,listParts:true,completeReplay:true,fullSha256:true,privateCopy:true,derivedPutHead:true,signedGet:true,browserCors:'requires browser pilot',worker:'requires separate pilot'}));
 }finally{s.expires_at=new Date(Date.now()-1000).toISOString();if(!(await provider.deleteObject(s)))throw new Error('R2_SMOKE_CLEANUP_UNCONFIRMED');}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'R2_SMOKE_FAILED');process.exitCode=1;});
