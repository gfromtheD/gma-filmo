import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { audienceSchema } from "@/lib/studio/audience";

export const dynamic = "force-dynamic";

/** Audiencia real del creador autenticado (espectadores, notas y comentarios de SUS obras; nunca de otro creador). */
export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await getSupabaseAdminClient().rpc("gma_creator_audience", { p_owner: userId });
  if (error) {
    console.error("[studio] audience failed", { code: error.code });
    return NextResponse.json({ error: "No se pudo calcular la audiencia" }, { status: 500 });
  }
  const parsed = audienceSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[studio] audience shape invalid");
    return NextResponse.json({ error: "No se pudo calcular la audiencia" }, { status: 500 });
  }
  return NextResponse.json(parsed.data, { headers: { "Cache-Control": "private, no-store" } });
}
