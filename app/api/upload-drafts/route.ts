import { z } from 'zod';
import { owner,engineGate,jsonBody,respond } from '@/lib/uploads/http';
import { MediaService } from '@/lib/media/service';
export const dynamic='force-dynamic';
export async function GET(req:Request){return respond(async()=>{engineGate();return new MediaService().drafts(await owner(req));});}
export async function POST(req:Request){return respond(async()=>{engineGate(true);const id=await owner(req);
 const input=z.object({purpose:z.enum(['title','avatar','banner']),title_slug:z.string().min(1).max(100).optional()}).strict().parse(await jsonBody(req));
 return new MediaService().draftMutation(id,'create_draft',input);},201);}
