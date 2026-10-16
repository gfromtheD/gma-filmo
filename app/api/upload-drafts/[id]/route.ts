import { z } from 'zod';
import { owner,engineGate,jsonBody,respond } from '@/lib/uploads/http';
import { uuid,metadataSchema,revisionSchema } from '@/lib/uploads/contracts';
import { MediaService } from '@/lib/media/service';
export const dynamic='force-dynamic';
type Context={params:{id:string}};
export async function GET(req:Request,{params}:Context){return respond(async()=>{engineGate();return new MediaService().draftDetail(await owner(req),uuid.parse(params.id));});}
export async function PATCH(req:Request,{params}:Context){return respond(async()=>{engineGate();const input=z.object({revision:revisionSchema,metadata:metadataSchema}).strict().parse(await jsonBody(req));
 return new MediaService().draftMutation(await owner(req),'update_draft',{...input,draft_id:uuid.parse(params.id)});});}
export async function DELETE(req:Request,{params}:Context){return respond(async()=>{engineGate();return new MediaService().draftMutation(await owner(req),'abandon',{draft_id:uuid.parse(params.id)});});}
