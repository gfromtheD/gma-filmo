import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { decodeDataImage } from "@/lib/profiles/avatar";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Siempre dinámico: lee de la base de datos según los parámetros.
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_ID_MAX_LENGTH = 64;

/**
 * Sirve la imagen subida como avatar de un perfil (`?u=<cuenta>&p=<perfil secundario o vacío>`).
 * Las listas (comentarios, valoraciones) apuntan aquí en vez de llevar la imagen incrustada; la dirección
 * incluye una huella del contenido (`v`), así que se puede cachear de forma permanente.
 * Solo devuelve imágenes de tipos permitidos (nunca SVG) y con cabeceras que impiden ejecutarlas.
 */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/avatar`, 600)) return new NextResponse(null, { status: 429 });

  const params = new URL(request.url).searchParams;
  const userId = params.get("u") ?? "";
  const profileId = params.get("p") ?? "";
  if (!UUID.test(userId) || profileId.length > PROFILE_ID_MAX_LENGTH) return new NextResponse(null, { status: 400 });

  const admin = getSupabaseAdminClient();
  let avatarId: string | null = null;
  if (profileId === "") {
    const { data } = await admin.from("profiles").select("avatar_id").eq("id", userId).maybeSingle();
    avatarId = data?.avatar_id ?? null;
  } else {
    const { data } = await admin.from("sub_profiles").select("avatar_id").eq("id", profileId).eq("user_id", userId).maybeSingle();
    avatarId = data?.avatar_id ?? null;
  }

  const image = decodeDataImage(avatarId);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
