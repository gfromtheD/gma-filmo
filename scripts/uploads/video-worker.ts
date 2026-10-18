import {VideoProcessingWorker} from '../../lib/uploads/processing-worker';
// Separate process, never imported by a Next route. One job at a time for the MVP.
async function main(){
 if(process.env.VIDEO_SANDBOX!=='bubblewrap')throw new Error('VIDEO_SANDBOX_REQUIRED: use a Linux worker with bubblewrap for user uploads');
 const worker=new VideoProcessingWorker();
 do{const count=await worker.tick();if(process.argv.includes('--once'))break;if(!count)await new Promise(r=>setTimeout(r,15000));}while(true);
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'VIDEO_WORKER_FAILED');process.exitCode=1;});
