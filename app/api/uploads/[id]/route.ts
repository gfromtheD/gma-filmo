import { owner,engineGate,respond } from '@/lib/uploads/http';
import { uuid } from '@/lib/uploads/contracts';
import { UploadRepository } from '@/lib/uploads/repository';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string}}){return respond(async()=>{engineGate();const repo=new UploadRepository();const session=await repo.session(uuid.parse(params.id),await owner(req));return {session,asset:await repo.assetSummary(session.asset_id)};});}
