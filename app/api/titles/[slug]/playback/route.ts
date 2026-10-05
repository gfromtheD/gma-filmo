import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { optionalOwner,respond } from '@/lib/uploads/http';
import { UploadRepository, UploadError } from '@/lib/uploads/repository';
import { requiredEnv } from '@/lib/uploads/config';
import { StreamProvider } from '@/lib/uploads/stream';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{slug:string}}){return respond(async()=>{
 const {data,error}=await getSupabaseAdminClient().from('peliculas').select('*').eq('slug',params.slug).maybeSingle();
 if(error)throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE',503);
 if(!data || (data.status && data.status!=='published' && data.creator_user_id!==await optionalOwner(req)))throw new UploadError('UPLOAD_NOT_FOUND',404);
 const row=data as typeof data & {stream_uid?:string;playback_kind?:string};
 if(row.playback_kind==='r2_hls'){
 const repo=new UploadRepository();
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const db=getSupabaseAdminClient() as any;
 const {data:media,error:mediaError}=await db.from('gma_title_media').select('asset_id').eq('title_id',data.id).eq('role','main').maybeSingle();
 if(mediaError||!media)throw new UploadError('UPLOAD_INVALID_ASSET',503);
 const asset=await repo.assetSummary(String((media as unknown as {asset_id:string}).asset_id));
 if(asset.state!=='ready'||!asset.delivery_path||!(await repo.mayReadAsset(asset,await optionalOwner(req))))throw new UploadError('UPLOAD_INVALID_ASSET',503);
 return {kind:'hls',url:asset.delivery_path,expiresAt:Date.now()+Math.max(7200000,(Number(asset.duration_seconds)+3600)*1000)};
 }
 if(row.playback_kind!=='stream')return {kind:'mp4',url:row.r2_video_url,expiresAt:null};
 if(!row.stream_uid)throw new UploadError('UPLOAD_INVALID_ASSET',503);
 const provider=new StreamProvider({accountId:requiredEnv('CLOUDFLARE_ACCOUNT_ID'),streamToken:requiredEnv('CLOUDFLARE_STREAM_API_TOKEN'),streamCustomer:requiredEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE')});
 return {kind:'hls',...provider.playback(row.stream_uid,14400)};
});}
