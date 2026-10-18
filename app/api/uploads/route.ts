import { owner,engineGate,jsonBody,respond } from '@/lib/uploads/http';
import { MediaService } from '@/lib/media/service';
import { NextResponse } from 'next/server';
export async function POST(req:Request){return respond(async()=>{
  engineGate(true); const reserved=await new MediaService().reserve(await owner(req),await jsonBody(req));
  return NextResponse.json(reserved.result,{status:reserved.created?201:200,headers:{'Cache-Control':'private, no-store'}});
});}
