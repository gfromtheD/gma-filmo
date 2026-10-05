import {NextResponse} from 'next/server';
import {UploadRepository,UploadError} from '@/lib/uploads/repository';
import {optionalOwner} from '@/lib/uploads/http';
import {uuid} from '@/lib/uploads/contracts';
import {R2VideoProvider} from '@/lib/uploads/r2-video';
import {requiredEnv} from '@/lib/uploads/config';
import {safeMediaPath} from '@/lib/uploads/video-processing';
import {hlsObject,rewritePlaylist} from '@/lib/uploads/hls-delivery';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string;path:string[]}}) {
 try {
  const repo=new UploadRepository(),id=uuid.parse(params.id),relative=safeMediaPath(params.path.join('/'));
  const output=relative.endsWith('.m3u8')?null:await repo.videoOutput(id,relative);
  const asset=output?.asset??await repo.asset(id);
  if(asset.provider!=='r2'||asset.state!=='ready'||!(await repo.mayReadAsset(asset,await optionalOwner(req))))throw new UploadError('UPLOAD_NOT_FOUND',404);
  const key=output?.key??hlsObject(asset,relative),storage=new R2VideoProvider(requiredEnv('UPLOAD_R2_PRIVATE_BUCKET'));
  if(!relative.endsWith('.m3u8'))return NextResponse.redirect(await storage.signRead(key,Math.min(86400,Math.max(7200,Math.ceil(asset.duration_seconds??0)+3600))),{status:307,headers:{'Cache-Control':'private, no-store'}});
  const object=await storage.read(key);if(!object.Body)throw new UploadError('UPLOAD_INVALID_ASSET',503);
  let length=0;const chunks:Uint8Array[]=[];
  for await(const chunk of object.Body as AsyncIterable<Uint8Array>){length+=chunk.length;if(length>1024**2)throw new UploadError('UPLOAD_INVALID_ASSET',503);chunks.push(chunk);}
  const content=rewritePlaylist(asset,relative,Buffer.concat(chunks).toString('utf8'));
  return new NextResponse(content,{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'private, no-store'}});
 }catch(e){const error=e instanceof UploadError?e:new UploadError('UPLOAD_UNAVAILABLE',503);return NextResponse.json({error:error.code},{status:error.status,headers:{'Cache-Control':'no-store'}});}
}
