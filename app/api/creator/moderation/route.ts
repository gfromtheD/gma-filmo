import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { groupReports, parseModerationBody, reportStatusFor, type ReportRow } from "@/lib/comments/moderation";

const LIMIT_PER_MINUTE = 30;

function limited(userId: string): NextResponse | null {
  return rateLimit(`${userId}/creator-moderation`, LIMIT_PER_MINUTE)
    ? null
    : NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
}

/** Comentarios con denuncias pendientes en las obras del creador, con el título de cada obra. */
export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const tooMany = limited(userId);
  if (tooMany) return tooMany;

  const admin = getSupabaseAdminClient();
  const { data: films, error: filmsError } = await admin.from("peliculas").select("id, slug, title").eq("creator_user_id", userId);
  if (filmsError) {
    console.error("[creator moderation GET films]", filmsError.code, filmsError.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  const filmList = films ?? [];
  if (filmList.length === 0) return NextResponse.json({ ok: true, items: [] });

  const { data: rows, error } = await admin
    .from("comment_reports")
    .select("comment_id, created_at, comments!inner(id, content, pelicula_id, display_name, is_deleted)")
    .eq("status", "pending")
    .in("comments.pelicula_id", filmList.map((f) => f.id));
  if (error) {
    console.error("[creator moderation GET reports]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  const filmById = new Map(filmList.map((f) => [f.id, f]));
  const items = groupReports((rows ?? []) as unknown as ReportRow[]).flatMap((item) => {
    const film = filmById.get(item.peliculaId);
    return film ? [{ ...item, film: { slug: film.slug, title: film.title } }] : [];
  });
  return NextResponse.json({ ok: true, items });
}

/**
 * Decisión del creador sobre un comentario de una de sus obras: «dismiss» descarta las denuncias; «hide» oculta el comentario
 * (el mismo borrado lógico que usa su autor) y da por revisadas sus denuncias. «hide» también vale sin denuncias.
 */
export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const tooMany = limited(userId);
  if (tooMany) return tooMany;

  const body = parseModerationBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data: comment } = await admin.from("comments").select("id, pelicula_id").eq("id", body.commentId).maybeSingle();
  if (!comment) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const { data: film } = await admin.from("peliculas").select("creator_user_id").eq("id", comment.pelicula_id).maybeSingle();
  if (!film || film.creator_user_id !== userId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  if (body.action === "hide") {
    const { error } = await admin.from("comments").update({ is_deleted: true }).eq("id", body.commentId);
    if (error) {
      console.error("[creator moderation hide]", error.code, error.message);
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
  }
  const { error: reportsError } = await admin
    .from("comment_reports")
    .update({ status: reportStatusFor(body.action) })
    .eq("comment_id", body.commentId)
    .eq("status", "pending");
  if (reportsError) {
    console.error("[creator moderation reports]", reportsError.code, reportsError.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
