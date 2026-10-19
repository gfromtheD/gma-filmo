import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { buildUserExport, renderExportHtml, type FilmRef, type RawExport } from "@/lib/export/user-data";

/** Pocas descargas por usuario y minuto: es una copia completa y no hace falta pedirla a menudo. */
const EXPORTS_PER_MINUTE = 3;

/**
 * Configuración → «Tus datos» (derecho de acceso y portabilidad del RGPD). `?format=html` (por defecto) devuelve una
 * página que se abre con doble clic; `?format=json` los mismos datos en formato técnico. En ambos, cada obra va con su
 * título. Cada apartado se lee por separado: si una tabla no existe todavía, ese apartado sale vacío.
 */
export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/export`, EXPORTS_PER_MINUTE)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "html";

  // Algunas tablas (listas, notificaciones) aún no están en types/database.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdminClient() as any;
  const read = async (table: string, column: string, select = "*") => {
    const { data, error } = await admin.from(table).select(select).eq(column, userId);
    if (error) console.error(`[api/user/export] ${table}`, error.code, error.message);
    return error ? [] : (data ?? []);
  };

  const { data: { user } } = await admin.auth.admin.getUserById(userId);
  const [profile, creatorProfile, watchlist, ratings, history, comments, lists, notifications] = await Promise.all([
    read("profiles", "id", "display_name, username, username_changed_at"),
    read("creator_profiles", "user_id", "studio_name, creator_name, role, location, bio, social_links"),
    read("watchlist", "user_id", "profile_id, pelicula_id, added_at"),
    read("ratings", "user_id", "profile_id, pelicula_id, score, comment, rated_at"),
    read("view_history", "user_id", "profile_id, pelicula_id, last_position, completed, last_watched_at"),
    read("comments", "user_id", "id, pelicula_id, parent_id, content, created_at, is_deleted"),
    read("user_lists", "user_id", "id, profile_id, name, created_at, user_list_items(pelicula_id, added_at)"),
    read("notifications", "user_id", "kind, pelicula_id, score, created_at, read_at"),
  ]);

  const raw: RawExport = {
    exportedAt: new Date().toISOString(),
    account: { id: userId, email: user?.email ?? null, createdAt: user?.created_at ?? null },
    profile: profile[0] ?? null,
    creatorProfile: creatorProfile[0] ?? null,
    watchlist, ratings, history, comments, lists, notifications,
  };

  // Títulos de todas las obras que aparecen en los datos, en una sola consulta.
  const filmIds = [...new Set<number>([
    ...watchlist, ...ratings, ...history, ...comments, ...notifications,
    ...lists.flatMap((l: { user_list_items: unknown[] }) => l.user_list_items),
  ].map((row) => (row as { pelicula_id: number }).pelicula_id))];
  const { data: filmRows, error: filmsError } = filmIds.length
    ? await admin.from("peliculas").select("id, slug, title, year").in("id", filmIds)
    : { data: [], error: null };
  if (filmsError) console.error("[api/user/export] peliculas", filmsError.code, filmsError.message);
  const films: FilmRef[] = ((filmRows ?? []) as { id: number; slug: string; title: string; year: string | number | null }[])
    .map((f) => ({ id: f.id, slug: f.slug, title: f.title, year: Number.parseInt(String(f.year ?? ""), 10) || null }));

  const data = buildUserExport(raw, films);
  const stamp = new Date().toISOString().slice(0, 10);
  const isJson = format === "json";
  return new NextResponse(isJson ? JSON.stringify(data, null, 2) : renderExportHtml(data), {
    headers: {
      "Content-Type": isJson ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="gma-filmo-mis-datos-${stamp}.${isJson ? "json" : "html"}"`,
      "Cache-Control": "no-store",
    },
  });
}
