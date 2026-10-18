import {PlaybackService} from '@/lib/media/playback-service';
import {optionalOwner,respond} from '@/lib/uploads/http';

export const dynamic='force-dynamic';

export async function GET(request:Request,{params}:{params:{slug:string}}) {
  return respond(async()=>{
    const location=await new PlaybackService().resolveLegacyFallback(params.slug,await optionalOwner(request));
    return new Response(null,{status:307,headers:{Location:location,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  });
}
