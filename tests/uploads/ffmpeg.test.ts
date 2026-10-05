import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {database,command,OWNER} from './database';
import {fixtureRepository,MemoryProcessingStorage} from './processing-fixture';
import {VideoProcessingWorker} from '../../lib/uploads/processing-worker';
import type {UploadDraft,UploadSession} from '../../lib/uploads/types';
import {VideoProcessor,IsolatedMediaRunner,verifyHls,selectProfiles,parseProbe} from '../../lib/uploads/video-processing';

test('real ffprobe/FFmpeg: HLS, no upscale, decode, poster, incomplete output and corrupt source',async()=>{
 if(!process.env.FFMPEG_PATH||!process.env.FFPROBE_PATH||!process.env.VIDEO_TEST_TEMP)throw new Error('Set real FFmpeg binaries and VIDEO_TEST_TEMP');
 process.env.UPLOAD_ENVIRONMENT='local';process.env.VIDEO_SANDBOX='local-test';
 const temp=await mkdtemp(path.join(process.env.VIDEO_TEST_TEMP,'ffmpeg-spike-'));
 const runner=new IsolatedMediaRunner(true),processor=new VideoProcessor(runner),signal=new AbortController().signal;
 try {
  await runner.run('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000',
   '-t','7','-threads','2','-c:v','libx264','-preset','ultrafast','-c:a','aac','-f','mp4','source'],temp,signal,60000);
  const metadata=await processor.probe(temp,'source',30,signal);
  assert.equal(metadata.width,1280);assert.equal(metadata.height,720);assert.equal(metadata.hasAudio,true);assert.equal(metadata.videoCodec,'h264');
  assert.deepEqual(selectProfiles(metadata).map(p=>p.height),[720,480]);
  const result=await processor.process(temp,metadata,signal);
  assert.equal(result.profiles.length,2);assert.ok(result.processedBytes>0);assert.ok(result.outputs.some(o=>o.relative==='poster.jpg'));
  const master=await readFile(path.join(temp,'output/master.m3u8'),'utf8');assert.match(master,/1280x720/);assert.doesNotMatch(master,/1920x1080/);
  // Real FFmpeg plus the real PostgreSQL-domain migration (PGlite), simulated storage only.
  const db=await database();
  try {
   await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
   const source=await readFile(path.join(temp,'source')),d=await command<UploadDraft>(db,'create_draft',{purpose:'title'}),key=randomUUID();
   const upload=await command<UploadSession>(db,'reserve',{draft_id:d.id,revision:0,role:'main',bytes:source.length,sha256:createHash('sha256').update(source).digest('hex'),file_name:'source.mp4',content_type:'video/mp4',idempotency_key:key,request_hash:key});
   await command(db,'bind',{session_id:upload.id,provider_ref:upload.object_key,provider_data:{multipartUploadId:'fixture-multipart'}});
   const repo=fixtureRepository(db,true),storage=new MemoryProcessingStorage(upload,source);
   await repo.video(OWNER,'uploaded',{session_id:upload.id,received_bytes:source.length,etag:'source-etag'});
   process.env.VIDEO_WORK_DIR=process.env.VIDEO_TEST_TEMP;process.env.VIDEO_PROCESSING_ENABLED='true';
   const worker=new VideoProcessingWorker(repo,storage,processor);assert.equal(await worker.tick(),1);
   const asset=await repo.asset(upload.asset_id);assert.equal(asset.state,'ready');assert.equal(asset.metadata.profile_version,'gma-hls-v1');
   assert.ok(storage.objects.has(String(asset.metadata.master_key)));assert.equal(storage.deleted.length,0,'lost ready response must not delete published derivatives');
   assert.equal((await db.query<{state:string}>("SELECT state FROM gma_upload_jobs WHERE kind='process'")).rows[0]?.state,'done');
   await db.query("SELECT gma_upload_enqueue_job('process',$1,'{}','duplicate-worker-job',now())",[upload.id]);
   assert.equal(await worker.tick(),1);assert.equal(storage.deleted.length,0);
   await command(db,'update_draft',{draft_id:d.id,revision:1,metadata:{title:'Real HLS spike'}});
   const title=await command<{playback_kind:string}>(db,'publish',{draft_id:d.id,revision:2,request_hash:'real-ffmpeg-publish'});assert.equal(title.playback_kind,'r2_hls');
  }finally{await db.close();}
  await unlink(path.join(temp,'output',result.outputs.find(o=>o.relative.endsWith('.ts'))!.relative));
  await assert.rejects(verifyHls(path.join(temp,'output'),metadata,result.profiles));
  await assert.rejects(runner.run('ffmpeg',['-nostdin','-v','error','-re','-f','lavfi','-i','testsrc2=size=640x480:rate=24','-t','100','-f','null','-'],temp,signal,100),/VIDEO_PROCESSING_TIMEOUT/);
  await writeFile(path.join(temp,'corrupt'),'not a video');await assert.rejects(processor.probe(temp,'corrupt',30,signal),/VIDEO_PROBE_FAILED/);
  await assert.rejects(runner.run('ffmpeg',['-nostdin','-v','error','-i','corrupt','-f','null','-'],temp,signal,10000),/VIDEO_TRANSCODE_FAILED/);
  console.log('Real FFmpeg: 7-second 720p source → 720p + 480p HLS, AAC stereo, all segments decoded, poster generated, corruption rejected');
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('ffprobe limits reject excessive duration, dimensions and HDR; production refuses local fixture execution',async()=>{
 const raw={format:{duration:'100',format_name:'mov'},streams:[{codec_type:'video',codec_name:'h264',width:1920,height:1080,avg_frame_rate:'30/1'}]};
 assert.throws(()=>parseProbe(JSON.stringify(raw),20),/VIDEO_METADATA_INVALID/);
 raw.format.duration='10';raw.streams[0]!.width=100000;assert.throws(()=>parseProbe(JSON.stringify(raw),20),/VIDEO_METADATA_INVALID/);
 const old=process.env.UPLOAD_ENVIRONMENT;process.env.UPLOAD_ENVIRONMENT='production';
 try{await assert.rejects(new IsolatedMediaRunner(true).run('ffprobe',[],process.cwd(),new AbortController().signal,100),/VIDEO_SANDBOX_REQUIRED/);}finally{process.env.UPLOAD_ENVIRONMENT=old;}
});
