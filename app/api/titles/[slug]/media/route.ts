import {PlaybackService} from '@/lib/media/playback-service';
import {optionalOwner,respond} from '@/lib/uploads/http';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{slug:string}}){return respond(async()=>new PlaybackService().resolveAuxiliaries(params.slug,await optionalOwner(req)));}
