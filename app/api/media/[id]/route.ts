import { optionalOwner,respond } from '@/lib/uploads/http';
import { uuid } from '@/lib/uploads/contracts';
import { UploadRepository,UploadError } from '@/lib/uploads/repository';
import { AuxiliaryProvider } from '@/lib/uploads/auxiliary';
import { requiredEnv } from '@/lib/uploads/config';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string}}) {
 try {
 const repo=new UploadRepository(),asset=await repo.asset(uuid.parse(params.id));
 if(asset.provider!=='r2'||asset.state!=='ready'||!(await repo.mayReadAsset(asset,await optionalOwner(req))))throw new UploadError('UPLOAD_NOT_FOUND',404);
 const key=asset.metadata.storage_key,mime=asset.metadata.mime;
 if(key!==`ready/${asset.owner_id}/${asset.id}` || !['image/webp','text/vtt'].includes(String(mime)))throw new UploadError('UPLOAD_INVALID_ASSET',503);
 const object=await new AuxiliaryProvider(requiredEnv('UPLOAD_R2_PRIVATE_BUCKET')).read(String(key));
 if(!object.Body || !object.ContentLength || object.ContentLength>4*1024**2)throw new UploadError('UPLOAD_INVALID_ASSET',503);
 return new Response((await object.Body.transformToByteArray()).buffer as ArrayBuffer,{headers:{'Content-Type':String(mime),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return respond(async()=>{throw e;});}
}
