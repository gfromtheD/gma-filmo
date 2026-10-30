import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, jsonError, listsDb } from "@/lib/lists/server";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Lo que se guarda de cómo ve el usuario sus carpetas de Mi lista (ver la migración 20261111_user_shelf_prefs). */
const PrefsSchema = z.object({
  sort: z.enum(["manual", "nombre", "color", "tamano"]),
  size: z.enum(["s", "m", "l"]),
  layout: z.enum(["fila", "cuadricula"]),
  colors: z.record(z.string().max(64), z.string().regex(HEX)).refine((c) => Object.keys(c).length <= 200),
  order: z.array(z.string().max(64)).max(200),
});

const PutSchema = z.object({ profileId: z.string().max(64).default(""), prefs: PrefsSchema });

/** Preferencias del perfil, o `null` si aún no ha guardado ninguna (o la tabla todavía no existe). */
export async function GET(request: Request) {
  const auth = await authorize(request, "read");
  if ("response" in auth) return auth.response;
  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";

  const { data, error } = await listsDb()
    .from("user_shelf_prefs")
    .select("prefs")
    .eq("user_id", auth.userId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) {
    console.error("[api/shelf-prefs GET]", error.code, error.message);
    return NextResponse.json({ prefs: null, available: false });
  }
  const parsed = PrefsSchema.safeParse(data?.prefs);
  return NextResponse.json({ prefs: parsed.success ? parsed.data : null, available: true });
}

/** Guarda (o reemplaza) las preferencias del perfil. */
export async function PUT(request: Request) {
  const auth = await authorize(request, "write");
  if ("response" in auth) return auth.response;
  const parsed = PutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid input");

  const { error } = await listsDb()
    .from("user_shelf_prefs")
    .upsert(
      { user_id: auth.userId, profile_id: parsed.data.profileId, prefs: parsed.data.prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id,profile_id" },
    );
  if (error) {
    console.error("[api/shelf-prefs PUT]", error.code, error.message);
    return jsonError(500, "No se pudieron guardar las preferencias.");
  }
  return NextResponse.json({ ok: true });
}
