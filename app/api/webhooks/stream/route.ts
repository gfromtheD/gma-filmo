import { createHash } from 'node:crypto';
import { z } from 'zod';
import { respond } from '@/lib/uploads/http';
import { requiredEnv } from '@/lib/uploads/config';
import { verifyStreamSignature } from '@/lib/uploads/stream';
import { UploadRepository,UploadError } from '@/lib/uploads/repository';
export async function POST(req:Request){return respond(async()=>{
 const raw=new Uint8Array(await req.arrayBuffer());if(raw.byteLength>65536)throw new UploadError('UPLOAD_INVALID_INPUT',400);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 if(!verifyStreamSignature(raw,req.headers.get('Webhook-Signature'),requiredEnv('CLOUDFLARE_STREAM_WEBHOOK_SECRET')))throw new UploadError('UPLOAD_UNAUTHORIZED',401);
 const {uid}=z.object({uid:z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/)}).parse(JSON.parse(text));
 return {accepted:await new UploadRepository().event(createHash('sha256').update(raw).digest('hex'),uid)};
},202);}
