/**
 * Reglas de los comentarios y de sus respuestas, sin dependencias de red ni de React:
 * validación del cuerpo, comprobación del comentario padre y armado de los hilos.
 * Las usan la API (`/api/comments`) y la interfaz.
 */

import { authorKey, type AuthorDisplay } from "@/lib/profiles/author-avatar";

export const COMMENT_MAX_LENGTH = 1000;
const PROFILE_ID_MAX_LENGTH = 64;

export interface CommentInput {
  readonly peliculaId: number;
  readonly content: string;
  /** Momento del vídeo en segundos; solo en comentarios principales. */
  readonly timestampRef: number | null;
  readonly parentId: number | null;
  /**
   * Comentario concreto del hilo al que se responde (el principal o una respuesta). Es la mención: se guarda
   * la referencia, no el nombre, así que sigue siendo correcta si esa persona cambia de nombre.
   */
  readonly replyToId: number | null;
  /** Perfil con el que se comenta: `""` = el principal de la cuenta; si no, el id de un perfil secundario. */
  readonly profileId: string;
}

export type ParseResult =
  | { readonly ok: true; readonly data: CommentInput }
  | { readonly ok: false; readonly error: "invalid_input" };

const INVALID: ParseResult = { ok: false, error: "invalid_input" };
const INVALID_PATCH: PatchParseResult = { ok: false, error: "invalid_input" };

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Valida y normaliza el cuerpo de un comentario nuevo. Una respuesta nunca lleva momento. */
export function parseCommentBody(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return INVALID;
  const { peliculaId, content, timestampRef, parentId, profileId, replyToId } = body as Record<string, unknown>;

  if (!isPositiveInteger(peliculaId)) return INVALID;
  if (typeof content !== "string") return INVALID;
  const text = content.trim().slice(0, COMMENT_MAX_LENGTH).trim();
  if (text === "") return INVALID;

  if (parentId !== undefined && parentId !== null && !isPositiveInteger(parentId)) return INVALID;
  const parent = parentId ?? null;

  if (replyToId !== undefined && replyToId !== null && !isPositiveInteger(replyToId)) return INVALID;
  if (replyToId !== undefined && replyToId !== null && parent === null) return INVALID; // un comentario principal no responde a nadie
  const replyTo = (replyToId as number | null | undefined) ?? null;

  if (profileId !== undefined && profileId !== null && (typeof profileId !== "string" || profileId.length > PROFILE_ID_MAX_LENGTH)) return INVALID;

  if (timestampRef !== undefined && timestampRef !== null) {
    if (typeof timestampRef !== "number" || !Number.isInteger(timestampRef) || timestampRef < 0) return INVALID;
  }
  const moment = parent !== null ? null : ((timestampRef as number | null | undefined) ?? null);

  return { ok: true, data: { peliculaId, content: text, timestampRef: moment, parentId: parent, replyToId: replyTo, profileId: (profileId as string | null | undefined) ?? "" } };
}

export interface ParentRow {
  readonly id: number;
  readonly pelicula_id: number;
  readonly parent_id: number | null;
  readonly is_deleted: boolean;
}

export type ParentCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not_found" | "deleted" | "other_work" | "is_reply" };

/** Solo se responde a un comentario principal, no borrado y de la misma obra. */
export function checkParent(parent: ParentRow | null, peliculaId: number): ParentCheck {
  if (parent === null) return { ok: false, reason: "not_found" };
  if (parent.is_deleted) return { ok: false, reason: "deleted" };
  if (parent.pelicula_id !== peliculaId) return { ok: false, reason: "other_work" };
  if (parent.parent_id !== null) return { ok: false, reason: "is_reply" };
  return { ok: true };
}

export interface ReplyTargetRow {
  readonly id: number;
  readonly pelicula_id: number;
  readonly parent_id: number | null;
  readonly is_deleted: boolean;
}

export type ReplyTargetCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not_found" | "deleted" | "other_work" | "other_thread" };

/** Se menciona al comentario principal del hilo o a una respuesta de ese mismo hilo, vivo y de la misma obra. */
export function checkReplyTarget(target: ReplyTargetRow | null, parentId: number, peliculaId: number): ReplyTargetCheck {
  if (target === null) return { ok: false, reason: "not_found" };
  if (target.is_deleted) return { ok: false, reason: "deleted" };
  if (target.pelicula_id !== peliculaId) return { ok: false, reason: "other_work" };
  if (target.id !== parentId && target.parent_id !== parentId) return { ok: false, reason: "other_thread" };
  return { ok: true };
}

/**
 * Añade a cada respuesta con mención el nombre ACTUAL del autor mencionado (`reply_to_name`), tomado de la
 * lista ya resuelta con los datos vigentes de cada perfil. Si el comentario mencionado ya no está visible
 * (borrado), el nombre es `null` y se conserva `reply_to_id`. Devuelve copias: no modifica la lista.
 */
export function attachReplyTargets<T extends { readonly id: number; readonly display_name: string; readonly reply_to_id?: number | null }>(
  rows: readonly T[],
): (T & { reply_to_name: string | null })[] {
  const nameById = new Map(rows.map((row) => [row.id, row.display_name]));
  return rows.map((row) => ({
    ...row,
    reply_to_name: row.reply_to_id != null ? (nameById.get(row.reply_to_id) ?? null) : null,
  }));
}

interface ThreadRow {
  readonly id: number;
  readonly parent_id: number | null;
  readonly like_count: number;
  readonly created_at: string;
}

export type Thread<T extends ThreadRow> = T & { replies: T[] };

const byDateAscending = (a: ThreadRow, b: ThreadRow) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

/**
 * Agrupa los comentarios en hilos de un solo nivel en una pasada. Las respuestas cuyo padre no está
 * en la lista (borrado o inexistente) no aparecen. Principales: más «me gusta» primero y, a igualdad,
 * los más recientes; respuestas: de más antigua a más nueva.
 */
export function groupThreads<T extends ThreadRow>(rows: readonly T[]): Thread<T>[] {
  const repliesByParent = new Map<number, T[]>();
  for (const row of rows) {
    if (row.parent_id === null) continue;
    const list = repliesByParent.get(row.parent_id);
    if (list) list.push(row);
    else repliesByParent.set(row.parent_id, [row]);
  }
  return rows
    .filter((row) => row.parent_id === null)
    .map((row) => ({ ...row, replies: [...(repliesByParent.get(row.id) ?? [])].sort(byDateAscending) }))
    .sort((a, b) => b.like_count - a.like_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** Total de comentarios visibles: principales más sus respuestas. */
export function countComments(threads: readonly { readonly replies?: readonly unknown[] }[]): number {
  return threads.reduce((total, thread) => total + 1 + (thread.replies?.length ?? 0), 0);
}

/** Mensaje para el usuario según la respuesta de la API al publicar un comentario o una respuesta. */
export function commentErrorMessage(status: number, code: string | null): string {
  if (status === 429) return "Estás comentando demasiado rápido. Espera un momento e inténtalo de nuevo.";
  if (code === "parent_invalid" || code === "reply_target_invalid") return "Ya no se puede responder a este comentario: puede que se haya eliminado. Recarga para ver los cambios.";
  if (code === "timestamp_out_of_range") return "El momento indicado se pasa de la duración de la obra. Revísalo e inténtalo de nuevo.";
  return "No se pudo publicar tu comentario. Inténtalo de nuevo.";
}

/**
 * Aplica a cada comentario el autor resuelto (nombre, foto, icono y color del perfil con el que escribió).
 * Si no hay autor resuelto se conservan el nombre y el color guardados en el comentario, sin foto.
 * Devuelve copias: no modifica la lista.
 */
export function attachAuthors<
  T extends {
    readonly user_id: string;
    readonly profile_id?: string | null;
    readonly display_name: string;
    readonly avatar_color: string | null;
  },
>(
  rows: readonly T[],
  authors: Readonly<Record<string, AuthorDisplay | undefined>>,
): (T & { avatar_url: string | null; avatar_icon_id: string | null })[] {
  return rows.map((row) => {
    const author = authors[authorKey(row.user_id, row.profile_id)];
    return {
      ...row,
      display_name: author?.displayName ?? row.display_name,
      avatar_url: author?.avatarUrl ?? null,
      avatar_icon_id: author?.avatarIconId ?? null,
      avatar_color: author ? author.avatarColor : row.avatar_color,
    };
  });
}

// ── Edición y acciones del creador ───────────────────────────────────────────

export const CREATOR_ACTIONS = ["pin", "unpin", "heart", "unheart"] as const;
export type CreatorAction = (typeof CREATOR_ACTIONS)[number];

export type CommentPatch =
  | { readonly kind: "edit"; readonly commentId: number; readonly content: string }
  | { readonly kind: "action"; readonly commentId: number; readonly action: CreatorAction };

export type PatchParseResult =
  | { readonly ok: true; readonly data: CommentPatch }
  | { readonly ok: false; readonly error: "invalid_input" };

/** Cuerpo de `PATCH /api/comments`: editar el propio comentario o una acción del creador (no ambas). */
export function parsePatchBody(body: unknown): PatchParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return INVALID_PATCH;
  const { commentId, content, action } = body as Record<string, unknown>;
  if (!isPositiveInteger(commentId)) return INVALID_PATCH;

  if (action !== undefined) {
    if (content !== undefined) return INVALID_PATCH;
    return (CREATOR_ACTIONS as readonly unknown[]).includes(action)
      ? { ok: true, data: { kind: "action", commentId, action: action as CreatorAction } }
      : INVALID_PATCH;
  }
  if (typeof content !== "string") return INVALID_PATCH;
  const text = content.trim().slice(0, COMMENT_MAX_LENGTH).trim();
  return text === "" ? INVALID_PATCH : { ok: true, data: { kind: "edit", commentId, content: text } };
}

/** Alias con el nombre que usa la API. */
export const parseCommentPatch = parsePatchBody;

/** Añade `is_creator` a cada comentario según si lo escribió el creador del título. Devuelve copias. */
export function flagCreator<T extends { readonly user_id: string }>(
  rows: readonly T[],
  creatorUserId: string | null,
): (T & { is_creator: boolean })[] {
  return rows.map((row) => ({ ...row, is_creator: creatorUserId !== null && row.user_id === creatorUserId }));
}

/** ¿Puede el creador hacer esta acción sobre este comentario? Fijar solo vale en comentarios principales. */
export function canCreatorAct(
  target: { readonly pelicula_id: number; readonly parent_id: number | null; readonly is_deleted: boolean },
  peliculaId: number,
  action: CreatorAction,
): boolean {
  if (target.is_deleted || target.pelicula_id !== peliculaId) return false;
  if ((action === "pin" || action === "unpin") && target.parent_id !== null) return false;
  return true;
}
