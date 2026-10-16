import { NextResponse } from "next/server";
import {
  attachAuthors, attachReplyTargets, canCreatorAct, checkParent, checkReplyTarget, flagCreator, groupThreads, parseCommentBody, parsePatchBody,
  type ParentRow, type ReplyTargetRow,
} from "@/lib/comments/validation";
import { loadAuthors } from "@/lib/profiles/author-lookup";
import { authorKey } from "@/lib/profiles/author-avatar";
import { parseRuntimeSeconds } from "@/lib/comments/timestamp";
import { hasLiked, ownsStoredComment, requestProfileId } from "@/lib/comments/ownership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

type LikeRow = { user_id: string; profile_id: string | null };

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(request: Request) {
  const peliculaId = Number(new URL(request.url).searchParams.get("peliculaId"));
  if (!Number.isInteger(peliculaId) || peliculaId <= 0) return NextResponse.json([]);

  if (!rateLimit(`${clientIp(request)}/comments-get`, 60)) return NextResponse.json([], { status: 429 });

  const admin  = getSupabaseAdminClient();
  const userId = await getUserId(request);
  const viewerProfileId = requestProfileId({ profileId: new URL(request.url).searchParams.get("profileId") ?? "" });

  const { data: all, error } = await admin
    .from("comments")
    .select("*, comment_likes(user_id, profile_id)")
    .eq("pelicula_id", peliculaId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/comments GET]", error.code, error.message);
    return NextResponse.json([], { status: 500 });
  }
  if (!all?.length) return NextResponse.json([]);

  // Los «me gusta» solo se usan para saber si es del usuario; no se envía quién los dio.
  const rows = all.map(({ comment_likes, ...comment }) => ({
    ...comment,
    liked_by_me: hasLiked((comment_likes ?? []) as LikeRow[], userId, viewerProfileId),
  }));

  // Nombre, foto o icono y color actuales del perfil con el que escribió cada autor.
  const authors = await loadAuthors(rows);
  const creatorUserId = await creatorOf(peliculaId);

  const viewerIsCreator = creatorUserId !== null && creatorUserId === userId;
  // Cada mención muestra el nombre ACTUAL del autor mencionado (no un texto guardado que puede quedar viejo).
  const flagged = attachReplyTargets(flagCreator(attachAuthors(rows, authors), creatorUserId)).map((row) => ({ ...row, viewer_is_creator: viewerIsCreator }));
  return NextResponse.json(groupThreads(flagged));
}

/** Creador (cuenta) de una obra, o `null` si no tiene. */
async function creatorOf(peliculaId: number): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdminClient() as any).from("peliculas").select("creator_user_id").eq("id", peliculaId).maybeSingle();
  return (data as { creator_user_id: string | null } | null)?.creator_user_id ?? null;
}

/** La base de datos aún no tiene las columnas de edición/fijado/corazón (migración sin aplicar). */
const isMissingColumn = (code: string | undefined) => code === "PGRST204" || code === "42703";

const PARENT_STATUS = { not_found: 404, deleted: 404, other_work: 400, is_reply: 400 } as const;
const REPLY_TARGET_STATUS = { not_found: 404, deleted: 404, other_work: 400, other_thread: 400 } as const;

export async function POST(request: Request) {
  if (!rateLimit(`${clientIp(request)}/comments-post`, 10)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseCommentBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { peliculaId, content, timestampRef, parentId, replyToId, profileId } = parsed.data;

  const admin = getSupabaseAdminClient();

  // La obra debe existir; su duración limita el momento del comentario.
  const { data: work } = await admin.from("peliculas").select("id, duration").eq("id", peliculaId).maybeSingle();
  if (!work) return NextResponse.json({ error: "work_not_found" }, { status: 404 });

  if (timestampRef !== null) {
    const duration = parseRuntimeSeconds(work.duration);
    if (duration !== null && timestampRef > duration) {
      return NextResponse.json({ error: "timestamp_out_of_range", maxSeconds: duration }, { status: 400 });
    }
  }

  // Solo se responde a un comentario principal, vivo y de la misma obra.
  if (parentId !== null) {
    const { data: parent } = await admin
      .from("comments")
      .select("id, pelicula_id, parent_id, is_deleted")
      .eq("id", parentId)
      .maybeSingle();
    const check = checkParent((parent as ParentRow | null) ?? null, peliculaId);
    if (!check.ok) {
      return NextResponse.json({ error: "parent_invalid", reason: check.reason }, { status: PARENT_STATUS[check.reason] });
    }
  }

  // La mención: el comentario concreto del mismo hilo al que se responde (se guarda la referencia, no el nombre).
  let replyTarget: (ReplyTargetRow & { user_id: string; profile_id: string | null }) | null = null;
  if (replyToId !== null && parentId !== null) {
    const { data: target } = await admin
      .from("comments")
      .select("id, pelicula_id, parent_id, is_deleted, user_id, profile_id")
      .eq("id", replyToId)
      .maybeSingle();
    const check = checkReplyTarget(target ?? null, parentId, peliculaId);
    if (!check.ok) {
      return NextResponse.json({ error: "reply_target_invalid", reason: check.reason }, { status: REPLY_TARGET_STATUS[check.reason] });
    }
    replyTarget = target;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_color")
    .eq("id", userId)
    .single();

  // El perfil secundario debe ser de esta cuenta; si no, se comenta con el principal.
  let authorProfileId = "";
  if (profileId !== "") {
    const { data: sub } = await admin.from("sub_profiles").select("id").eq("id", profileId).eq("user_id", userId).maybeSingle();
    if (sub) authorProfileId = profileId;
  }

  const row = {
    pelicula_id:   peliculaId,
    user_id:       userId,
    display_name:  profile?.display_name ?? "Usuario",
    avatar_color:  profile?.avatar_color ?? null,
    parent_id:     parentId,
    content,
    timestamp_ref: timestampRef,
  };
  let { data, error } = await admin.from("comments").insert({ ...row, profile_id: authorProfileId, reply_to_id: replyToId } as typeof row).select().single();
  // PGRST204: PostgREST no conoce la columna; 42703: la base de datos no la tiene.
  if (error?.code === "PGRST204" || error?.code === "42703") {
    // Las columnas `profile_id` / `reply_to_id` aún no existen en esta base de datos (migración sin aplicar): se publica sin ellas.
    ({ data, error } = await admin.from("comments").insert(row).select().single());
  }

  if (error || !data) {
    console.error("[api/comments POST]", error?.code, error?.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const authors = await loadAuthors([
    { user_id: userId, profile_id: authorProfileId },
    ...(replyTarget ? [{ user_id: replyTarget.user_id, profile_id: replyTarget.profile_id }] : []),
  ]);
  const [published] = attachAuthors([{ ...data, profile_id: authorProfileId }], authors);
  const replyToName = replyTarget ? (authors[authorKey(replyTarget.user_id, replyTarget.profile_id)]?.displayName ?? null) : null;
  return NextResponse.json({ ...published, reply_to_id: replyTarget ? replyToId : null, reply_to_name: replyToName, liked_by_me: false, replies: [] });
}

/**
 * Editar el propio comentario («editado») o, el creador del título, fijar/quitar fijado y dar/quitar corazón.
 */
export async function PATCH(request: Request) {
  if (!rateLimit(`${clientIp(request)}/comments-patch`, 30)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  const parsed = parsePatchBody(rawBody);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const patch = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: target } = await admin
    .from("comments")
    .select("id, user_id, profile_id, pelicula_id, parent_id, is_deleted")
    .eq("id", patch.commentId)
    .maybeSingle();
  if (!target || target.is_deleted) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (patch.kind === "edit") {
    if (!ownsStoredComment(target, userId, requestProfileId(rawBody))) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const editedAt = new Date().toISOString();
    let { error } = await admin.from("comments").update({ content: patch.content, edited_at: editedAt }).eq("id", target.id);
    if (isMissingColumn(error?.code)) ({ error } = await admin.from("comments").update({ content: patch.content }).eq("id", target.id));
    if (error) {
      console.error("[api/comments PATCH edit]", error.code, error.message);
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, content: patch.content, edited_at: editedAt });
  }

  // Acciones del creador del título.
  if ((await creatorOf(target.pelicula_id)) !== userId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!canCreatorAct(target, target.pelicula_id, patch.action)) return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });

  let error: { code?: string; message: string } | null = null;
  if (patch.action === "pin") {
    // Solo hay un comentario fijado por obra: se quita el anterior.
    await admin.from("comments").update({ pinned_at: null }).eq("pelicula_id", target.pelicula_id).not("pinned_at", "is", null);
    ({ error } = await admin.from("comments").update({ pinned_at: new Date().toISOString() }).eq("id", target.id));
  } else if (patch.action === "unpin") {
    ({ error } = await admin.from("comments").update({ pinned_at: null }).eq("id", target.id));
  } else {
    ({ error } = await admin.from("comments").update({ creator_hearted: patch.action === "heart" }).eq("id", target.id));
  }
  if (isMissingColumn(error?.code)) return NextResponse.json({ ok: false, error: "feature_unavailable" }, { status: 503 });
  if (error) {
    console.error("[api/comments PATCH action]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Borrado lógico del comentario propio (`is_deleted = true`, el mismo flag que ya
 * filtra el listado). Solo el autor puede borrarlo; las respuestas desaparecen
 * con él porque el listado solo muestra respuestas de comentarios visibles.
 */
export async function DELETE(request: Request) {
  if (!rateLimit(`${clientIp(request)}/comments-delete`, 20)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { commentId?: unknown } | null;
  const commentId = body?.commentId;
  const profileId = requestProfileId(body);
  if (typeof commentId !== "number" || !Number.isInteger(commentId) || commentId <= 0) {
    return NextResponse.json({ ok: false, error: "commentId required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: stored } = await admin
    .from("comments")
    .select("user_id, profile_id")
    .eq("id", commentId)
    .eq("is_deleted", false)
    .maybeSingle();
  // Otro perfil de la misma cuenta tampoco puede borrarlo.
  if (!stored || !ownsStoredComment(stored, userId, profileId)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const { data, error } = await admin
    .from("comments")
    .update({ is_deleted: true })
    .eq("id", commentId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .select("id");

  if (error) {
    console.error("[api/comments DELETE]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
