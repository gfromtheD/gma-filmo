import { z } from 'zod';
import { owner,engineGate,jsonBody,respond } from '@/lib/uploads/http';
import { uuid } from '@/lib/uploads/contracts';
import { UploadError } from '@/lib/uploads/repository';
import { UploadService } from '@/lib/uploads/service';
export async function POST(req:Request,{params}:{params:{id:string;action:string}}){return respond(async()=>{
 engineGate(params.action==='resume');const id=uuid.parse(params.id),user=await owner(req),service=new UploadService();
 if(params.action==='complete')return {asset:await service.complete(user,id)};
 if(params.action==='cancel')return {session:await service.repo.command(user,'cancel',{session_id:id})};
 if(params.action==='pause')return {session:await service.repo.command(user,'pause',{session_id:id,paused:true})};
 if(params.action==='resume') {const input=z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive()}).strict().parse(await jsonBody(req));
   return {session:await service.resume(user,id,input.sha256,input.bytes)};}
 if(params.action==='language'){
 const input=z.object({revision:z.number().int().nonnegative(),language:z.string().regex(/^[a-zA-Z0-9-]{2,35}$/)}).strict().parse(await jsonBody(req));
 return {draft:await service.repo.command(user,'label_subtitle',{...input,session_id:id})};
 }
 if(params.action==='reorder'){const input=z.object({draft_id:uuid,revision:z.number().int().nonnegative(),position:z.number().int().min(0).max(1000)}).strict().parse(await jsonBody(req));
 const session=await service.repo.session(id,user);if(session.draft_id!==input.draft_id)throw new UploadError('UPLOAD_NOT_FOUND',404);
 return {draft:await service.repo.command(user,'reorder',{...input,asset_id:session.asset_id})};}
 throw new UploadError('UPLOAD_NOT_FOUND',404);
});}
