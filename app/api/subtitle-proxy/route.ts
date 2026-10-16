import { NextRequest,NextResponse } from 'next/server';
import { normalizeSubtitles } from '@/lib/uploads/auxiliary';
import { legacyMediaUrl } from '@/lib/media/legacy-playback';
export async function GET(req:NextRequest) {
 const input=req.nextUrl.searchParams.get('url');if(!input)return NextResponse.json({error:'Missing url'},{status:400});
 const url=legacyMediaUrl(input);
 if(!url)return NextResponse.json({error:'Unauthorized domain'},{status:403});
 try {
   const upstream=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});
   if(!upstream.ok||!upstream.body)throw new Error('Upstream failed');
   const reader=upstream.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
   try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;
     if(bytes>4*1024**2)throw new Error('Too large');chunks.push(value);}}
   finally{await reader.cancel();}
   const vtt=normalizeSubtitles(Buffer.concat(chunks));
   return new NextResponse(vtt.toString('utf8'),{headers:{'Content-Type':'text/vtt; charset=utf-8','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return NextResponse.json({error:'Subtitle unavailable'},{status:502});}
}
