import {owner,engineGate,respond} from '@/lib/uploads/http';
import {uuid} from '@/lib/uploads/contracts';
import {MediaService} from '@/lib/media/service';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string}}){return respond(async()=>{engineGate();return new MediaService().envelope(await owner(req),uuid.parse(params.id));});}
