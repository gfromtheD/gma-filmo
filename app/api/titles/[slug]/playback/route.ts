import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { optionalOwner,respond } from '@/lib/uploads/http';
import { UploadError } from '@/lib/uploads/repository';
import { requiredEnv } from '@/lib/uploads/config';
import { StreamProvider } from '@/lib/uploads/stream';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{slug:string}}){return respond(async()=>{
 const {data,error}=await getSupabaseAdminClient().from('peliculas').select('*').eq('slug',params.slug).maybeSingle();
 if(error)throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE',503);
 if(!data || (data.status && data.status!=='published' && data.creator_user_id!==await optionalOwner(req)))throw new UploadError('UPLOAD_NOT_FOUND',404);
 const row=data as typeof data & {stream_uid?:string;playback_kind?:string};
 if(row.playback_kind!=='stream')return {kind:'mp4',url:row.r2_video_url,expiresAt:null};
 if(!row.stream_uid)throw new UploadError('UPLOAD_INVALID_ASSET',503);
 const provider=new StreamProvider({accountId:requiredEnv('CLOUDFLARE_ACCOUNT_ID'),streamToken:requiredEnv('CLOUDFLARE_STREAM_API_TOKEN'),streamCustomer:requiredEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE')});
 return {kind:'hls',...provider.playback(row.stream_uid,14400)};
});}
