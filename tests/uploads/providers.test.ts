import {legacyMediaWritesGate} from '../../lib/media/legacy-writes';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {AuxiliaryProvider,normalizeSubtitles} from '../../lib/uploads/auxiliary';
import {StreamProvider} from '../../lib/uploads/stream';
import {UploadRepository,translateDatabaseError} from '../../lib/uploads/repository';
import {UploadService} from '../../lib/uploads/legacy-service';
import {getUploadConfig} from '../../lib/uploads/config';
import type {S3Client} from '@aws-sdk/client-s3';
import type {UploadSession,UploadJob} from '../../lib/uploads/types';
function session(bytes:Buffer):UploadSession {return {id:randomUUID(),owner_id:randomUUID(),asset_id:randomUUID(),draft_id:randomUUID(),role:'poster',slot:'poster',language:null,
 provider:'r2',provider_ref:null,provider_data:{},expected_input_bytes:bytes.length,source_sha256:createHash('sha256').update(bytes).digest('hex'),content_type:'image/png',file_name:'poster.png',max_duration_seconds:0,
 expires_at:new Date(Date.now()+60000).toISOString(),revision:0,state:'uploading'};}
test('R2 final key contains only decoded normalized bytes; reused ingest cannot replace it',async()=>{
 const image=await sharp({create:{width:16,height:16,channels:3,background:'red'}}).png().toBuffer(),s=session(image);
 const objects=new Map<string,{body:Buffer;mime:string;metadata?:Record<string,string>}>();const writes:string[]=[];
 const client={send:async(command:{constructor:{name:string};input:{Key:string;Body?:Buffer;ContentType?:string;IfNoneMatch?:string;Metadata?:Record<string,string>}})=>{
 const {Key}=command.input;const object=objects.get(Key);
 switch(command.constructor.name){
   case 'HeadObjectCommand':if(!object)throw {$metadata:{httpStatusCode:404}};return {ContentLength:object.body.length,ETag:'test',Metadata:object.metadata};
   case 'GetObjectCommand':return {Body:(async function*(){yield object!.body;})()};
   case 'PutObjectCommand':if(command.input.IfNoneMatch && object)throw {$metadata:{httpStatusCode:412}};writes.push(Key);objects.set(Key,{body:Buffer.from(command.input.Body!),mime:command.input.ContentType!,metadata:command.input.Metadata});return {};
   case 'DeleteObjectCommand':objects.delete(Key);return {};
 }throw new Error('Unexpected command');
 }} as unknown as S3Client;
 const provider=new AuxiliaryProvider('private-isolated',client);objects.set(provider.ingestKey(s),{body:image,mime:'image/png'});
 const verified=await provider.verify(s);assert.equal(verified.metadata.mime,'image/webp');assert.equal(writes.length,1);assert.equal(writes[0],provider.finalKey(s));
 const final=objects.get(provider.finalKey(s))!.body;assert.equal((await sharp(final).metadata()).format,'webp');
 objects.set(provider.ingestKey(s),{body:Buffer.from('reused PUT'),mime:'image/png'});assert.deepEqual(objects.get(provider.finalKey(s))!.body,final);
 await assert.rejects(provider.verify(s),/R2_RECEIPT_INVALID/);
 const removed=await provider.delete(s);assert.equal(removed,false);
 objects.set(provider.ingestKey(s),{body:image,mime:'image/png'});await assert.rejects(provider.verify(s),/R2_FINALIZATION_FAILED/);
 assert.equal(objects.get(provider.finalKey(s))!.body.length,0); // Signed PUT may still recreate ingest.
});
test('subtitles reject malformed cues, invalid time components, HTML scripts and invalid UTF8',()=>{
 for(const text of ['00:99:00.000 --> 01:00:00.000\nWrong','WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<script>alert(1)</script>','1\n00:00:01.000 --> 00:00:02.000\nGood\n\ninvalid block'])assert.throws(()=>normalizeSubtitles(Buffer.from(text)));
 assert.throws(()=>normalizeSubtitles(new Uint8Array([255,254])));
 const output=normalizeSubtitles(Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola'));assert.match(output.toString(),/^WEBVTT\n\n00:/);
});
test('database failure never becomes empty quota or success',()=>{assert.throws(()=>translateDatabaseError({message:'network timeout'}),/UPLOAD_DATABASE_UNAVAILABLE/);assert.throws(()=>translateDatabaseError({message:'UPLOAD_QUOTA_EXCEEDED'}),/UPLOAD_QUOTA_EXCEEDED/);});
test('uncertain Stream POST is not repeated by durable retry',async()=>{
 let attempts=0;const s=session(Buffer.from('video'));s.provider='stream';s.state='provisioning';s.max_duration_seconds=600;
 const jobs:unknown[]=[];
 const repo={session:async()=>s,asset:async()=>({state:'received'}),command:async(_owner:string,action:string)=>{if(action==='intent')s.provider_data.provision_started=true;return s;},
 finishJob:async(...args:unknown[])=>{jobs.push(args);}} as unknown as UploadRepository;
 const stream=new StreamProvider({accountId:'a'.repeat(32),streamToken:'test',streamCustomer:'test'},async(_url,init)=>{if(init?.method==='POST'){attempts++;throw new Error('lost response');}return Response.json({result:[]});});
 const service=new UploadService(repo,{stream,auxiliary:{} as AuxiliaryProvider});const job={id:randomUUID(),session_id:s.id,kind:'provision',attempts:1} as UploadJob;
 await service.run(job,'worker1');await service.run(job,'worker2');assert.equal(attempts,1);assert.equal(jobs.length,2);
 assert.equal((jobs[1] as unknown[])[3],'UPLOAD_PROVISION_RECOVERY_REQUIRED');
});
test('production and staging require deliberate gates and distinct private bucket',()=>{
 const keys=['UPLOAD_ENVIRONMENT','UPLOAD_PRODUCTION_READY','UPLOAD_ISOLATION_ACK','UPLOAD_STREAM_POLICY_ACK','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_STREAM_CUSTOMER_CODE','UPLOAD_R2_PRIVATE_BUCKET','CLOUDFLARE_R2_BUCKET','CLOUDFLARE_STREAM_API_TOKEN'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));try {
 process.env.UPLOAD_ENVIRONMENT='production';delete process.env.UPLOAD_PRODUCTION_READY;assert.throws(getUploadConfig,/UPLOAD_PRODUCTION_GATE_CLOSED/);
 process.env.UPLOAD_ENVIRONMENT='staging';process.env.UPLOAD_ISOLATION_ACK='true';process.env.UPLOAD_STREAM_POLICY_ACK='1080p-sdr-stereo-no-master';
 process.env.CLOUDFLARE_ACCOUNT_ID='a'.repeat(32);process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE='test';process.env.UPLOAD_R2_PRIVATE_BUCKET='gma-media';delete process.env.CLOUDFLARE_R2_BUCKET;
 assert.throws(getUploadConfig,/UPLOAD_INGEST_BUCKET_MUST_BE_SEPARATE/);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});

test('SUB-R02/R03 reproducible baseline legacy route: concurrent over-allocation and ignored SQL error',async()=>{
 const {execFileSync}=await import('node:child_process');const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');const ts=await import('typescript');
 const baseline=execFileSync('git',['show','93fbea02b0e69eb7d3f054b59e55f9caa6a37351:app/api/upload/presign/route.ts'],{encoding:'utf8'});
 function load(source:string,failed=false){
 const module={exports:{} as {POST:(req:Request)=>Promise<Response>}};
 const db={from:()=>({select:()=>({eq:async()=>({data:failed?null:[],error:failed?{message:'schema unavailable'}:null})})})};
 const mocks:Record<string,unknown>={'@/lib/media/legacy-writes':{legacyMediaWritesGate},'next/server':{NextResponse:{json:Response.json}},'@aws-sdk/client-s3':{PutObjectCommand:class{}},'@aws-sdk/s3-request-presigner':{getSignedUrl:async()=> 'https://example.invalid/temporary'},
 '@/lib/r2/client':{r2:{},R2_BUCKET:'test',R2_PUBLIC_URL:'https://example.invalid',UPLOAD_CAPS:{main:4*1024**3},SESSION_CAP:6*1024**3,FREE_QUOTA:10*1024**3},
 '@/lib/api/auth':{getUserId:async()=> 'owner'},'@/lib/supabase/admin':{getSupabaseAdminClient:()=>db},'@/lib/uploads/config':{uploadEngineEnabled:()=>false}};
 vm.runInNewContext(ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),{exports:module.exports,module,require:(name:string)=>{if(!(name in mocks))throw new Error(name);return mocks[name];},process:{env:{}},crypto:{randomUUID},console});
 return module.exports.POST;
 }
 const request=()=>new Request('https://example.invalid/api/upload/presign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetType:'main',fileName:'video.mp4',fileSize:4*1024**3,contentType:'video/mp4',sessionUsed:0})});
 const old=load(baseline);const responses=await Promise.all([old(request()),old(request())]);assert.deepEqual(responses.map(r=>r.status),[200,200]);
 assert.equal((await load(baseline,true)(request())).status,200);
 const current=load(await readFile('app/api/upload/presign/route.ts','utf8'),true);assert.equal((await current(request())).status,503);
});
test('HLS playback JWT uses the configured RSA key, target video and expiring manifest URL',async()=>{
 const {generateKeyPairSync,createVerify}=await import('node:crypto');const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const oldId=process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID,oldKey=process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;
 try {
 process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID='signing-test';process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM=privateKey.export({type:'pkcs8',format:'pem'}).toString();
 const provider=new StreamProvider({accountId:'a'.repeat(32),streamToken:'test',streamCustomer:'isolated'});
 const playback=provider.playback('video123456789012',100);const token=new URL(playback.url).pathname.split('/')[1]!;
 const [header,body,signature]=token.split('.');const claims=JSON.parse(Buffer.from(body!,'base64url').toString());
 assert.equal(claims.sub,'video123456789012');assert.equal(claims.kid,'signing-test');assert.ok(claims.exp>Date.now()/1000);
 assert.equal(createVerify('RSA-SHA256').update(header+'.'+body).verify(publicKey,Buffer.from(signature!,'base64url')),true);
 assert.match(playback.url,/customer-isolated\.cloudflarestream\.com\/.*\/manifest\/video\.m3u8$/);
 }finally{if(oldId===undefined)delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;else process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID=oldId;if(oldKey===undefined)delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;else process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM=oldKey;}
});
test('cleanup awaiting signature expiry is scheduled at expiry instead of exhausting retries early',async()=>{
 const s=session(Buffer.from('image'));s.state='cancelling';const finishes:unknown[][]=[];
 const repo={session:async()=>s,asset:async()=>({state:'deleting'}),finishJob:async(...args:unknown[])=>{finishes.push(args);}} as unknown as UploadRepository;
 const service=new UploadService(repo,{stream:{} as StreamProvider,auxiliary:{delete:async()=>false} as unknown as AuxiliaryProvider});
 await service.run({id:randomUUID(),session_id:s.id,kind:'delete',attempts:1} as UploadJob,'worker');
 assert.equal(finishes[0]![3],'UPLOAD_CLEANUP_UNCONFIRMED');assert.ok(Date.parse(String(finishes[0]![4]))>=Date.parse(s.expires_at));
});
test('PostgREST composite RPC works with row and array representations; empty claim is not a job',async()=>{
 const job={id:randomUUID(),kind:'provision'};let value:unknown=[job];
 const repo=new UploadRepository({rpc:async()=>({data:value,error:null})} as never);
 assert.equal((await repo.claimSession(null,null,'worker'))?.id,job.id);
 assert.equal((await repo.rpc<{id:string}>('helper',{})).id,job.id);
 value=job;assert.equal((await repo.claimSession(null,null,'worker'))?.id,job.id);
 value=[];assert.equal(await repo.claimSession(null,null,'worker'),null);
 value=null;await assert.rejects(repo.rpc('helper',{}),/UPLOAD_DATABASE_UNAVAILABLE/);
});
