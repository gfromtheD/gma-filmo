import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getUserId } from '@/lib/api/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { MediaError, mediaErrorResponse } from '@/lib/media/errors';
import { uploadEngineEnabled } from './config';
import { UploadError } from './repository';
import { describeFailure } from './failure';
export { describeFailure };
export async function owner(request:Request):Promise<string> {
 const id=await getUserId(request);if(!id)throw new UploadError('UPLOAD_UNAUTHORIZED',401);return id;
}
export async function optionalOwner(request:Request) {
 if(request.headers.has('Authorization'))return getUserId(request);
 try {return (await getSupabaseServerClient().auth.getUser()).data.user?.id??null;}catch{return null;}
}
export function engineGate(admission=false) {if(admission && process.env.UPLOADS_PAUSED==='true')throw new UploadError('UPLOAD_ADMISSION_PAUSED',503);if(!uploadEngineEnabled())throw new UploadError('UPLOAD_ENGINE_DISABLED',404);}
export async function jsonBody(request:Request) {
 const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>24000)throw new UploadError('UPLOAD_INVALID_INPUT',400);
 try{return JSON.parse(raw) as unknown;}catch{throw new UploadError('UPLOAD_INVALID_INPUT',400);}
}
export async function respond(action:()=>Promise<unknown>,status=200) {
 try {const result=await action();if(result instanceof Response)return result;return NextResponse.json(result,{status,headers:{'Cache-Control':'private, no-store'}});}
  catch(e) {
   if(e instanceof MediaError && e.status>=500)console.error('[uploads] media error',describeFailure(e));
   if(e instanceof MediaError) return NextResponse.json(mediaErrorResponse(e),{status:e.status,headers:{'Cache-Control':'no-store'}});
   if(!(e instanceof UploadError)&&!(e instanceof ZodError))console.error('[uploads] unexpected failure',describeFailure(e));
   const error=e instanceof UploadError?e:e instanceof ZodError?new UploadError('UPLOAD_INVALID_INPUT',400):new UploadError('UPLOAD_UNAVAILABLE',503);
   return NextResponse.json({error:{code:error.code,message:error.code,retryable:error.status>=500 || error.code==='UPLOAD_NOT_COMPLETE'},requestId:randomUUID()},{status:error.status,headers:{'Cache-Control':'no-store'}});
 }
}
