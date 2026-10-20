import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api/auth";
import { rateLimitCheck } from "@/lib/api/rate-limit";
import { notificationsDb } from "@/lib/notifications/server";

const LIMIT_PER_MINUTE = 60;
const PAGE_SIZE = 12;

type Row = { id: string; kind: "rating"; pelicula_id: number; score: number | null; created_at: string; read_at: string | null };

async function authorize(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return { response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  const limit = rateLimitCheck(`${userId}/notifications`, LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return { response: NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }) };
  }
  return { userId };
}

/** Últimas notificaciones del usuario, con el título y la ruta de cada obra, y cuántas quedan sin leer. */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const db = notificationsDb();

  const [{ data, error }, { count }] = await Promise.all([
    db.from("notifications").select("id, kind, pelicula_id, score, created_at, read_at")
      .eq("user_id", auth.userId).order("created_at", { ascending: false }).limit(PAGE_SIZE),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", auth.userId).is("read_at", null),
  ]);
  if (error) {
    console.error("[api/notifications GET]", error.code, error.message);
    return NextResponse.json({ items: [], unread: 0, error: error.message });
  }

  const rows = (data ?? []) as Row[];
  const filmIds = [...new Set(rows.map((r) => r.pelicula_id))];
  const { data: films } = filmIds.length
    ? await db.from("peliculas").select("id, slug, title").in("id", filmIds)
    : { data: [] };
  const filmById = new Map(((films ?? []) as { id: number; slug: string; title: string }[]).map((f) => [f.id, f]));

  const items = rows.flatMap((row) => {
    const film = filmById.get(row.pelicula_id);
    if (!film) return []; // la obra ya no existe
    return [{ id: row.id, kind: row.kind, score: row.score, createdAt: row.created_at, isRead: row.read_at !== null, film: { slug: film.slug, title: film.title } }];
  });
  return NextResponse.json({ items, unread: count ?? 0 });
}

/** Marca como leídas todas las notificaciones del usuario. */
export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const { error } = await notificationsDb()
    .from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.userId).is("read_at", null);
  if (error) {
    console.error("[api/notifications PATCH]", error.code, error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
