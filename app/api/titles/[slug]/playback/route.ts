import {PlaybackService} from '@/lib/media/playback-service';
import {optionalOwner,respond} from '@/lib/uploads/http';
import {uploadEngineEnabled} from '@/lib/uploads/config';
export const dynamic='force-dynamic';
// Con el motor apagado no se consultan tablas gma_* (pueden no existir en la base): solo reproducción histórica.
export async function GET(req:Request,{params}:{params:{slug:string}}){return respond(async()=>{const service=new PlaybackService();const owner=await optionalOwner(req);
 return uploadEngineEnabled()?service.resolveTitle(params.slug,owner):service.resolveLegacyOnly(params.slug,owner);});}
