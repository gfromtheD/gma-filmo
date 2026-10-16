import {z} from 'zod';
import {owner,engineGate,jsonBody,respond} from '@/lib/uploads/http';
import {uuid,revisionSchema} from '@/lib/uploads/contracts';
import {UploadError} from '@/lib/uploads/repository';
import {MediaService} from '@/lib/media/service';
import {transportGenerationSchema,transportRevisionSchema,transportResumeSchema,transportRetrySchema,transportPartSchema} from '@/lib/media/contracts';
export async function POST(req:Request,{params}:{params:{id:string;action:string}}){return respond(async()=>{
 engineGate();const id=uuid.parse(params.id),user=await owner(req),service=new MediaService();
 if(params.action==='parts')return service.parts(user,id);
 const body=await jsonBody(req);
 if(params.action==='part'){const input=transportPartSchema.parse(body);return service.part(user,id,input.number,input.generation);}
 if(params.action==='transfer')return service.transfer(user,id,transportGenerationSchema.parse(body).generation);
 if(params.action==='complete'){const result=await service.complete(user,id,transportGenerationSchema.parse(body).generation);return Response.json(result,{status:result.asset.status==='ready'?200:202,headers:{'Cache-Control':'private, no-store'}});}
 if(params.action==='cancel'){const result=await service.cancel(user,id,transportRevisionSchema.parse(body).revision);return Response.json(result,{status:result.asset.status==='deleted'?200:202,headers:{'Cache-Control':'private, no-store'}});}
 if(params.action==='pause')return service.pause(user,id,transportRevisionSchema.parse(body).revision);
 if(params.action==='resume'){const input=transportResumeSchema.parse(body);return service.resume(user,id,input.sha256,input.bytes,input.revision);}
 if(params.action==='retry')return service.retry(user,id,transportRetrySchema.parse(body));
 if(params.action==='language'){const input=z.object({revision:revisionSchema,language:z.string().regex(/^[a-zA-Z0-9-]{2,35}$/)}).strict().parse(body);return service.label(user,id,input.revision,input.language);}
 if(params.action==='reorder'){const input=z.object({draft_id:uuid,revision:revisionSchema,position:z.number().int().min(0).max(1000)}).strict().parse(body);return service.reorder(user,id,input);}
 throw new UploadError('UPLOAD_NOT_FOUND',404);
});}
