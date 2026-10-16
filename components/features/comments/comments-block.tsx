"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { GmaIcon } from "@/components/ui/gma-icon";
import { EditPencil, Trash } from "@/components/ui/icons";
import { isOwnComment } from "@/lib/comments/ownership";
import { useIsGuest } from "@/hooks/use-is-guest";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { LoginPromptInput } from "@/components/features/ratings/login-prompt-input";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { authHeaders, patchComment } from "@/lib/comments/client";
import { CommentText } from "@/components/features/comments/comment-text";
import { CommentSortControl } from "@/components/features/comments/comment-sort";
import { commentAnchorId, formatCompactCount, likeButtonLabel, parseCommentHash, sortThreads, type CommentSort } from "@/lib/comments/presentation";
import { formatTimestamp, validateTimestamp, workNoun, type WorkType } from "@/lib/comments/timestamp";
import { commentErrorMessage, countComments } from "@/lib/comments/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  id:            number;
  pelicula_id:   number;
  user_id:       string;
  display_name:  string;
  avatar_color:  string | null;
  /** Foto del perfil con el que escribió; si falta o no carga, icono o inicial. */
  avatar_url?:   string | null;
  /** Icono del catálogo cuando el perfil elige uno en vez de una foto. */
  avatar_icon_id?: string | null;
  parent_id:     number | null;
  content:       string;
  timestamp_ref: number | null;
  like_count:    number;
  liked_by_me:   boolean;
  created_at:    string;
  replies:       Comment[];
  /** Lo escribió el creador del título. */
  is_creator?:   boolean;
  /** El usuario que mira es el creador del título (puede fijar y dar corazón). */
  viewer_is_creator?: boolean;
  edited_at?:    string | null;
  pinned_at?:    string | null;
  creator_hearted?: boolean;
  /** Comentario concreto del hilo al que responde (la mención). Se guarda la referencia, no el nombre. */
  reply_to_id?:  number | null;
  /** Nombre ACTUAL del autor mencionado; `null` si ese comentario ya no existe. */
  reply_to_name?: string | null;
}

interface CommentsBlockProps {
  readonly peliculaId: number;
  readonly movieSlug:  string;
  /** Sección de la ficha: define cómo se nombra la obra («del cortometraje» / «de la película»). */
  readonly workType?: WorkType;
  /** Duración de la obra en segundos; si se conoce, el momento del comentario no puede pasarse de ella. */
  readonly durationSeconds?: number | null;
}

/** Comentarios principales que se muestran de una vez. */
const PAGE_SIZE = 10;
/** Respuestas que se muestran de una vez en cada hilo (después, «Mostrar más respuestas»). */
const REPLY_PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1)   return "ahora mismo";
  if (mins < 60)  return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `hace ${days} d`;
  if (days < 30)  return `hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)} mes`;
  return `hace ${Math.floor(days / 365)} año`;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// ─── Avatar ───────────────────────────────────────────────────────────────────

// ─── Timestamp pill ───────────────────────────────────────────────────────────

function TimestampPill({ secs, movieSlug }: { secs: number; movieSlug: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/ver/${movieSlug}?t=${secs}`)}
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-bold text-[#22B16B] transition-colors hover:bg-[#22B16B]/20 ${FOCUS}`}
      style={{ background: "rgba(34,177,107,0.10)", fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}
      title={`Ir al minuto ${formatTimestamp(secs)}`}
    >
      <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor" aria-hidden>
        <path d="M1 1.5v7l6.5-3.5L1 1.5z" />
      </svg>
      {formatTimestamp(secs)}
    </button>
  );
}

// ─── Comment form ─────────────────────────────────────────────────────────────

function CommentForm({
  peliculaId,
  parentId,
  placeholder,
  onSubmitted,
  onCancel,
  compact = false,
  workType = "cortometraje",
  durationSeconds = null,
  replyTo,
}: {
  /** A quién se responde dentro del hilo (solo al responder a una respuesta). */
  replyTo?:         { id: number; name: string };
  workType?:        WorkType;
  durationSeconds?: number | null;
  peliculaId:   number;
  parentId?:    number;
  placeholder?: string;
  onSubmitted:  (comment: Comment) => void;
  onCancel?:    () => void;
  compact?:     boolean;
}) {
  const currentUserId = useSupabaseUserId();
  const activeProfileId = useActiveProfileId();
  const [content, setContent]       = useState("");
  const [tsInput, setTsInput]       = useState("");
  const [showTs, setShowTs]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Al responder a alguien concreto el campo se enfoca para escribir directamente.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noun       = workNoun(workType);
  const validation = showTs ? validateTimestamp(tsInput, durationSeconds) : null;
  const tsSeconds  = validation?.ok ? validation.seconds : null;
  const tsValid    = validation === null || validation.ok;
  const canSubmit = content.trim().length > 0 && tsValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !currentUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method:  "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          peliculaId,
          content:      content.trim(),
          timestampRef: tsSeconds,
          parentId:     parentId ?? null,
          replyToId:    replyTo?.id ?? null,
          profileId:    activeProfileId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        setError(commentErrorMessage(res.status, typeof body?.error === "string" ? body.error : null));
        return;
      }
      const newComment = await res.json() as Comment;
      onSubmitted(newComment);
      setContent("");
      setTsInput("");
      setShowTs(false);
    } catch {
      setError("No se pudo publicar tu comentario. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={compact ? "" : "mb-8"}>
      {replyTo && (
        <p className="mb-2 text-[13px] text-[#BBBBBB]">
          Respondiendo a <span className="font-semibold text-[#22B16B]">@{replyTo.name}</span>
        </p>
      )}
      <label htmlFor={`comment-${parentId ?? "new"}`} className="sr-only">
        {parentId ? "Tu respuesta" : "Tu comentario"}
      </label>
      <textarea
        id={`comment-${parentId ?? "new"}`}
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder ?? "Comparte tu opinión sobre esta obra…"}
        maxLength={1000}
        rows={compact ? 2 : 3}
        disabled={submitting}
        className="w-full resize-y rounded-[8px] border-2 border-white/15 bg-black/40 px-4 py-3 text-[16px] leading-[1.5] text-white placeholder-[#909090] outline-none transition-colors focus:border-[#22B16B] disabled:opacity-60"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!parentId && (
          showTs ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#BBBBBB]">⏱</span>
              <input
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="0:00"
                inputMode="numeric"
                aria-label={`Momento ${noun.del} (minutos:segundos)`}
                maxLength={8}
                className="w-24 rounded-[6px] border border-white/15 bg-black/40 px-2 py-1.5 text-center text-[15px] font-semibold tabular-nums tracking-[0.08em] text-white outline-none placeholder:font-normal placeholder:text-white/20 focus:border-[#22B16B]"
                style={{ fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}
              />
              {validation && !validation.ok && (
                <span role="alert" className="text-[12px] text-red-300">
                  {validation.reason === "beyond"
                    ? `El ${noun.name} dura ${formatTimestamp(validation.maxSeconds)}`
                    : "Formato: m:ss"}
                </span>
              )}
              <button
                type="button"
                onClick={() => { setShowTs(false); setTsInput(""); }}
                aria-label={`Quitar el momento ${noun.del}`}
                className={`text-[12px] text-[#BBBBBB] transition-colors hover:text-white ${FOCUS}`}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowTs(true)}
              className={`flex items-center gap-1.5 text-[13px] text-[#BBBBBB] transition-colors hover:text-white ${FOCUS}`}
            >
              <span aria-hidden="true">⏱</span>
              <span>Añadir momento {noun.del}</span>
            </button>
          )
        )}

        <div className="flex-1" />

        <span className="text-[12px] text-[#BBBBBB]" aria-live="polite">
          {content.length} / 1.000
        </span>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`h-10 rounded-[4px] px-4 text-[14px] font-bold text-white transition-colors hover:text-[#22B16B] ${FOCUS}`}
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className={`h-10 rounded-[4px] bg-[#22B16B] px-5 text-[14px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
        >
          {submitting ? "Publicando…" : "Publicar"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-[6px] border border-red-400/40 bg-red-500/10 px-4 py-3 text-[14px] font-medium text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Hilo de respuestas (línea con codos, como YouTube) ───────────────────────

/** Color de la línea del hilo. */
const THREAD_LINE = "border-[#3A3A52]";

/**
 * Un elemento del hilo: dibuja a su izquierda el codo curvo que baja desde la línea hasta su avatar y,
 * si no es el último, el tramo que sigue hacia el siguiente. El último cierra la línea con su codo.
 * `elbowY` = altura del centro de su avatar.
 */
function ThreadItem({ isLast, elbowY, children }: { isLast: boolean; elbowY: number; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className={`pointer-events-none absolute -left-[35.5px] top-0 w-[31px] rounded-bl-[14px] border-b-2 border-l-2 ${THREAD_LINE}`} style={{ height: elbowY }} />
      {!isLast && (
        <span aria-hidden="true" className={`pointer-events-none absolute -bottom-4 -left-[35.5px] border-l-2 ${THREAD_LINE}`} style={{ top: elbowY }} />
      )}
      {children}
    </div>
  );
}

// ─── Single comment card ──────────────────────────────────────────────────────

function CommentCard({
  comment,
  movieSlug,
  peliculaId,
  currentUserId,
  onReplyAdded,
  onDeleted,
  onPinChange,
  viewerIsCreator,
  durationSeconds,
  highlightId,
  threadId,
  threadNames,
}: {
  /** Comentario principal del hilo (solo en respuestas): a él se publican todas las respuestas del hilo. */
  threadId?:     number;
  /** Nombres de quienes participan en el hilo (solo en respuestas), para resaltar las menciones. */
  threadNames?:  readonly string[];
  comment:       Comment;
  movieSlug:     string;
  peliculaId:    number;
  currentUserId: string | null;
  onReplyAdded:  (parentId: number, reply: Comment) => void;
  onDeleted:     (comment: Comment) => void;
  onPinChange:   (commentId: number, pinned: boolean) => void;
  viewerIsCreator: boolean;
  durationSeconds: number | null;
  highlightId:   number | null;
}) {
  const isGuest  = useIsGuest();
  const activeProfileId = useActiveProfileId();
  // Cada perfil gestiona solo sus comentarios, aunque otro perfil de la misma cuenta haya escrito otros.
  const isOwn    = isOwnComment(comment, currentUserId, activeProfileId);
  const [liked,  setLiked]  = useState(comment.liked_by_me);
  const [count,  setCount]  = useState(comment.like_count);
  const [showReplies,  setShowReplies]  = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [text, setText]           = useState(comment.content);
  const [editedAt, setEditedAt]   = useState(comment.edited_at ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft]         = useState(comment.content);
  const [isSaving, setIsSaving]   = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [hearted, setHearted]     = useState(Boolean(comment.creator_hearted));
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const pinned = Boolean(comment.pinned_at);

  async function handleSaveEdit() {
    const next = draft.trim();
    if (next === "" || next === text) { setIsEditing(false); return; }
    setIsSaving(true);
    setEditError(null);
    const result = await patchComment({ commentId: comment.id, content: next, profileId: activeProfileId });
    setIsSaving(false);
    if (!result.ok) { setEditError("No se pudo guardar el cambio. Inténtalo de nuevo."); return; }
    setText(typeof result.data.content === "string" ? result.data.content : next);
    setEditedAt(typeof result.data.edited_at === "string" ? result.data.edited_at : new Date().toISOString());
    setIsEditing(false);
  }

  async function handleCreatorAction(action: "pin" | "unpin" | "heart" | "unheart") {
    setCreatorError(null);
    const result = await patchComment({ commentId: comment.id, action });
    if (!result.ok) {
      setCreatorError(result.error === "feature_unavailable" ? "Esta función aún no está disponible." : "No se pudo completar la acción.");
      return;
    }
    if (action === "heart" || action === "unheart") setHearted(action === "heart");
    else onPinChange(comment.id, action === "pin");
  }

  async function handleLike() {
    if (!currentUserId) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    try {
      const res = await fetch("/api/comments/like", {
        method:  "POST",
        headers: await authHeaders(),
        body:    JSON.stringify({ commentId: comment.id, profileId: activeProfileId }),
      });
      if (!res.ok) { setLiked(liked); setCount(comment.like_count); }
    } catch {
      setLiked(liked);
      setCount(comment.like_count);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/comments", {
        method:  "DELETE",
        headers: await authHeaders(),
        body:    JSON.stringify({ commentId: comment.id, profileId: activeProfileId }),
      });
      if (res.status === 404) {
        onDeleted(comment); // ya no existía (p. ej. borrado desde otra pestaña)
        return;
      }
      if (!res.ok) {
        setDeleteError("No se pudo eliminar el comentario. Inténtalo de nuevo.");
        setIsConfirmingDelete(false);
        return;
      }
      onDeleted(comment);
    } catch {
      setDeleteError("No se pudo eliminar el comentario. Comprueba tu conexión.");
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  const replies     = comment.replies ?? [];
  const replyCount  = replies.length;
  const isReply     = comment.parent_id !== null;
  const effectiveThreadId = threadId ?? comment.id;
  // Mención por referencia: «@» + nombre actual del autor del comentario mencionado (puede ser el principal del hilo).
  const mention = isReply && comment.reply_to_id != null
    ? { id: comment.reply_to_id, name: comment.reply_to_name ?? null }
    : undefined;
  const names = threadNames ?? [comment.display_name, ...replies.map((r) => r.display_name)];
  const [repliesShown, setRepliesShown] = useState(REPLY_PAGE_SIZE);
  const highlightedReplyIndex = highlightId === null ? -1 : replies.findIndex((r) => r.id === highlightId);
  useEffect(() => {
    if (highlightedReplyIndex === -1) return;
    setShowReplies(true);
    setRepliesShown((n) => Math.max(n, highlightedReplyIndex + 1));
  }, [highlightedReplyIndex]);

  return (
    <div
      id={commentAnchorId(comment.id)}
      className={`scroll-mt-24 transition-shadow duration-500 ${isReply ? "flex gap-3 rounded-[8px]" : "grid grid-cols-[45px_minmax(0,1fr)] gap-x-3 rounded-[8px] border border-white/10 bg-black/40 backdrop-blur-md p-4 sm:p-6"} ${highlightId === comment.id ? "shadow-[0_0_0_2px_#22B16B]" : ""}`}
    >
      {isReply ? (
        <ProfileAvatar name={comment.display_name} color={comment.avatar_color} url={comment.avatar_url} iconId={comment.avatar_icon_id} size={32} />
      ) : (
        <div className="flex flex-col items-center">
          <ProfileAvatar name={comment.display_name} color={comment.avatar_color} url={comment.avatar_url} iconId={comment.avatar_icon_id} size={45} />
          {/* La línea del hilo nace bajo el avatar y baja hasta las respuestas. */}
          {replyCount > 0 && <span aria-hidden="true" className={`mt-1 w-0 flex-1 border-l-2 ${THREAD_LINE}`} />}
        </div>
      )}

      <div className={`min-w-0 flex-1 ${replyCount > 0 && !isReply ? "pb-3" : ""}`}>
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[14px] font-bold text-white">{comment.display_name}</span>
          {comment.is_creator && (
            <span className="rounded bg-[#22B16B]/20 px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[#22B16B]" title="Creador de esta obra">Creador</span>
          )}
          {isOwn && <span className="text-[12px] font-bold uppercase text-[#22B16B]">Tú</span>}
          <a
            href={`#${commentAnchorId(comment.id)}`}
            title="Enlace a este comentario"
            className={`text-[13px] font-bold uppercase text-[#BBBBBB] transition-colors hover:text-white hover:underline ${FOCUS}`}
          >
            <time dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time>
          </a>
          {editedAt && <span className="text-[12px] text-[#909090]">(editado)</span>}
          {pinned && !isReply && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white/80">Fijado</span>
          )}
          {hearted && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-[#22B16B]" title="Le gusta al creador de la obra">
              <GmaIcon name="heart" size={12} strokeWidth={0} style={{ fill: "#22B16B" }} />
              Del creador
            </span>
          )}
          {comment.timestamp_ref !== null && (
            <TimestampPill secs={comment.timestamp_ref} movieSlug={movieSlug} />
          )}
        </div>

        {isEditing ? (
          <div>
            <label htmlFor={`edit-${comment.id}`} className="sr-only">Editar tu comentario</label>
            <textarea
              id={`edit-${comment.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={isSaving}
              className="w-full resize-y rounded-[8px] border-2 border-white/15 bg-black/40 px-3 py-2 text-[16px] leading-[1.5] text-white outline-none focus:border-[#22B16B] disabled:opacity-60"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isSaving || draft.trim() === ""}
                className={`h-9 rounded-[4px] bg-[#22B16B] px-4 text-[13px] font-extrabold uppercase text-[#031A0E] disabled:opacity-40 ${FOCUS}`}
              >
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); setDraft(text); setEditError(null); }}
                className={`text-[13px] font-bold text-[#BBBBBB] hover:text-white ${FOCUS}`}
              >
                Cancelar
              </button>
              {editError && <span role="alert" className="text-[13px] text-red-200">{editError}</span>}
            </div>
          </div>
        ) : (
          <CommentText text={text} movieSlug={movieSlug} durationSeconds={durationSeconds} mention={mention} mentionNames={isReply && !mention ? names : undefined} className="text-[16px] leading-[1.5] text-white" />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {currentUserId ? (
            <button
              type="button"
              onClick={() => void handleLike()}
              aria-pressed={liked}
              aria-label={likeButtonLabel({ count, isReply, liked })}
              className={`flex items-center gap-1.5 text-[13px] font-bold transition-colors ${FOCUS} ${liked ? "text-[#22B16B]" : "text-[#BBBBBB] hover:text-white"}`}
            >
              <GmaIcon name="heart" size={14} strokeWidth={liked ? 0 : 1.8} style={{ fill: liked ? "#22B16B" : "none" }} />
              {count > 0 && <span>{formatCompactCount(count)}</span>}
              <span>De acuerdo</span>
            </button>
          ) : count > 0 ? (
            <span className="flex items-center gap-1.5 text-[13px] text-[#BBBBBB]" aria-label={`${count} ${count === 1 ? "persona está" : "personas están"} de acuerdo`}>
              <GmaIcon name="heart" size={14} strokeWidth={1.8} />
              <span>{formatCompactCount(count)}</span>
            </span>
          ) : null}

          {!isGuest && (
            <button
              type="button"
              onClick={() => setShowReplyForm((v) => !v)}
              aria-expanded={showReplyForm}
              className={`text-[13px] font-bold text-[#BBBBBB] transition-colors hover:text-white ${FOCUS}`}
            >
              ↩ Responder
            </button>
          )}

          {isOwn && !isEditing && (
            <button
              type="button"
              onClick={() => { setDraft(text); setIsEditing(true); }}
              className={`flex items-center gap-1.5 text-[13px] font-bold text-[#BBBBBB] transition-colors hover:text-white ${FOCUS}`}
            >
              <EditPencil size={13} strokeWidth={1.8} aria-hidden="true" />
              Editar
            </button>
          )}

          {viewerIsCreator && (
            <>
              <button
                type="button"
                onClick={() => void handleCreatorAction(hearted ? "unheart" : "heart")}
                aria-pressed={hearted}
                className={`text-[13px] font-bold transition-colors ${FOCUS} ${hearted ? "text-[#22B16B]" : "text-[#BBBBBB] hover:text-white"}`}
              >
                {hearted ? "Quitar corazón" : "Dar corazón"}
              </button>
              {!isReply && (
                <button
                  type="button"
                  onClick={() => void handleCreatorAction(pinned ? "unpin" : "pin")}
                  aria-pressed={pinned}
                  className={`text-[13px] font-bold text-[#BBBBBB] transition-colors hover:text-white ${FOCUS}`}
                >
                  {pinned ? "Quitar fijado" : "Fijar"}
                </button>
              )}
            </>
          )}

          {isOwn && (
            isConfirmingDelete ? (
              <span className="flex items-center gap-3 text-[13px] font-bold">
                <span className="text-white">¿Eliminar este comentario?</span>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                  className={`text-red-300 hover:underline disabled:opacity-50 ${FOCUS}`}
                >
                  {isDeleting ? "Eliminando…" : "Sí, eliminar"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className={`text-[#BBBBBB] hover:text-white ${FOCUS}`}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className={`flex items-center gap-1.5 text-[13px] font-bold text-[#BBBBBB] transition-colors hover:text-red-300 ${FOCUS}`}
              >
                <Trash size={13} strokeWidth={1.8} aria-hidden="true" />
                Eliminar
              </button>
            )
          )}
        </div>

        {creatorError && (
          <p role="alert" className="mt-3 text-[13px] font-medium text-red-200">{creatorError}</p>
        )}

        {deleteError && (
          <p role="alert" className="mt-3 text-[13px] font-medium text-red-200">{deleteError}</p>
        )}

        {showReplyForm && (
          <div className="mt-4">
            <CommentForm
              peliculaId={peliculaId}
              parentId={effectiveThreadId}
              replyTo={isReply ? { id: comment.id, name: comment.display_name } : undefined}
              placeholder={`Responder a ${comment.display_name}…`}
              compact
              onSubmitted={(reply) => {
                onReplyAdded(effectiveThreadId, reply);
                setShowReplyForm(false);
                setShowReplies(true);
              }}
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}

      </div>

      {replyCount > 0 && !isReply && (
        <div className="col-start-2 flex min-w-0 flex-col gap-4">
          <ThreadItem isLast={!showReplies} elbowY={13}>
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              aria-expanded={showReplies}
              className={`flex min-h-7 items-center gap-1.5 text-[13px] font-bold text-[#22B16B] transition-opacity hover:opacity-80 ${FOCUS}`}
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                className={`transition-transform motion-reduce:transition-none ${showReplies ? "rotate-180" : ""}`}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 8.5L1 3.5h10L6 8.5z" />
              </svg>
              {showReplies ? "Ocultar respuestas" : `${replyCount} respuesta${replyCount !== 1 ? "s" : ""}`}
            </button>
          </ThreadItem>

          {showReplies && replies.slice(0, repliesShown).map((r, index, shown) => (
            <ThreadItem key={r.id} isLast={index === shown.length - 1 && replies.length <= repliesShown} elbowY={16}>
              <CommentCard
                comment={r}
                movieSlug={movieSlug}
                peliculaId={peliculaId}
                currentUserId={currentUserId}
                onReplyAdded={(parentId, reply) => {
                  onReplyAdded(parentId, reply);
                  setShowReplies(true);
                  setRepliesShown((n) => Math.max(n, replyCount + 1));
                }}
                onDeleted={onDeleted}
                onPinChange={onPinChange}
                viewerIsCreator={viewerIsCreator}
                durationSeconds={durationSeconds}
                highlightId={highlightId}
                threadId={comment.id}
                threadNames={names}
              />
            </ThreadItem>
          ))}

          {showReplies && replies.length > repliesShown && (
            <ThreadItem isLast elbowY={13}>
              <button
                type="button"
                onClick={() => setRepliesShown((n) => n + REPLY_PAGE_SIZE)}
                className={`min-h-7 text-[13px] font-bold text-[#22B16B] transition-opacity hover:opacity-80 ${FOCUS}`}
              >
                Mostrar más respuestas
              </button>
            </ThreadItem>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main block ───────────────────────────────────────────────────────────────

export function CommentsBlock({ peliculaId, movieSlug, workType = "cortometraje", durationSeconds = null }: CommentsBlockProps) {
  const isGuest      = useIsGuest();
  const currentUserId = useSupabaseUserId();
  const activeProfileId = useActiveProfileId();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [hasError, setHasError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [sort, setSort] = useState<CommentSort>("top");
  const [highlightId, setHighlightId] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setHasError(false);
    void (async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        const res = await fetch(`/api/comments?peliculaId=${peliculaId}&profileId=${encodeURIComponent(activeProfileId)}`, {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (!isActive) return;
        if (res.ok) setComments(await res.json() as Comment[]);
        else setHasError(true);
      } catch {
        if (isActive) setHasError(true);
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => { isActive = false; };
  }, [peliculaId, reloadKey, activeProfileId]);

  // Enlace permanente (#comentario-42): abre ese comentario, lo muestra y lo resalta un momento.
  useEffect(() => {
    if (loading || comments.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function applyHash() {
      const id = parseCommentHash(window.location.hash);
      if (id === null) return;
      const topLevelIndex = sortThreads(comments, sort).findIndex((c) => c.id === id || (c.replies ?? []).some((r) => r.id === id));
      if (topLevelIndex === -1) return;
      setVisibleCount((n) => Math.max(n, topLevelIndex + 1));
      setHighlightId(id);
      setTimeout(() => document.getElementById(commentAnchorId(id))?.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
      clearTimeout(timer);
      timer = setTimeout(() => setHighlightId(null), 3500);
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => { window.removeEventListener("hashchange", applyHash); clearTimeout(timer); };
    // Solo al terminar de cargar: reordenar o escribir no debe volver a saltar al comentario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function handlePinChange(commentId: number, pinned: boolean) {
    const now = new Date().toISOString();
    setComments((prev) => prev.map((c) => ({ ...c, pinned_at: pinned && c.id === commentId ? now : null })));
  }

  function handleNewComment(comment: Comment) {
    setComments((prev) => [comment, ...prev]);
  }

  function handleReplyAdded(parentId: number, reply: Comment) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies ?? []), reply] }
          : c,
      ),
    );
  }

  function handleDeleted(deleted: Comment) {
    setComments((prev) =>
      deleted.parent_id === null
        ? prev.filter((c) => c.id !== deleted.id)
        : prev.map((c) =>
            c.id === deleted.parent_id
              ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== deleted.id) }
              : c,
          ),
    );
  }

  const sorted = sortThreads(comments, sort);
  const visible = sorted.slice(0, visibleCount);
  const viewerIsCreator = comments.some((c) => c.viewer_is_creator);

  return (
    <section className="mx-auto w-full max-w-[768px]">
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-2">
        {/* El recuento manda: número grande, como en YouTube. */}
        <h2 className="text-[clamp(26px,3vw,36px)] font-extrabold leading-none text-white">
          {comments.length > 0 ? (
            <>
              <span className="tabular-nums">{countComments(comments)}</span>{" "}
              <span className="font-bold">{countComments(comments) === 1 ? "comentario" : "comentarios"}</span>
            </>
          ) : (
            "Comentarios"
          )}
        </h2>
        {comments.length > 1 && <CommentSortControl value={sort} onChange={setSort} />}
      </div>

      {isGuest ? (
        <div className="mb-8">
          <LoginPromptInput />
        </div>
      ) : (
        <CommentForm peliculaId={peliculaId} workType={workType} durationSeconds={durationSeconds} onSubmitted={handleNewComment} />
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Cargando comentarios" className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-[8px] bg-white/5 motion-reduce:animate-none" />
          ))}
        </div>
      ) : hasError ? (
        <div role="alert" className="rounded-[8px] border border-white/10 bg-black/40 backdrop-blur-md px-6 py-8 text-center">
          <p className="text-[16px] font-medium text-white">No se pudieron cargar los comentarios.</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={`mt-4 h-10 rounded-[4px] bg-white/10 px-5 text-[14px] font-bold text-white transition-colors hover:bg-white/20 ${FOCUS}`}
          >
            Reintentar
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="rounded-[8px] border border-white/10 bg-black/40 backdrop-blur-md px-6 py-8 text-center text-[16px] text-[#BBBBBB]">
          Aún no hay comentarios. ¡Sé el primero en comentar!
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              movieSlug={movieSlug}
              peliculaId={peliculaId}
              currentUserId={currentUserId}
              onReplyAdded={handleReplyAdded}
              onDeleted={handleDeleted}
              onPinChange={handlePinChange}
              viewerIsCreator={viewerIsCreator}
              durationSeconds={durationSeconds}
              highlightId={highlightId}
            />
          ))}
          {comments.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className={`mx-auto h-12 rounded-[4px] border-2 border-[#3A3A52] px-6 text-[15px] font-bold text-white transition-colors hover:border-white/70 ${FOCUS}`}
            >
              Ver más comentarios
            </button>
          )}
        </div>
      )}
    </section>
  );
}
