import {PlaybackService} from '@/lib/media/playback-service';
import {optionalOwner,respond} from '@/lib/uploads/http';
export const dynamic='force-dynamic';
/** Fuente de reproducción del tráiler de un título publicado; la piden el hero de portada y la tarjeta flotante. */
export async function GET(req:Request,{params}:{params:{slug:string}}){
 return respond(async()=>new PlaybackService().resolveTitleTrailer(params.slug,await optionalOwner(req)));
}
