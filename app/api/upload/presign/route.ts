import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET, R2_PUBLIC_URL, UPLOAD_CAPS, SESSION_CAP, FREE_QUOTA } from "@/lib/r2/client";
import { getUserId } from "@/lib/api/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function fmtBytes(b: number) {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(0) + " GB";
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(0) + " MB";
  return (b / 1024).toFixed(0) + " KB";
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { assetType, fileName, fileSize, contentType, sessionUsed = 0 } = await req.json();

  if (!UPLOAD_CAPS[assetType]) {
    return NextResponse.json({ error: "Tipo de asset no válido" }, { status: 400 });
  }
  if (!fileName || !fileSize || fileSize <= 0) {
    return NextResponse.json({ error: "Datos del archivo incompletos" }, { status: 400 });
  }

  // Per-file cap
  const cap = UPLOAD_CAPS[assetType]!;
  if (fileSize > cap) {
    return NextResponse.json(
      { error: `El archivo supera el límite de ${fmtBytes(cap)} para este tipo de asset` },
      { status: 413 }
    );
  }

  // Session cap
  if (sessionUsed + fileSize > SESSION_CAP) {
    return NextResponse.json(
      { error: "Has alcanzado el límite de 6 GB por sesión de subida" },
      { status: 413 }
    );
  }

  // Quota check: sum of file sizes for this user
  const supabase = getSupabaseAdminClient();
  // creator_user_id and file_size_bytes added in migration 20260619
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("peliculas")
    .select("file_size_bytes")
    .eq("creator_user_id", userId);

  const usedBytes = (existing ?? []).reduce((sum: number, r: { file_size_bytes?: number }) => sum + (r.file_size_bytes ?? 0), 0);
  if (usedBytes + fileSize > FREE_QUOTA) {
    return NextResponse.json(
      { error: "Has alcanzado tu límite de almacenamiento gratuito de 10 GB" },
      { status: 413 }
    );
  }

  // Generate R2 object key
  const ext = fileName.split(".").pop() ?? "bin";
  const key = `uploads/${userId}/${Date.now()}/${assetType}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
    ContentLength: fileSize,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
  const publicUrl    = `${R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({ presignedUrl, key, publicUrl });
}
