import {PlaybackService} from '@/lib/media/playback-service';
import {owner,respond} from '@/lib/uploads/http';
import {uuid} from '@/lib/uploads/contracts';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string}}){return respond(async()=>new PlaybackService().resolvePreview(uuid.parse(params.id),await owner(req)));}
