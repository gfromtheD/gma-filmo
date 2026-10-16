import {PlaybackService} from '@/lib/media/playback-service';
import {optionalOwner,respond} from '@/lib/uploads/http';
import {uuid} from '@/lib/uploads/contracts';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string;path:string[]}}){return respond(async()=>new PlaybackService().deliverHls(uuid.parse(params.id),params.path.join('/'),await optionalOwner(req)));}
