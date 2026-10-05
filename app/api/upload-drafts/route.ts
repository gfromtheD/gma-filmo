import { z } from 'zod';
import { owner,engineGate,jsonBody,respond } from '@/lib/uploads/http';
import { UploadRepository } from '@/lib/uploads/repository';
export const dynamic='force-dynamic';
export async function GET(req:Request){return respond(async()=>{engineGate();return {drafts:await new UploadRepository().drafts(await owner(req))};});}
export async function POST(req:Request){return respond(async()=>{engineGate(true);const id=await owner(req);
 const input=z.object({purpose:z.enum(['title','avatar']),title_slug:z.string().min(1).max(100).optional()}).strict().parse(await jsonBody(req));
 return {draft:await new UploadRepository().command(id,'create_draft',input)};},201);}
