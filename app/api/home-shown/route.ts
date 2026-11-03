import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseShownBody, SHOWN_WINDOW_MS, shownFromRows } from "@/lib/recommendation/shown-memory";

const LIMIT_PER_MINUTE = 20;
const PROFILE_ID_MAX = 64;

// La tabla `home_shown` aún no está en los tipos generados (migración 20261118).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdminClient() as any;

function profileIdOf(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("profile") ?? "";
  return raw.length <= PROFILE_ID_MAX ? raw : null;
}

/** Lo enseñado en la portada a este perfil en las últimas 48 h. */
export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/home-shown`, LIMIT_PER_MINUTE)) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  const profileId = profileIdOf(request);
  if (profileId === null) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const since = new Date(Date.now() - SHOWN_WINDOW_MS).toISOString();
  const { data, error } = await db().from("home_shown").select("item_id, shown_at").eq("user_id", userId).eq("profile_id", profileId).gte("shown_at", since);
  if (error) {
    console.error("[api/home-shown GET]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, shown: shownFromRows((data ?? []) as { item_id: string; shown_at: string }[]) });
}

/** Anota los títulos que acaba de ver este perfil en la portada y borra lo anterior a 48 h. */
export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/home-shown`, LIMIT_PER_MINUTE)) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  const profileId = profileIdOf(request);
  const items = parseShownBody(await request.json().catch(() => null));
  if (profileId === null || !items) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await db().from("home_shown").upsert(
    items.map((itemId) => ({ user_id: userId, profile_id: profileId, item_id: itemId, shown_at: now })),
    { onConflict: "user_id,profile_id,item_id" },
  );
  if (error) {
    console.error("[api/home-shown POST]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  const cutoff = new Date(Date.now() - SHOWN_WINDOW_MS).toISOString();
  await db().from("home_shown").delete().eq("user_id", userId).eq("profile_id", profileId).lt("shown_at", cutoff);
  return NextResponse.json({ ok: true });
}
