import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {database,OWNER} from './database';import {serviceRepository} from './service-fixture';
import {MediaService} from '../../lib/media/service';import {MediaProviderRegistry} from '../../lib/media/registry';import {StreamMediaProvider} from '../../lib/media/providers/stream';import {StreamProvider} from '../../lib/uploads/stream';
test('4.2/4.3 legacy Stream concrete adapter receives and polls to READY without provider byte metadata',async()=>{
 const db=await database();const prior=process.env.MEDIA_VIDEO_PROVIDER;process.env.MEDIA_VIDEO_PROVIDER='r2';try{
 await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');const repo=serviceRepository(db);
 const stream={create:async()=>({providerRef:'stream1234567890',uploadUrl:'https://upload.example/tus/1',expiresAt:new Date(Date.now()+3600000).toISOString()}),assertTransferUrl:()=>{},received:async()=>100,
 observe:async()=>({found:true,state:'ready',readyToStream:true,processingProgress:100,durationSeconds:12,receivedBytes:null})} as unknown as StreamProvider;
 // Stream provisioning is already durable from Phase2; use the real adapter for complete/verify.
 const draft=await repo.uploadCommand(OWNER,'create_draft',{purpose:'title'}) as {id:string;revision:number};
 const session=repo.parseSession(await repo.uploadCommand(OWNER,'reserve',{draft_id:draft.id,revision:draft.revision,role:'main',bytes:100,sha256:createHash('sha256').update('stream').digest('hex'),content_type:'video/mp4',file_name:'film.mp4',idempotency_key:randomUUID(),request_hash:'b'.repeat(64),video_provider:'stream',auxiliary_provider:'r2'}));
 await repo.command(OWNER,'bind_upload',{session_id:session.id,transfer_generation:1,upload_id:'stream1234567890',provider_media_id:'stream1234567890',private_state:{uploadId:'stream1234567890'}});
 const provision=await repo.claimSession(session.id,'provision','fixture');if(provision)await repo.finishJob(provision.id,'fixture',true);
 const provider=new StreamMediaProvider(stream);const service=new MediaService(repo,new MediaProviderRegistry({stream:()=>provider,r2:()=>{throw Error('no R2');},mock:()=>{throw Error('no mock');},peertube:()=>{throw Error('no PT');}}));
 await service.complete(OWNER,session.id,1);await service.tick(1);assert.equal((await repo.asset(session.asset_id)).state,'ready');assert.equal((await repo.session(session.id)).quota_confirmed,true);
 }finally{if(prior===undefined)delete process.env.MEDIA_VIDEO_PROVIDER;else process.env.MEDIA_VIDEO_PROVIDER=prior;await db.close();}
});
test('4.2/4.3 neutral R2 receipt reuses historical worker and keeps process outside API executor',async()=>{
 const {R2MediaProvider}=await import('../../lib/media/providers/r2');const {R2VideoProvider}=await import('../../lib/uploads/r2-video');const {AuxiliaryProvider}=await import('../../lib/uploads/auxiliary');
 const {legacySession}=await import('../../lib/media/providers/legacy-context');const {fixtureRepository,MemoryProcessingStorage}=await import('../uploads/processing-fixture');const {VideoProcessingWorker}=await import('../../lib/uploads/processing-worker');const {VideoProcessor}=await import('../../lib/uploads/video-processing');
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const path=await import('node:path');
 const db=await database();const root=path.resolve('test-results/neutral-r2');await mkdir(root,{recursive:true});const temp=await mkdtemp(path.join(root,'worker-'));const previous=process.env.VIDEO_WORK_DIR;process.env.VIDEO_WORK_DIR=temp;
 try{
 await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');const repo=serviceRepository(db);const source=Buffer.from('controlled R2 source');
 const draft=await repo.uploadCommand(OWNER,'create_draft',{purpose:'title'}) as {id:string;revision:number};
 const session=repo.parseSession(await repo.uploadCommand(OWNER,'reserve',{draft_id:draft.id,revision:draft.revision,role:'main',bytes:source.length,sha256:createHash('sha256').update(source).digest('hex'),file_name:'film.mp4',content_type:'video/mp4',idempotency_key:randomUUID(),request_hash:'c'.repeat(64),video_provider:'r2',auxiliary_provider:'r2'}));
 const video={createUpload:async()=>({providerRef:session.object_key,multipartUploadId:'multipart-local',partSize:8388608,expiresAt:session.expires_at}),completeUpload:async()=>({complete:true,receivedBytes:source.length,etag:'etag',parts:[{number:1,size:source.length,etag:'etag'}]}),inspectUpload:async()=>({complete:true,receivedBytes:source.length,etag:'etag',parts:[{number:1,size:source.length,etag:'etag'}]})} as unknown as InstanceType<typeof R2VideoProvider>;
 const provider=new R2MediaProvider(video,{} as InstanceType<typeof AuxiliaryProvider>);const service=new MediaService(repo,new MediaProviderRegistry({r2:()=>provider,mock:()=>{throw Error('no mock');},stream:()=>{throw Error('no Stream');},peertube:()=>{throw Error('no PT');}}));
 await service.provision(session.id,OWNER);await service.complete(OWNER,session.id,1);await service.tick(1);
 assert.equal((await repo.asset(session.asset_id)).state,'validating');assert.equal(await service.tick(1),0);
 const job=await repo.claimSession(session.id,'process','r2-worker');assert.ok(job);
 const storage=new MemoryProcessingStorage(legacySession(await repo.session(session.id),'r2'),source);
 const processor={probe:async()=>({duration:12}),process:async(directory:string)=>{await mkdir(path.join(directory,'output'),{recursive:true});const body=Buffer.from('#EXTM3U\n');await writeFile(path.join(directory,'output/master.m3u8'),body);return {outputs:[{relative:'master.m3u8',bytes:body.length,mime:'application/vnd.apple.mpegurl'}],profiles:[],processedBytes:body.length};}} as unknown as InstanceType<typeof VideoProcessor>;
 await new VideoProcessingWorker(fixtureRepository(db),storage,processor).run(job,'r2-worker');
 const asset=await repo.asset(session.asset_id);assert.equal(asset.state,'ready');assert.equal((await repo.session(session.id)).quota_confirmed,true);assert.equal((await db.query("SELECT * FROM gma_upload_ledger WHERE event='confirm'")).rows.length,3);
 }finally{if(previous===undefined)delete process.env.VIDEO_WORK_DIR;else process.env.VIDEO_WORK_DIR=previous;await rm(temp,{recursive:true,force:true});await db.close();}
});
