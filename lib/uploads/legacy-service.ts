import { createHash, randomUUID } from 'node:crypto';
import { getUploadConfig, getStreamConfig, videoProvider } from './config';
import { UploadError, UploadRepository } from './repository';
import { AuxiliaryProvider } from './auxiliary';
import { StreamProvider, ProviderError } from './stream';
import { FutureManagedVideoProvider } from './future-managed-video';
import type { VideoIngestProvider } from './video-provider';
import { R2VideoProvider } from './r2-video';
import { assertUploadInput, isVideoRole } from './policy';
import { reserveSchema } from './contracts';
import type { UploadSession, MediaAsset, UploadJob } from './types';

export const requestHash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class UploadService {
 private streamInstance?:StreamProvider; private auxiliary:AuxiliaryProvider; private videoInstance?:VideoIngestProvider;
 private get stream(){return this.streamInstance??=new StreamProvider(getStreamConfig());}
 private get video(){return this.videoInstance??=new R2VideoProvider(getUploadConfig().bucket);}
 constructor(readonly repo=new UploadRepository(),providers?:{stream?:StreamProvider;auxiliary:AuxiliaryProvider;video?:VideoIngestProvider}) {
   if(providers){this.streamInstance=providers.stream;this.auxiliary=providers.auxiliary;this.videoInstance=providers.video;}
   else {const config=getUploadConfig();this.auxiliary=new AuxiliaryProvider(config.bucket);}
 }
 async reserve(owner:string,input:unknown) {
   const payload=reserveSchema.parse(input);assertUploadInput(payload.role,payload.bytes,payload.sha256);
   const identity={...payload,revision:undefined};
   const session=await this.repo.command<UploadSession>(owner,'reserve',{...payload,video_provider:isVideoRole(payload.role)?videoProvider():'r2',request_hash:requestHash(identity)});
   await this.runSession(session.id,'provision');
   const current=await this.repo.session(session.id,owner);
   return current.state==='uploaded' && Number(current.provider_data.received_bytes)===current.expected_input_bytes?{...current,provider_data:{...current.provider_data,transfer_complete:true}}:current;
 }
 async resume(owner:string,id:string,sha256:string,bytes:number) {
   let session=await this.repo.session(id,owner);
   if(session.source_sha256!==sha256 || session.expected_input_bytes!==bytes)throw new UploadError('UPLOAD_SOURCE_MISMATCH',400);
   if(Date.now()>=Date.parse(session.expires_at))throw new UploadError('UPLOAD_EXPIRED');
   if(session.state==='uploaded' && Number(session.provider_data.received_bytes)===session.expected_input_bytes)return {...session,provider_data:{...session.provider_data,transfer_complete:true}};
   if(!['uploading','paused','provisioning'].includes(session.state))throw new UploadError('UPLOAD_REVISION_CONFLICT');
   if(session.provider==='r2' && isVideoRole(session.role)) {
     await this.runSession(id,'provision');session=await this.repo.session(id,owner);
     const inspection=await this.video.resumeUpload(session);
     if(inspection.complete) {await this.repo.video(owner,'uploaded',{session_id:id,received_bytes:inspection.receivedBytes,etag:inspection.etag});return {...await this.repo.session(id,owner),provider_data:{...session.provider_data,transfer_complete:true}};}
   } else if(session.provider==='r2') {
     const transfer=await this.auxiliary.transfer(session);
     session=await this.repo.command(owner,'bind',{session_id:id,provider_ref:transfer.providerRef,provider_data:transfer});
   } else await this.runSession(id,'provision');
   if(session.state==='paused')await this.repo.command(owner,'pause',{session_id:id,paused:false});
   session=await this.repo.session(id,owner);
   if(typeof session.provider_data.uploadUrl!=='string' && !session.multipart_upload_id)throw new UploadError('UPLOAD_PROVISION_RECOVERY_REQUIRED',503);
   return session;
 }
 async inspect(owner:string,id:string) {
   const s=await this.repo.session(id,owner);if(s.provider!=='r2'||!isVideoRole(s.role))throw new UploadError('UPLOAD_INVALID_INPUT',400);
   return {...await this.video.inspectUpload(s),partSize:Number(s.part_size),generation:s.transfer_generation};
 }
 async signPart(owner:string,id:string,number:number,generation:number) {
   const s=await this.repo.video<UploadSession>(owner,'authorize',{session_id:id,generation});
   if(!this.video.signPart)throw new UploadError('UPLOAD_INVALID_INPUT',400);return this.video.signPart(s,number);
 }
 async complete(owner:string,id:string) {
   const session=await this.repo.session(id,owner);
   await this.repo.enqueue('verify',id,{},`verify:${id}`);
   await this.runSession(id,'verify');
   return this.repo.asset(session.asset_id);
 }
 async runSession(id:string,kind:string) {
   const worker=randomUUID();const job=await this.repo.claimSession(id,kind,worker);
   if(job)await this.run(job,worker);
 }
 async run(job:UploadJob,worker:string) {
   let retrySession:UploadSession|undefined;
   try {
     if(!job.session_id)throw new UploadError('UPLOAD_INVALID_JOB');
     const s=await this.repo.session(job.session_id);retrySession=s;
     const a=await this.repo.asset(s.asset_id);
     if(job.kind==='provision')await this.provision(s);
     else if(job.kind==='delete')await this.remove(s,a);
     else if(job.kind==='verify')await this.verify(s,a);
     else await this.reconcile(s,a);
     await this.repo.finishJob(job.id,worker,true);
   } catch(e) {
     const code=e instanceof ProviderError || e instanceof UploadError?e.code:'UPLOAD_JOB_FAILED';
     const backoff=Date.now()+Math.min(300000,10000*2**Math.min(job.attempts,5));
     const retryTime=code==='UPLOAD_CLEANUP_UNCONFIRMED' && retrySession?Math.max(backoff,Date.parse(retrySession.expires_at)+1000):backoff;
     await this.repo.finishJob(job.id,worker,false,code,new Date(retryTime).toISOString());
     // The job retains the error and reservation; never report a fabricated receipt.
   }
 }
 private async provision(s:UploadSession) {
   if(s.provider_ref || s.state!=='provisioning')return;
   if(s.provider==='r2' && isVideoRole(s.role)) {
     const attempt={...s,provider_data:{...s.provider_data}};
     if(!s.provider_data.provision_started)await this.repo.command(s.owner_id,'intent',{session_id:s.id});
     const transfer=await this.video.createUpload(attempt);
     await this.repo.command(s.owner_id,'bind',{session_id:s.id,provider_ref:transfer.providerRef,provider_data:transfer});return;
   }
   if(s.provider==='r2') {
     const transfer=await this.auxiliary.transfer(s);
     await this.repo.command(s.owner_id,'bind',{session_id:s.id,provider_ref:transfer.providerRef,provider_data:transfer});return;
   }
   if(s.provider_data.provision_started) {
     const ref=(await new FutureManagedVideoProvider(this.stream).createUpload(s)).providerRef;
     if(ref)await this.repo.command(s.owner_id,'bind',{session_id:s.id,provider_ref:ref,provider_data:{recovery_requires_reselection:true}});
     // Missing POST response means the one-time Location is unavailable. Do not create a duplicate video.
     throw new UploadError('UPLOAD_PROVISION_RECOVERY_REQUIRED',503);
   }
   const firstAttempt={...s,provider_data:{...s.provider_data}};
   await this.repo.command(s.owner_id,'intent',{session_id:s.id});
   const transfer=await new FutureManagedVideoProvider(this.stream).createUpload(firstAttempt);
   await this.repo.command(s.owner_id,'bind',{session_id:s.id,provider_ref:transfer.providerRef,provider_data:transfer});
 }
 private async verify(s:UploadSession,a:MediaAsset) {
   if(['cancelling','cancelled','expired'].includes(s.state)||a.state==='ready')return;
   if(!s.provider_ref)throw new UploadError('UPLOAD_PROVISION_PENDING');
   if(s.provider==='r2' && isVideoRole(s.role)) {
     const received=await this.video.completeUpload(s);
     await this.repo.video(s.owner_id,'uploaded',{session_id:s.id,received_bytes:received.receivedBytes,etag:received.etag});return;
   }
   if(s.provider==='r2') {
     try {
       const verified=await this.auxiliary.verify(s);
       await this.repo.command(s.owner_id,'observe',{session_id:s.id,state:'ready',...verified});
     } catch(e) {
       const code=e instanceof ProviderError?e.code:'';
       if(/INVALID|TOO_LARGE/.test(code))await this.repo.command(s.owner_id,'observe',{session_id:s.id,state:'rejected',metadata:{reason:code}});
       throw e;
     }
     return;
   }
   let received=Number(s.provider_data.received_bytes)||null;
   if(!received) {
     received=await this.stream.received(s);
     if(received)await this.repo.command(s.owner_id,'receipt',{session_id:s.id,received_bytes:received});
   }
   const observed=await this.stream.observe(s.provider_ref);
   if(!observed.found)throw new UploadError('UPLOAD_PROVIDER_OBJECT_MISSING');
   if(observed.state==='rejected' || (observed.durationSeconds!==null && (observed.durationSeconds<=0 || observed.durationSeconds>s.max_duration_seconds))) {
     await this.repo.command(s.owner_id,'observe',{session_id:s.id,state:'rejected'});return;
   }
   if(observed.state==='ready' && !received)throw new UploadError('UPLOAD_RECEIPT_UNVERIFIED');
   await this.repo.command(s.owner_id,'observe',{session_id:s.id,state:observed.state==='ready'?'ready':'processing',
     received_bytes:received,provider_reported_size:observed.providerReportedSize,duration_seconds:observed.durationSeconds,
     ready_to_stream:observed.readyToStream,pct_complete:observed.processingProgress,metadata:{quality_policy:'1080p-sdr-stereo-no-master'}});
   if(observed.state!=='ready')throw new UploadError('UPLOAD_PROCESSING_PENDING');
 }
 private async remove(s:UploadSession,a:MediaAsset) {
   // SQL's final confirmation checks references again, after the external deletion.
   if(a.state!=='deleting' && s.state!=='cancelling')return;
   let absent=false;
   if(s.provider==='r2' && isVideoRole(s.role))absent=await this.video.deleteObject(s);
   else if(s.provider==='r2')absent=await this.auxiliary.delete(s);
   else {
     let ref=s.provider_ref;
     if(!ref && s.provider_data.provision_started) {
       ref=await this.stream.recover(s);
       if(!ref)throw new UploadError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
       await this.repo.command(s.owner_id,'bind',{session_id:s.id,provider_ref:ref,provider_data:{}});
     }
     absent=ref?await this.stream.delete(ref):true;
   }
   if(!absent)throw new UploadError('UPLOAD_CLEANUP_UNCONFIRMED');
   await this.repo.command(s.owner_id,'delete_confirmed',{session_id:s.id,absent:true});
 }
 private async reconcile(s:UploadSession,a:MediaAsset) {
   if(s.state==='cancelling' || a.state==='deleting')return this.remove(s,a);
   if(a.state==='ready') {
     if(s.provider==='r2' && isVideoRole(s.role))for(const prefix of await this.repo.orphanPrefixes(s.id)){
       if(!prefix.startsWith('media/'+s.asset_id+'/hls/'))throw new UploadError('UPLOAD_INVALID_ASSET');
       if(this.video.deletePrefix)await this.video.deletePrefix(prefix);
     }
     const draft=s.draft_id?await this.repo.draft(s.owner_id,s.draft_id):null;
     if((draft?.state==='draft' && Date.now()>Date.parse(s.expires_at)+6*86400000)
       || (a.role==='avatar' && Date.now()>Date.parse(s.expires_at) && !(await this.repo.mayReadAsset(a,null)))) {
       await this.repo.command(s.owner_id,'cancel',{session_id:s.id});return;
     }
     if(s.provider==='r2'){if(isVideoRole(s.role))await this.video.cleanupIngest?.(s);else if(Date.now()>=Date.parse(s.expires_at))await this.auxiliary.cleanupIngest(s);}
     return;
   }
   if(s.provider==='r2' && isVideoRole(s.role) && s.state==='uploaded') {
     await this.repo.enqueue('process',s.id,{},`process:${s.id}:${s.transfer_generation}`);return;
   }
   if(Date.now()>=Date.parse(s.expires_at)) {
     await this.repo.command(s.owner_id,'cancel',{session_id:s.id});return;
   }
   if(s.state==='provisioning')return this.provision(s);
   if(s.provider==='r2' && isVideoRole(s.role)){const receipt=await this.video.inspectUpload(s);if(receipt.complete)await this.repo.video(s.owner_id,'uploaded',{session_id:s.id,received_bytes:receipt.receivedBytes,etag:receipt.etag});return;}
   await this.verify(s,a);
 }
 async tick(limit=5) {
   await this.repo.scheduleReconciliation();const worker=randomUUID();let count=0;
   const deadline=Date.now()+20000;
   while(count<limit && Date.now()<deadline) {
     const job=await this.repo.claimSession(null,null,worker);if(!job)break;
     await this.run(job,worker);count++;
   }
   for(const account of await this.repo.pendingAccountDeletions()) {
     if(account.state==='cleanup') {
       if(!(await this.repo.accountCleanupComplete(account.owner_id)))continue;
       await this.repo.command(account.owner_id,'purge_account',{});
     }
     await this.repo.deleteAuthAccount(account.owner_id);
   }
   return count;
 }
}
