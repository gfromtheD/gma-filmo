import { legacyMediaWritesGate } from '@/lib/media/legacy-writes';
import { uploadEngineEnabled } from '@/lib/uploads/config';
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET, R2_PUBLIC_URL, UPLOAD_CAPS } from "@/lib/r2/client";
import { getUserId } from "@/lib/api/auth";

function fmtBytes(b: number) {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(0) + " GB";
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(0) + " MB";
  return (b / 1024).toFixed(0) + " KB";
}

export async function POST(req: NextRequest) {
  try {legacyMediaWritesGate();}catch{return NextResponse.json({error:'LEGACY_UPLOAD_DISABLED'},{status:410});}
  if(process.env.UPLOADS_PAUSED==='true')return NextResponse.json({error:'UPLOAD_ADMISSION_PAUSED'},{status:503});
  if(uploadEngineEnabled())return NextResponse.json({error:'UPLOAD_USE_PERSISTENT_SESSION'},{status:410});
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if(Number(req.headers.get('Content-Length'))>4*1024**2)return NextResponse.json({error:'Usa una imagen inferior a 4 MB'},{status:413});
  const formData = await req.formData();
  const file      = formData.get("file") as File | null;
  const assetType = formData.get("assetType") as string | null;

  if (!file || !assetType) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  if(assetType!=='avatar')return NextResponse.json({error:'Usa la transferencia directa'},{status:410});
  const cap = Math.min(UPLOAD_CAPS.avatar??0,4*1024**2);
  if (!cap) return NextResponse.json({ error: "Tipo de asset no válido" }, { status: 400 });
  if (file.size > cap) {
    return NextResponse.json(
      { error: `El archivo supera el límite de ${fmtBytes(cap)} para este tipo` },
      { status: 413 }
    );
  }

  const ext = "webp";
  const key = `uploads/${userId}/${Date.now()}/${assetType}.${ext}`;

  let buffer:Buffer;
  try {
    const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25000000,animated:false});
    const metadata=await image.metadata();if(!['jpeg','png','webp','avif'].includes(metadata.format??''))throw new Error('invalid');
    buffer=await image.rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  }catch{return NextResponse.json({error:'Imagen no válida'},{status:400});}

  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: "image/webp",
  }));

  return NextResponse.json({ publicUrl: `${R2_PUBLIC_URL}/${key}`, key });
}
