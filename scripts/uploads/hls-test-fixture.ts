import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {IsolatedMediaRunner,VideoProcessor} from '../../lib/uploads/video-processing';
async function main(){
 const root=process.env.VIDEO_BROWSER_FIXTURE;if(!root||!path.isAbsolute(root))throw new Error('VIDEO_BROWSER_FIXTURE_REQUIRED');
 await mkdir(root,{recursive:true});process.env.UPLOAD_ENVIRONMENT='local';process.env.VIDEO_SANDBOX='local-test';
 const runner=new IsolatedMediaRunner(true),signal=new AbortController().signal;
 await runner.run('ffmpeg',['-nostdin','-v','error','-y','-f','lavfi','-i','testsrc2=size=640x480:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','7','-threads','2','-c:v','libx264','-preset','ultrafast','-c:a','aac','-f','mp4','source'],root,signal,60000);
 const processor=new VideoProcessor(runner),metadata=await processor.probe(root,'source',30,signal);await processor.process(root,metadata,signal);
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
