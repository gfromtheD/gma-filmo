import {PlaybackService} from '@/lib/media/playback-service';
import {optionalOwner,respond} from '@/lib/uploads/http';
import {uuid} from '@/lib/uploads/contracts';
export const dynamic='force-dynamic';
/** Fuente de reproducción de un vídeo auxiliar (tráiler o extra) de un título publicado; la pide el visor de extras de la ficha. */
export async function GET(req:Request,{params}:{params:{slug:string;assetId:string}}){
 return respond(async()=>new PlaybackService().resolveTitleVideo(params.slug,uuid.parse(params.assetId),await optionalOwner(req)));
}
