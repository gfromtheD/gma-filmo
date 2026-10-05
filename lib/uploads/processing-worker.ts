import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,open,readFile,writeFile,readdir,stat,rm,statfs} from 'node:fs/promises';
import path from 'node:path';
import {getUploadConfig,requiredEnv} from './config';
import {UploadRepository,UploadError} from './repository';
import {R2VideoProvider} from './r2-video';
import {ProviderError} from './stream';
import {VideoProcessor,directoryBytes,PROCESSING_POLICY} from './video-processing';
import type {UploadJob,UploadSession} from './types';

export interface ProcessingStorage {
 verifyObject(s:UploadSession):Promise<{complete:boolean;receivedBytes:number;etag?:string}>;
 read(key:string,etag?:string):Promise<{Body?:unknown}>;
 retainOriginal(s:UploadSession,etag:string):Promise<string>;
 put(key:string,body:Uint8Array,mime:string):Promise<void>;
 deletePrefix(prefix:string):Promise<void>;
 verifyOutput(key:string,size:number,sha256:string):Promise<void>;
}
export class VideoProcessingWorker {
 constructor(readonly repo=new UploadRepository(),private storage:ProcessingStorage=new R2VideoProvider(getUploadConfig().bucket),private processor=new VideoProcessor()){}
 async cleanupTemps() {
  const root=requiredEnv('VIDEO_WORK_DIR');if(!path.isAbsolute(root))throw new ProviderError('VIDEO_TEMP_PATH_INVALID');await mkdir(root,{recursive:true});
  for(const dir of await readdir(root,{withFileTypes:true})) {
   if(!dir.isDirectory()||!/^gma-video-[a-zA-Z0-9]+$/.test(dir.name))continue;
   const folder=path.join(root,dir.name);
   try {const marker=JSON.parse(await readFile(path.join(folder,'.gma-worker.json'),'utf8')) as {job:string;worker:string};
    if(!/^[a-f0-9-]{36}$/.test(marker.job)||!marker.worker)continue;
    const lease=await this.repo.jobLease(marker.job);
    const age=Date.now()-(await stat(folder)).mtimeMs;
    if(age<600000||lease?.state==='running'&&lease.lease_owner===marker.worker&&Date.parse(lease.lease_until??'')>Date.now())continue;
    await rm(folder,{recursive:true,force:true});
   }catch{/* unknown marker or database uncertainty: retain until an authoritative check succeeds */}
  }
 }
 async tick() {
  if(process.env.VIDEO_PROCESSING_ENABLED!=='true')return 0;
  await this.cleanupTemps();
  const worker=randomUUID(),job=await this.repo.claimSession(null,'process',worker);if(!job)return 0;
  await this.run(job,worker);return 1;
 }
 async run(job:UploadJob,worker:string) {
  const abort=new AbortController();let temp:string|undefined,prefix:string|undefined,s:UploadSession|undefined,monitor:ReturnType<typeof setInterval>|undefined;
  let ticking=false,monitorError:string|undefined;
  const started=Date.now();
  const heartbeat=async()=>{if(!s)throw new UploadError('UPLOAD_INVALID_JOB');let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([this.repo.video(s.owner_id,'heartbeat',{session_id:s.id,job_id:job.id,worker}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new UploadError('UPLOAD_LEASE_LOST')),30000);})]);}finally{if(timer)clearTimeout(timer);}
  };
  try {
   if(!job.session_id)throw new UploadError('UPLOAD_INVALID_JOB');s=await this.repo.session(job.session_id);
   if((await this.repo.asset(s.asset_id)).state==='ready'){await this.repo.finishJob(job.id,worker,true);return;}
   const begun=await this.repo.video<{output_prefix:string}>(s.owner_id,'start',{session_id:s.id,job_id:job.id,worker});prefix=begun.output_prefix;
   const root=requiredEnv('VIDEO_WORK_DIR');if(!path.isAbsolute(root))throw new ProviderError('VIDEO_TEMP_PATH_INVALID');await mkdir(root,{recursive:true});
   const disk=await statfs(root);if(disk.bavail*disk.bsize<PROCESSING_POLICY.maxTemporaryBytes)throw new ProviderError('VIDEO_DISK_CAPACITY');
   temp=await mkdtemp(path.join(root,'gma-video-'));
   await writeFile(path.join(temp,'.gma-worker.json'),JSON.stringify({job:job.id,worker}));
   monitor=setInterval(()=>{if(ticking)return;ticking=true;void (async()=>{await heartbeat();if(Date.now()-started>PROCESSING_POLICY.wallTimeMs || (temp&&await directoryBytes(temp)>PROCESSING_POLICY.maxTemporaryBytes))throw new ProviderError('VIDEO_RESOURCE_LIMIT');})().catch(e=>{monitorError=e instanceof ProviderError||e instanceof UploadError?e.code:'VIDEO_LEASE_OR_RESOURCE_LOST';abort.abort();}).finally(()=>{ticking=false;});},15000);
   const receipt=await this.storage.verifyObject(s);if(!receipt.complete||!receipt.etag)throw new ProviderError('VIDEO_ORIGINAL_MISSING');
   const original=await this.storage.read(s.object_key!,receipt.etag);if(!original.Body)throw new ProviderError('VIDEO_ORIGINAL_MISSING');
   const file=await open(path.join(temp,'source'),'wx');const hash=createHash('sha256');let bytes=0;
   try{for await(const chunk of original.Body as AsyncIterable<Uint8Array>){if(abort.signal.aborted)throw new ProviderError('VIDEO_INTERRUPTED');bytes+=chunk.length;if(bytes>s.expected_input_bytes)throw new ProviderError('VIDEO_IDENTITY_INVALID');hash.update(chunk);await file.writeFile(chunk);}}
   finally{await file.close();}
   if(bytes!==s.expected_input_bytes || hash.digest('hex')!==s.source_sha256)throw new ProviderError('VIDEO_IDENTITY_INVALID');
   const metadata=await this.processor.probe(temp,'source',s.max_duration_seconds,abort.signal);
   await this.repo.video(s.owner_id,'processing',{session_id:s.id,job_id:job.id,worker,metadata:{probe:metadata,source_sha256:s.source_sha256}});
   const result=await this.processor.process(temp,metadata,abort.signal);
   await heartbeat();const originalKey=await this.storage.retainOriginal(s,receipt.etag);
   for(const output of result.outputs) {
    await heartbeat();if(abort.signal.aborted)throw new ProviderError('VIDEO_INTERRUPTED');
    const body=await readFile(path.join(temp,'output',output.relative));
    await this.storage.put(prefix+output.relative,body,output.mime);
    await this.storage.verifyOutput(prefix+output.relative,body.length,createHash('sha256').update(body).digest('hex'));
   }
   // Storage adapter confirms bytes on PUT; pipeline verifies decode, playlists and every reference before publication.
   await heartbeat();
   await this.repo.video(s.owner_id,'ready',{session_id:s.id,job_id:job.id,worker,duration_seconds:metadata.duration,metadata:{
    probe:metadata,source_sha256:s.source_sha256,original_key:originalKey,hls_prefix:prefix,master_key:prefix+'master.m3u8',poster_key:prefix+'poster.jpg',
    outputs_verified:true,outputs:result.outputs,profiles:result.profiles,profile_version:PROCESSING_POLICY.version,
    original_bytes:bytes,processed_bytes:result.processedBytes,temporary_bytes:await directoryBytes(temp),processing_ms:Date.now()-started,
    throughput_bytes_per_second:Math.round(bytes/Math.max(1,(Date.now()-started)/1000))}});
   await this.repo.finishJob(job.id,worker,true);
  }catch(e) {
   const code=monitorError??(e instanceof ProviderError||e instanceof UploadError?e.code:'VIDEO_PROCESSING_FAILED');
   const terminal=/IDENTITY_INVALID|METADATA_INVALID|HLS_INCOMPLETE|OUTPUT_INVALID|OUTPUT_TOO_LARGE|PROCESSING_TIMEOUT|RESOURCE_LIMIT|TOOL_OUTPUT_TOO_LARGE/.test(code)||job.attempts>=12;
   let mayClean=false,cancelled=false;
   if(s)try {
    const current=await this.repo.asset(s.asset_id);
    if(current.state==='ready' && current.metadata.hls_prefix===prefix){
     try{await this.repo.finishJob(job.id,worker,true);}catch{/* completion is reconciled later */}
     return;
    }
    cancelled=['deleting','deleted'].includes(current.state);
    mayClean=current.metadata.hls_prefix!==prefix;
   }catch{/* uncertain SQL commit: retain outputs until reconciliation can prove no reference */}
   // Fenced writes reject dead workers and cancellation races. Never overwrite newer state.
   let cleanupConfirmed=false;
   if(s)try{
    const failure=await this.repo.video<{state?:string;metadata?:Record<string,unknown>}>(s.owner_id,'failed',{session_id:s.id,job_id:job.id,worker,error:code,terminal});
    if(failure.state==='ready'&&failure.metadata?.hls_prefix===prefix){try{await this.repo.finishJob(job.id,worker,true);}catch{/* reconciler completes the lease */}return;}
    cleanupConfirmed=true;
   }catch{/* no SQL fence acknowledgement: keep outputs for reconciliation */}
   try{await this.repo.finishJob(job.id,worker,cancelled,code,new Date(Date.now()+Math.min(300000,10000*2**Math.min(job.attempts,5))).toISOString());}catch{/* a newer lease owns the retry */}
   if(prefix&&mayClean&&cleanupConfirmed)try{await this.storage.deletePrefix(prefix);}catch{/* cancellation/reconciler retains reservation until confirmed cleanup */}
  }finally{abort.abort();if(monitor)clearInterval(monitor);if(temp)await rm(temp,{recursive:true,force:true});}
 }
}
