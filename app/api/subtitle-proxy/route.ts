import { NextRequest,NextResponse } from 'next/server';
import { normalizeSubtitles } from '@/lib/uploads/auxiliary';
export async function GET(req:NextRequest) {
 const input=req.nextUrl.searchParams.get('url');if(!input)return NextResponse.json({error:'Missing url'},{status:400});
 const domain=process.env.R2_PUBLIC_DOMAIN??process.env.NEXT_PUBLIC_R2_DOMAIN??process.env.NEXT_PUBLIC_R2_PUBLIC_URL??'https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev';
 let url:URL,allowed:URL;
 try{url=new URL(input);allowed=new URL(domain.startsWith('http')?domain:'https://'+domain);}catch{return NextResponse.json({error:'Invalid url'},{status:400});}
 if(url.protocol!=='https:'||url.hostname!==allowed.hostname||url.port||url.username||url.password)return NextResponse.json({error:'Unauthorized domain'},{status:403});
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
