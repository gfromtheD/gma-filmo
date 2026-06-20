import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getUserId } from "@/lib/api/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { slug } = params;
  const supabase = getSupabaseAdminClient();

  // Verify ownership before deleting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: findErr } = await (supabase as any)
    .from("peliculas")
    .select("id, creator_user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (findErr || !row) {
    return NextResponse.json({ error: "Título no encontrado" }, { status: 404 });
  }
  if ((row as { creator_user_id: string | null }).creator_user_id !== userId) {
    return NextResponse.json({ error: "No tienes permiso para eliminar este título" }, { status: 403 });
  }

  const { error: delErr } = await supabase.from("peliculas").delete().eq("slug", slug);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  revalidateTag("peliculas");

  return NextResponse.json({ ok: true });
}
