import { UploadRepository } from '../../lib/uploads/repository';
import { MediaService } from '../../lib/media/service';
async function main() {
  const service=new MediaService();
  do {const count=await service.tick(5,true);await service.finalizeAccounts(owner=>new UploadRepository().deleteAuthAccount(owner));if(process.argv.includes('--once'))break;if(!count)await new Promise<void>((resolve)=>setTimeout(resolve,5000));}while(true);
}
void main().catch(()=>{console.error('MEDIA_EXECUTOR_FAILED');process.exitCode=1;});
