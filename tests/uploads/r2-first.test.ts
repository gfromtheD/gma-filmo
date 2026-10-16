import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {S3Client,CreateMultipartUploadCommand,ListMultipartUploadsCommand,ListPartsCommand,HeadObjectCommand,CompleteMultipartUploadCommand,AbortMultipartUploadCommand,DeleteObjectCommand,ListObjectsV2Command,DeleteObjectsCommand} from '@aws-sdk/client-s3';
import {R2VideoProvider} from '../../lib/uploads/r2-video';
import {getUploadConfig,videoProvider} from '../../lib/uploads/config';
import {UploadService} from '../../lib/uploads/legacy-service';
import {UploadRepository} from '../../lib/uploads/repository';
import {database,command,OWNER,OTHER} from './database';
import {hlsObject,rewritePlaylist} from '../../lib/uploads/hls-delivery';
import type {UploadSession,UploadDraft,MediaAsset} from '../../lib/uploads/types';
const SHA='a'.repeat(64),SIZE=16*1024**2;
function session():UploadSession {const id=randomUUID();return {id,owner_id:OWNER,asset_id:randomUUID(),draft_id:randomUUID(),role:'main',slot:'main',language:null,provider:'r2',provider_ref:null,provider_data:{},object_key:'ingest/'+OWNER+'/'+id+'/'+randomUUID(),multipart_upload_id:'upload-1',part_size:SIZE,transfer_generation:1,expected_input_bytes:SIZE+100,source_sha256:SHA,content_type:'video/mp4',file_name:'../untrusted.mp4',max_duration_seconds:14400,expires_at:new Date(Date.now()+86400000).toISOString(),revision:0,state:'uploading'};}
class FakeR2 {
 uploads=new Set<string>();parts=[{PartNumber:1,Size:SIZE,ETag:'"one"'},{PartNumber:2,Size:100,ETag:'"two"'}];complete=false;createLost=false;completeLost=false;calls:string[]=[];s=session();
 async send(command:unknown):Promise<unknown> {
  const name=(command as object).constructor.name;this.calls.push(name);
  if(command instanceof ListMultipartUploadsCommand)return {Uploads:Array.from(this.uploads,id=>({Key:this.s.object_key,UploadId:id}))};
  if(command instanceof CreateMultipartUploadCommand){this.uploads.add('upload-1');if(this.createLost)throw new Error('response lost');return {UploadId:'upload-1'};}
  if(command instanceof ListPartsCommand){if(!this.uploads.has(command.input.UploadId!))throw {name:'NoSuchUpload'};return {Parts:this.parts};}
  if(command instanceof HeadObjectCommand){if(!this.complete)throw {$metadata:{httpStatusCode:404}};return {ContentLength:this.s.expected_input_bytes,ETag:'"multipart-2"',Metadata:{gma_session:this.s.id,gma_asset:this.s.asset_id}};}
  if(command instanceof CompleteMultipartUploadCommand){assert.deepEqual(command.input.MultipartUpload?.Parts,this.parts.map(p=>({PartNumber:p.PartNumber,ETag:p.ETag})));this.complete=true;this.uploads.clear();if(this.completeLost)throw new Error('response lost');return {};}
  if(command instanceof AbortMultipartUploadCommand){this.uploads.delete(command.input.UploadId!);return {};}
  if(command instanceof DeleteObjectCommand){this.complete=false;return {};}
  if(command instanceof ListObjectsV2Command)return {Contents:[]};
  if(command instanceof DeleteObjectsCommand)return {};
  throw new Error('Unexpected '+name);
 }
 provider(){return new R2VideoProvider('isolated-test',this as unknown as S3Client);}
}
async function setup(){const db=await database();await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');return db;}
async function reserve(db:Awaited<ReturnType<typeof database>>){const d=await command<UploadDraft>(db,'create_draft',{purpose:'title'}),key=randomUUID();const s=await command<UploadSession>(db,'reserve',{draft_id:d.id,revision:0,role:'main',bytes:100,sha256:SHA,file_name:'file.mp4',content_type:'video/mp4',idempotency_key:key,request_hash:key});return {d,s,key};}
async function video(db:Awaited<ReturnType<typeof database>>,action:string,input:unknown,owner=OWNER) {return (await db.query<{result:Record<string,unknown>}>('SELECT gma_video_command($1,$2,$3::jsonb) result',[owner,action,JSON.stringify(input)])).rows[0]!.result;}
async function uploaded(db:Awaited<ReturnType<typeof database>>,s:UploadSession){await command(db,'bind',{session_id:s.id,provider_ref:s.object_key,provider_data:{multipartUploadId:'mpu'}});return video(db,'uploaded',{session_id:s.id,received_bytes:100,etag:'"real-head"'});}
async function claim(db:Awaited<ReturnType<typeof database>>,s:UploadSession,worker='worker-a'){return (await db.query<{j:{id:string;attempts:number}}>("SELECT to_jsonb(gma_upload_claim_session_job($1,'process',$2,120)) j",[s.id,worker])).rows[0]!.j;}

test('R2 create multipart, uncertain Create recovered by authoritative provider listing without duplicate',async()=>{
 const f=new FakeR2(),provider=f.provider();f.createLost=true;
 await assert.rejects(provider.createUpload(f.s),/R2_CREATE_UNCERTAIN/);
 f.s.provider_data.provision_started=true;const recovered=await provider.createUpload(f.s);assert.equal(recovered.multipartUploadId,'upload-1');assert.equal(f.calls.filter(c=>c==='CreateMultipartUploadCommand').length,1);
 f.uploads.clear();await assert.rejects(provider.createUpload(f.s),/R2_CREATE_UNCERTAIN/);
});
test('ListParts drives resume including lost part response; backend rejects missing or mismatched parts',async()=>{
 const f=new FakeR2();f.uploads.add('upload-1');const p=f.provider();
 assert.equal((await p.resumeUpload(f.s)).parts.length,2);
 f.parts.pop();await assert.rejects(p.completeUpload(f.s),/R2_PARTS_INCOMPLETE/);
 f.parts.push({PartNumber:2,Size:99,ETag:'"wrong"'});await assert.rejects(p.completeUpload(f.s),/R2_PARTS_INCOMPLETE/);
 assert.equal(f.calls.includes('CompleteMultipartUploadCommand'),false);
});
test('Complete response loss and duplicate completion recover by HEAD, ETag never treated as SHA',async()=>{
 const f=new FakeR2();f.uploads.add('upload-1');f.completeLost=true;const p=f.provider();
 const first=await p.completeUpload(f.s),second=await p.completeUpload(f.s);assert.equal(first.complete,true);assert.deepEqual(first,second);
 assert.notEqual(first.etag,SHA);assert.equal(f.calls.filter(c=>c==='CompleteMultipartUploadCommand').length,1);
});
test('part URLs renewable, bounded, server key only; cancellation aborts and prevents complete',async()=>{
 const s=session();const sdk=new S3Client({region:'auto',endpoint:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com',credentials:{accessKeyId:'test',secretAccessKey:'test'}});
 const p=new R2VideoProvider('test',sdk);const part=await p.signPart(s,2);assert.equal(part.size,100);
 const url=new URL(part.url);assert.equal(url.searchParams.get('partNumber'),'2');assert.equal(url.searchParams.get('X-Amz-Expires'),'900');assert.ok(url.pathname.endsWith(s.object_key!));
 await assert.rejects(p.signPart(s,3),/R2_PART_INVALID/);s.expires_at=new Date(Date.now()-1000).toISOString();await assert.rejects(p.signPart(s,1),/UPLOAD_EXPIRED/);
 const f=new FakeR2();f.uploads.add('upload-1');await f.provider().cancelUpload(f.s);assert.equal(f.uploads.size,0);await assert.rejects(f.provider().completeUpload(f.s));
});
test('R2 configuration works without any Stream secrets; future provider explicit opt-in',()=>{
 const keys=['UPLOAD_ENVIRONMENT','UPLOAD_ISOLATION_ACK','CLOUDFLARE_ACCOUNT_ID','UPLOAD_R2_PRIVATE_BUCKET','VIDEO_PROVIDER','STREAM_PROVIDER_ENABLED'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {Object.assign(process.env,{UPLOAD_ENVIRONMENT:'local',UPLOAD_ISOLATION_ACK:'true',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),UPLOAD_R2_PRIVATE_BUCKET:'isolated-test',VIDEO_PROVIDER:'r2'});assert.equal(getUploadConfig().bucket,'isolated-test');assert.equal(videoProvider(),'r2');process.env.VIDEO_PROVIDER='stream';delete process.env.STREAM_PROVIDER_ENABLED;assert.throws(videoProvider,/UPLOAD_STREAM_DISABLED/);}
 finally{for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});
test('R2 reserve uses same session on retry, durable key and quota without Stream capacity',async()=>{const db=await setup();try{
 const {d,s,key}=await reserve(db);assert.equal(s.provider,'r2');assert.equal(s.part_size,SIZE);assert.ok(s.object_key?.startsWith('ingest/'+OWNER+'/'+s.id+'/'));
 const retry=await command<UploadSession>(db,'reserve',{draft_id:d.id,revision:0,role:'main',idempotency_key:key,request_hash:key});assert.equal(retry.id,s.id);assert.equal(retry.object_key,s.object_key);
 const quota=(await db.query<{reserved_seconds:number;reserved_bytes:number}>("SELECT * FROM gma_upload_quota WHERE account_key='global'")).rows[0]!;assert.equal(Number(quota.reserved_seconds),0);assert.equal(Number(quota.reserved_bytes),100);
 await uploaded(db,s);await assert.rejects(video(db,'authorize',{session_id:s.id,generation:1},OTHER),/UPLOAD_NOT_FOUND/);
 await assert.rejects(command(db,'observe',{session_id:s.id,state:'ready',received_bytes:100,duration_seconds:10}),/UPLOAD_PROCESSING_UNVERIFIED/);
 await assert.rejects(command(db,'publish',{draft_id:d.id,revision:1,request_hash:'publish'}),/UPLOAD_MEDIA_NOT_READY/);
}finally{await db.close();}});
test('R2 complete + SQL response failure retries the same original and durable processing job once',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await uploaded(db,s);await uploaded(db,s);
 assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE kind='process'")).rows.length,1);
 const a=(await db.query<{state:string}>('SELECT * FROM gma_media_assets WHERE id=$1',[s.asset_id])).rows[0]!;assert.equal(a.state,'validating');
 const generic=(await db.query<{j:{kind:string}}>("SELECT to_jsonb(gma_upload_claim_session_job(NULL,NULL,'api',120)) j")).rows[0]!.j;assert.notEqual(generic?.kind,'process');
}finally{await db.close();}});
test('processing worker death, heartbeat fencing, repeated ready and idempotent R2 publication',async()=>{const db=await setup();try{
 const {s,d}=await reserve(db);await uploaded(db,s);const j=await claim(db,s);
 await db.query("UPDATE gma_upload_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[j.id]);const recovered=await claim(db,s,'worker-b');assert.equal(recovered.id,j.id);assert.equal(recovered.attempts,2);
 const base={session_id:s.id,job_id:j.id,worker:'worker-b'};
 await assert.rejects(video(db,'heartbeat',{...base,worker:'worker-a'}),/UPLOAD_LEASE_LOST/);
 const started=await video(db,'start',base);await video(db,'processing',base);
 const ready={...base,duration_seconds:100,metadata:{source_sha256:SHA,outputs_verified:true,processed_bytes:200,hls_prefix:started.output_prefix,master_key:started.output_prefix+'master.m3u8',temporary_bytes:300,processing_ms:20}};
 await video(db,'ready',ready);await video(db,'ready',ready);
 await command(db,'update_draft',{draft_id:d.id,revision:1,metadata:{title:'R2 HLS'}});
 const film=await command<{id:number;playback_kind:string;stream_uid:null}>(db,'publish',{draft_id:d.id,revision:2,request_hash:'published'});assert.equal(film.playback_kind,'r2_hls');assert.equal(film.stream_uid,null);
 assert.deepEqual(await command(db,'publish',{draft_id:d.id,revision:0,request_hash:'published'}),film);
 const q=(await db.query<{used_bytes:number;used_seconds:number}>("SELECT * FROM gma_upload_quota WHERE account_key='global'")).rows[0]!;assert.equal(Number(q.used_bytes),100);assert.equal(Number(q.used_seconds),0);
 assert.equal((await db.query("SELECT * FROM peliculas WHERE slug='legacy'")).rows.length,1);
}finally{await db.close();}});
test('cancel race fences worker output; terminal errors recorded dead and cannot publish',async()=>{const db=await setup();try{
 const {s,d}=await reserve(db);await uploaded(db,s);const j=await claim(db,s),input={session_id:s.id,job_id:j.id,worker:'worker-a'};
 await video(db,'start',input);await video(db,'failed',{...input,error:'VIDEO_IDENTITY_INVALID',terminal:true});
 const job=(await db.query<{state:string;last_error:string}>('SELECT * FROM gma_upload_jobs WHERE id=$1',[j.id])).rows[0]!;assert.equal(job.state,'dead');assert.equal(job.last_error,'VIDEO_IDENTITY_INVALID');
 await assert.rejects(video(db,'ready',{...input,duration_seconds:10}),/UPLOAD_LEASE_LOST/);
 await assert.rejects(command(db,'publish',{draft_id:d.id,revision:1,request_hash:'p'}));
 assert.equal(Number((await db.query<{reserved_bytes:number}>("SELECT * FROM gma_upload_quota WHERE account_key='global'")).rows[0]?.reserved_bytes),100);
}finally{await db.close();}});
test('renewal rejects generation mismatch, expired sessions, foreign ownership and cancellation',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await command(db,'bind',{session_id:s.id,provider_ref:s.object_key,provider_data:{multipartUploadId:'mpu'}});
 await assert.rejects(video(db,'authorize',{session_id:s.id,generation:2}),/UPLOAD_REVISION_CONFLICT/);
 await assert.rejects(video(db,'authorize',{session_id:s.id,generation:1},OTHER),/UPLOAD_NOT_FOUND/);
 await command(db,'cancel',{session_id:s.id});await assert.rejects(video(db,'authorize',{session_id:s.id,generation:1}),/UPLOAD_CANCELLED/);
}finally{await db.close();}});
test('HLS playback paths permit only verified derivatives, never original or arbitrary URL',()=>{
 const id=randomUUID(),asset={id,metadata:{hls_prefix:'media/'+id+'/hls/job/1/',outputs:[{relative:'master.m3u8'},{relative:'0/index.m3u8'},{relative:'0/segment-000000.ts'}]}} as unknown as MediaAsset;
 assert.equal(hlsObject(asset,'0/index.m3u8'),'media/'+id+'/hls/job/1/0/index.m3u8');
 assert.match(rewritePlaylist(asset,'master.m3u8','#EXTM3U\n0/index.m3u8\n'),new RegExp('/api/media/'+id+'/hls/0/index.m3u8'));
 assert.throws(()=>hlsObject(asset,'../original/source'));assert.throws(()=>hlsObject(asset,'https://evil.test/a'));assert.throws(()=>hlsObject(asset,'original/source'));
});
test('reselect different full SHA is rejected before signing or reading provider',async()=>{
 const s=session();const repo={session:async()=>s} as unknown as UploadRepository;
 const service=new UploadService(repo,{auxiliary:{} as never,video:{} as never});await assert.rejects(service.resume(OWNER,s.id,'b'.repeat(64),s.expected_input_bytes),/UPLOAD_SOURCE_MISMATCH/);
});

test('worker rejects different SHA before ffprobe; probe/transcode failures retry durably then become dead',async()=>{
 const {VideoProcessingWorker}=await import('../../lib/uploads/processing-worker');const {fixtureRepository,MemoryProcessingStorage}=await import('./processing-fixture');
 const {ProviderError}=await import('../../lib/uploads/stream');const {createHash}=await import('node:crypto');const {VideoProcessor}=await import('../../lib/uploads/video-processing');
 const {mkdtemp,mkdir,rm}=await import('node:fs/promises');const path=await import('node:path');
 const root=path.resolve('test-results/worker');await mkdir(root,{recursive:true});const temp=await mkdtemp(path.join(root,'failure-'));
 const old=process.env.VIDEO_WORK_DIR;process.env.VIDEO_WORK_DIR=temp;
 try {
  for(const failure of ['VIDEO_IDENTITY_INVALID','VIDEO_PROBE_FAILED','VIDEO_TRANSCODE_FAILED']) {
   const db=await setup();try{
    const source=Buffer.from('fixture only'),{d}=await reserve(db);await command(db,'abandon',{draft_id:d.id});
    const next=await command<UploadDraft>(db,'create_draft',{purpose:'title'}),key=randomUUID();
    const s=await command<UploadSession>(db,'reserve',{draft_id:next.id,revision:0,role:'main',bytes:source.length,sha256:failure==='VIDEO_IDENTITY_INVALID'?SHA:createHash('sha256').update(source).digest('hex'),file_name:'file.mp4',content_type:'video/mp4',idempotency_key:key,request_hash:key});
    const repo=fixtureRepository(db),storage=new MemoryProcessingStorage(s,source);
    await command(db,'bind',{session_id:s.id,provider_ref:s.object_key,provider_data:{multipartUploadId:'mpu'}});await repo.video(OWNER,'uploaded',{session_id:s.id,received_bytes:source.length,etag:'head'});
    let probes=0;
    const processor={probe:async()=>{probes++;if(failure==='VIDEO_PROBE_FAILED')throw new ProviderError(failure);return {duration:10};},process:async()=>{throw new ProviderError(failure);}} as unknown as InstanceType<typeof VideoProcessor>;
    const worker=new VideoProcessingWorker(repo,storage,processor),job=await repo.claimSession(s.id,'process','test-worker');assert.ok(job);await worker.run(job!,'test-worker');
    const result=(await db.query<{state:string;last_error:string}>("SELECT * FROM gma_upload_jobs WHERE kind='process'")).rows[0]!;
    if(failure==='VIDEO_IDENTITY_INVALID'){assert.equal(probes,0);assert.equal(result.state,'dead');}
    else {assert.equal(result.state,'pending');await db.query("UPDATE gma_upload_jobs SET attempts=11,run_after=now() WHERE kind='process'");const retry=await repo.claimSession(s.id,'process','test-retry');await worker.run(retry!,'test-retry');assert.equal((await db.query<{state:string}>("SELECT state FROM gma_upload_jobs WHERE kind='process'")).rows[0]?.state,'dead');}
    assert.equal(result.last_error,failure);assert.notEqual((await repo.asset(s.asset_id)).state,'ready');
   }finally{await db.close();}
  }
 }finally{if(old===undefined)delete process.env.VIDEO_WORK_DIR;else process.env.VIDEO_WORK_DIR=old;await rm(temp,{recursive:true,force:true});}
});
test('exhausted worker crash reconciles to visible dead error and durable cancellation',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await uploaded(db,s);const j=await claim(db,s);
 await db.query("UPDATE gma_upload_jobs SET attempts=12,lease_until=now()-interval '1 second' WHERE id=$1",[j.id]);await db.query('SELECT gma_upload_schedule()');
 const result=(await db.query<{state:string;last_error:string}>('SELECT * FROM gma_upload_jobs WHERE id=$1',[j.id])).rows[0]!;assert.equal(result.state,'dead');assert.equal(result.last_error,'VIDEO_WORKER_EXHAUSTED');
 assert.equal((await db.query<{state:string}>('SELECT state FROM gma_upload_sessions WHERE id=$1',[s.id])).rows[0]?.state,'cancelling');
}finally{await db.close();}});

test('read-only inventory detects missing HLS, orphan originals/derivatives and receipt missing SQL',async()=>{
 const {classifyStorage}=await import('../../lib/uploads/storage-inventory');const s=session(),prefix='media/'+s.asset_id+'/hls/job/1/';
 const a={id:s.asset_id,state:'ready',provider:'r2',metadata:{hls_prefix:prefix,original_key:'media/'+s.asset_id+'/original/source',outputs:[{relative:'master.m3u8',bytes:10},{relative:'0/index.m3u8',bytes:20}]}} as unknown as MediaAsset;
 const result=classifyStorage([s],[a],[{key:s.object_key!,bytes:s.expected_input_bytes},{key:prefix+'master.m3u8',bytes:10},{key:'media/'+s.asset_id+'/hls/old/1/a.ts',bytes:5},{key:'media/'+randomUUID()+'/original/source',bytes:2}],[]);
 assert.deepEqual(result.receivedWithoutSql,[s.id]);assert.deepEqual(result.incompleteReady,[s.asset_id]);assert.equal(result.orphanOriginals.length,1);assert.equal(result.orphanDerivatives.length,1);
});
test('worker temporal janitor preserves live lease and removes crashed attempt after grace period',async()=>{
 const {VideoProcessingWorker}=await import('../../lib/uploads/processing-worker');const {fixtureRepository}=await import('./processing-fixture');
 const {mkdtemp,mkdir,writeFile,utimes,stat,rm}=await import('node:fs/promises');const path=await import('node:path');
 const root=path.resolve('test-results/worker');await mkdir(root,{recursive:true});const temp=await mkdtemp(path.join(root,'janitor-'));const old=process.env.VIDEO_WORK_DIR;process.env.VIDEO_WORK_DIR=temp;
 const db=await setup();try{
  const {s}=await reserve(db);await uploaded(db,s);const j=await claim(db,s);const folder=path.join(temp,'gma-video-abc123');await mkdir(folder);await writeFile(path.join(folder,'.gma-worker.json'),JSON.stringify({job:j.id,worker:'worker-a'}));const before=new Date(Date.now()-1200000);await utimes(folder,before,before);
  const worker=new VideoProcessingWorker(fixtureRepository(db),{} as never,{} as never);await worker.cleanupTemps();assert.ok(await stat(folder));
  await db.query("UPDATE gma_upload_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[j.id]);await worker.cleanupTemps();await assert.rejects(stat(folder));
 }finally{await db.close();if(old===undefined)delete process.env.VIDEO_WORK_DIR;else process.env.VIDEO_WORK_DIR=old;await rm(temp,{recursive:true,force:true});}
});

test('video cancellation does not release quota while processing lease or recent R2 writes can remain',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await uploaded(db,s);const j=await claim(db,s);await video(db,'start',{session_id:s.id,job_id:j.id,worker:'worker-a'});
 await command(db,'cancel',{session_id:s.id});await db.query("UPDATE gma_upload_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",[s.id]);
 await assert.rejects(command(db,'delete_confirmed',{session_id:s.id,absent:true}),/UPLOAD_CLEANUP_UNCONFIRMED/);
 await db.query("UPDATE gma_upload_jobs SET state='done',lease_owner=NULL,lease_until=NULL,updated_at=now()-interval '4 minutes' WHERE id=$1",[j.id]);
 await command(db,'delete_confirmed',{session_id:s.id,absent:true});assert.equal(Number((await db.query<{reserved_bytes:number}>("SELECT reserved_bytes FROM gma_upload_quota WHERE account_key='global'")).rows[0]?.reserved_bytes),0);
 assert.equal((await db.query<{state:string}>('SELECT state FROM gma_processing_attempts WHERE job_id=$1',[j.id])).rows[0]?.state,'cancelled');
}finally{await db.close();}});

test('late failed callback cannot retire a ready asset or delete its publication',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await uploaded(db,s);const j=await claim(db,s),base={session_id:s.id,job_id:j.id,worker:'worker-a'},started=await video(db,'start',base);
 await video(db,'processing',base);await video(db,'ready',{...base,duration_seconds:100,metadata:{source_sha256:SHA,outputs_verified:true,processed_bytes:10,hls_prefix:started.output_prefix,master_key:started.output_prefix+'master.m3u8'}});
 const late=await video(db,'failed',{...base,error:'VIDEO_PROCESSING_FAILED',terminal:true});assert.equal(late.state,'ready');
 assert.equal((await db.query<{state:string}>('SELECT state FROM gma_media_assets WHERE id=$1',[s.asset_id])).rows[0]?.state,'ready');
}finally{await db.close();}});

test('actual service recovery: R2 completed, SQL unavailable, retry recovers HEAD and queues process exactly once',async()=>{const db=await setup();try{
 const {fixtureRepository}=await import('./processing-fixture');const {UploadError}=await import('../../lib/uploads/repository');
 const {s}=await reserve(db);await command(db,'bind',{session_id:s.id,provider_ref:s.object_key,provider_data:{multipartUploadId:'upload-1'}});
 const f=new FakeR2();f.s=await fixtureRepository(db).session(s.id);f.parts=[{PartNumber:1,Size:100,ETag:'"only"'}];f.uploads.add('upload-1');f.completeLost=true;
 const repo=fixtureRepository(db),original=repo.video.bind(repo);let fail=true;
 repo.video=async(owner,action,payload)=>{if(action==='uploaded'&&fail){fail=false;throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE',503);}return original(owner,action,payload);};
 repo.enqueue=async(kind,id,payload,key,after)=> (await db.query<{j:import('../../lib/uploads/types').UploadJob}>('SELECT to_jsonb(gma_upload_enqueue_job($1,$2,$3::jsonb,$4,$5)) j',[kind,id,JSON.stringify(payload),key,after??new Date().toISOString()])).rows[0]!.j;
 const service=new UploadService(repo,{video:f.provider(),auxiliary:{} as never});assert.equal((await service.complete(OWNER,s.id)).state,'received');
 assert.equal(f.complete,true);assert.equal((await db.query<{state:string}>("SELECT state FROM gma_upload_jobs WHERE kind='verify'")).rows[0]?.state,'pending');
 await db.exec("UPDATE gma_upload_jobs SET run_after=now() WHERE kind='verify'");assert.equal((await service.complete(OWNER,s.id)).state,'validating');
 assert.equal(f.calls.filter(c=>c==='CompleteMultipartUploadCommand').length,1);assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE kind='process'")).rows.length,1);
}finally{await db.close();}});
test('ready-source cleanup targets only temporary ingest, never permanent original or HLS',async()=>{
 const f=new FakeR2(),keys:string[]=[],send=f.send.bind(f);f.complete=true;
 f.send=async command=>{if(command instanceof DeleteObjectCommand)keys.push(command.input.Key!);return send(command);};
 await f.provider().cleanupIngest(f.s);assert.deepEqual(keys,[f.s.object_key]);assert.equal(f.calls.includes('ListObjectsV2Command'),false);
});

test('processing lease requires worker identity even when omitted; crashed non-video jobs become dead',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await uploaded(db,s);const j=await claim(db,s);
 await assert.rejects(video(db,'heartbeat',{session_id:s.id,job_id:j.id}),/UPLOAD_LEASE_LOST/);
 await db.exec("UPDATE gma_upload_jobs SET state='running',attempts=12,lease_until=now()-interval '1 second' WHERE kind='provision'");await db.query('SELECT gma_upload_schedule()');
 const row=(await db.query<{state:string;last_error:string}>("SELECT * FROM gma_upload_jobs WHERE kind='provision'")).rows[0]!;assert.equal(row.state,'dead');assert.equal(row.last_error,'UPLOAD_WORKER_EXHAUSTED');
}finally{await db.close();}});

test('reserve replay after transfer receipt returns complete even after temporary ingest cleanup',async()=>{
 const s=session();s.state='uploaded';s.provider_data.received_bytes=s.expected_input_bytes;
 const repo={command:async()=>s,session:async()=>s,claimSession:async()=>null} as unknown as UploadRepository;
 const service=new UploadService(repo,{auxiliary:{} as never,video:{createUpload:async()=>{throw new Error('must not recreate');}} as never});
 const replay=await service.reserve(OWNER,{draft_id:s.draft_id,revision:0,role:'main',bytes:s.expected_input_bytes,sha256:s.source_sha256,file_name:s.file_name,content_type:s.content_type,idempotency_key:randomUUID()});
 assert.equal(replay.id,s.id);assert.equal(replay.provider_data.transfer_complete,true);
});

test('segment authority stays in SQL; compact summary omits output inventory and RPCs are service-only',async()=>{const db=await setup();try{
 const {s}=await reserve(db);await uploaded(db,s);const j=await claim(db,s),base={session_id:s.id,job_id:j.id,worker:'worker-a'},started=await video(db,'start',base);await video(db,'processing',base);
 await video(db,'ready',{...base,duration_seconds:100,metadata:{source_sha256:SHA,outputs_verified:true,processed_bytes:10,hls_prefix:started.output_prefix,master_key:started.output_prefix+'master.m3u8',outputs:[{relative:'0/segment-000000.ts',bytes:10,mime:'video/mp2t'}]}});
 const summary=(await db.query<{r:MediaAsset}>('SELECT gma_video_asset_summary($1) r',[s.asset_id])).rows[0]!.r;assert.equal(summary.metadata.outputs,undefined);assert.equal(summary.state,'ready');
 const output=(await db.query<{r:{key:string;asset:MediaAsset}}>('SELECT gma_video_output($1,$2) r',[s.asset_id,'0/segment-000000.ts'])).rows[0]!.r;assert.equal(output.key,started.output_prefix+'0/segment-000000.ts');assert.equal(output.asset.metadata.outputs,undefined);
 await assert.rejects(db.query('SELECT gma_video_output($1,$2)',[s.asset_id,'original/source']),/UPLOAD_NOT_FOUND/);
 await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT gma_video_asset_summary($1)',[s.asset_id]),/permission denied/);await assert.rejects(db.query('SELECT gma_video_output($1,$2)',[s.asset_id,'0/segment-000000.ts']),/permission denied/);await db.exec('RESET ROLE');
}finally{await db.close();}});
