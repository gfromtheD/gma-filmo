import { timingSafeEqual } from 'node:crypto';
import { respond } from '@/lib/uploads/http';
import { UploadError } from '@/lib/uploads/repository';
import { UploadService } from '@/lib/uploads/service';
import { requiredEnv } from '@/lib/uploads/config';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request){return respond(async()=>{
 const expected=Buffer.from('Bearer '+requiredEnv('UPLOAD_EXECUTOR_SECRET')),actual=Buffer.from(req.headers.get('authorization')??'');
 if(actual.length!==expected.length || !timingSafeEqual(actual,expected))throw new UploadError('UPLOAD_UNAUTHORIZED',401);
 // Runs during rollback too: pending cleanup is not controlled by the admission flag.
 return {processed:await new UploadService().tick(1)};
});}
