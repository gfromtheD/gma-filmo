import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api/auth";
import { CREATOR_PROFILES_TAG } from "@/lib/studio-creator-banner";

/**
 * Tras cambiar el banner en Mi Estudio, refresca la caché de las páginas públicas de creador para que se vea al
 * momento. Solo para usuarios con sesión; no recibe datos ni escribe nada.
 */
export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  revalidateTag(CREATOR_PROFILES_TAG);
  return NextResponse.json({ ok: true });
}
