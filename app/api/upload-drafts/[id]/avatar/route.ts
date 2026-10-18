import { owner,engineGate,respond } from '@/lib/uploads/http';
import { uuid } from '@/lib/uploads/contracts';
import { UploadRepository } from '@/lib/uploads/repository';
export async function POST(req:Request,{params}:{params:{id:string}}){return respond(async()=>{engineGate();return {asset:await new UploadRepository().command(await owner(req),'avatar',{draft_id:uuid.parse(params.id)})};});}
