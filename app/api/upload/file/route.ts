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
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file      = formData.get("file") as File | null;
  const assetType = formData.get("assetType") as string | null;

  if (!file || !assetType) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const cap = UPLOAD_CAPS[assetType];
  if (!cap) return NextResponse.json({ error: "Tipo de asset no válido" }, { status: 400 });
  if (file.size > cap) {
    return NextResponse.json(
      { error: `El archivo supera el límite de ${fmtBytes(cap)} para este tipo` },
      { status: 413 }
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const key = `uploads/${userId}/${Date.now()}/${assetType}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: file.type || "application/octet-stream",
  }));

  return NextResponse.json({ publicUrl: `${R2_PUBLIC_URL}/${key}`, key });
}
