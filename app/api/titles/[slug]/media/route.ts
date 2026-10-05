import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { optionalOwner,respond } from '@/lib/uploads/http';
import { UploadError } from '@/lib/uploads/repository';
import { requiredEnv } from '@/lib/uploads/config';
import { StreamProvider } from '@/lib/uploads/stream';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{slug:string}}){return respond(async()=>{
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const db=getSupabaseAdminClient() as any;
 const {data:title,error}=await db.from('peliculas').select('id,status,creator_user_id').eq('slug',params.slug).maybeSingle();
 if(error)throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE',503);
 if(!title || (title.status && title.status!=='published' && title.creator_user_id!==await optionalOwner(req)))throw new UploadError('UPLOAD_NOT_FOUND',404);
 const {data:media,error:mediaError}=await db.from('gma_title_media').select('role,slot,language,position,gma_media_assets(*)').eq('title_id',title.id).order('position');
 if(mediaError)throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE',503);
 return {media:media.map((m:Record<string,unknown>)=>{
   const a=m.gma_media_assets as Record<string,unknown>;let url=a.delivery_path,expiresAt=null;
   if(a.provider==='stream') {const provider=new StreamProvider({accountId:requiredEnv('CLOUDFLARE_ACCOUNT_ID'),streamToken:requiredEnv('CLOUDFLARE_STREAM_API_TOKEN'),streamCustomer:requiredEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE')});const playback=provider.playback(String(a.provider_ref),Number(a.duration_seconds));url=playback.url;expiresAt=playback.expiresAt;}
   return {role:m.role,slot:m.slot,language:m.language,position:m.position,url,expiresAt};
 })};
});}
