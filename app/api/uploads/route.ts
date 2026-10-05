import { owner,engineGate,jsonBody,respond } from '@/lib/uploads/http';
import { UploadService } from '@/lib/uploads/service';
export async function POST(req:Request){return respond(async()=>{engineGate(true);return {session:await new UploadService().reserve(await owner(req),await jsonBody(req))};},201);}
