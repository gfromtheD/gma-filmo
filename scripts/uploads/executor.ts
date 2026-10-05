// Run on a continuously available server, with server secrets and the isolated environment.
// This is a worker implementation, not an automatically installed system task.
import {UploadService} from '../../lib/uploads/service';
const once=process.argv.includes('--once');
async function main(){const service=new UploadService();do {
 try{console.log(JSON.stringify({time:new Date().toISOString(),processed:await service.tick(1)}));}
 catch{console.error('UPLOAD_EXECUTOR_UNAVAILABLE');if(once)process.exitCode=1;}
 if(!once)await new Promise(resolve=>setTimeout(resolve,15000));
}while(!once);}
void main();
