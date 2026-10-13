"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useIsGuest } from "@/hooks/use-is-guest";
import { LoginPromptInput } from "@/components/features/ratings/login-prompt-input";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  id:            number;
  pelicula_id:   number;
  user_id:       string;
  display_name:  string;
  avatar_color:  string | null;
  parent_id:     number | null;
  content:       string;
  timestamp_ref: number | null;
  like_count:    number;
  liked_by_me:   boolean;
  created_at:    string;
  replies:       Comment[];
}

interface CommentsBlockProps {
  readonly peliculaId: number;
  readonly movieSlug:  string;
}

/** Comentarios principales que se muestran de una vez. */
const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_COLORS = ["#22B16B", "#E5654B", "#C28BE6", "#5B8FB0", "#E8C672"] as const;

function avatarBg(name: string, color: string | null) {
  return color ?? FALLBACK_COLORS[name.length % FALLBACK_COLORS.length];
}

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

function fmtTimestamp(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function parseTimestampInput(val: string): number | null {
  const clean = val.trim();
  const parts = clean.split(":").map(Number);
  if (parts.some((p) => isNaN(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" };
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Av({ name, color, size = 45 }: { name: string; color: string | null; size?: number }) {
  const bg = avatarBg(name, color);
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: bg + "33", color: bg }}
    >
      {name[0]?.toUpperCase() ?? "U"}
    </div>
  );
}

// ─── Timestamp pill ───────────────────────────────────────────────────────────

function TimestampPill({ secs, movieSlug }: { secs: number; movieSlug: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/ver/${movieSlug}?t=${secs}`)}
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-bold text-[#22B16B] transition-colors hover:bg-[#22B16B]/20 ${FOCUS}`}
      style={{ background: "rgba(34,177,107,0.10)", fontFamily: "ui-monospace, 'Cascadia Code', monospace" }}
      title={`Ir al minuto ${fmtTimestamp(secs)}`}
    >
      <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor" aria-hidden>
        <path d="M1 1.5v7l6.5-3.5L1 1.5z" />
      </svg>
      {fmtTimestamp(secs)}
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
}: {
  peliculaId:   number;
  parentId?:    number;
  placeholder?: string;
  onSubmitted:  (comment: Comment) => void;
  onCancel?:    () => void;
  compact?:     boolean;
}) {
  const currentUserId = useSupabaseUserId();
  const [content, setContent]       = useState("");
  const [tsInput, setTsInput]       = useState("");
  const [showTs, setShowTs]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tsSeconds = showTs ? parseTimestampInput(tsInput) : null;
  const tsValid   = !showTs || tsInput === "" || tsSeconds !== null;
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
        }),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Estás comentando demasiado rápido. Espera un momento e inténtalo de nuevo."
            : "No se pudo publicar tu comentario. Inténtalo de nuevo.",
        );
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
        className="w-full resize-y rounded-[8px] border-2 border-[#3A3A52] bg-[#242432] px-4 py-3 text-[16px] leading-[1.5] text-white placeholder-[#8C8CA5] outline-none transition-colors focus:border-[#22B16B] disabled:opacity-60"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!parentId && (
          showTs ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#B8B8CC]">⏱</span>
              <input
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="ej. 1:23"
                aria-label="Momento del vídeo (minutos:segundos)"
                maxLength={8}
                className="w-20 rounded-[6px] border border-[#3A3A52] bg-[#242432] px-2 py-1 text-[13px] text-white outline-none focus:border-[#22B16B]"
                style={{ fontFamily: "ui-monospace, monospace" }}
              />
              {!tsValid && <span className="text-[12px] text-red-300">Formato: m:ss</span>}
              <button
                type="button"
                onClick={() => { setShowTs(false); setTsInput(""); }}
                aria-label="Quitar el momento del vídeo"
                className={`text-[12px] text-[#B8B8CC] transition-colors hover:text-white ${FOCUS}`}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowTs(true)}
              className={`flex items-center gap-1.5 text-[13px] text-[#B8B8CC] transition-colors hover:text-white ${FOCUS}`}
            >
              <span aria-hidden="true">⏱</span>
              <span>Añadir momento del vídeo</span>
            </button>
          )
        )}

        <div className="flex-1" />

        <span className="text-[12px] text-[#B8B8CC]" aria-live="polite">
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

// ─── Single comment card ──────────────────────────────────────────────────────

function CommentCard({
  comment,
  movieSlug,
  peliculaId,
  currentUserId,
  onReplyAdded,
  onDeleted,
}: {
  comment:       Comment;
  movieSlug:     string;
  peliculaId:    number;
  currentUserId: string | null;
  onReplyAdded:  (parentId: number, reply: Comment) => void;
  onDeleted:     (comment: Comment) => void;
}) {
  const isGuest  = useIsGuest();
  const isOwn    = currentUserId === comment.user_id;
  const [liked,  setLiked]  = useState(comment.liked_by_me);
  const [count,  setCount]  = useState(comment.like_count);
  const [showReplies,  setShowReplies]  = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [reported, setReported] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLike() {
    if (!currentUserId || isOwn) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    try {
      const res = await fetch("/api/comments/like", {
        method:  "POST",
        headers: await authHeaders(),
        body:    JSON.stringify({ commentId: comment.id }),
      });
      if (!res.ok) { setLiked(liked); setCount(comment.like_count); }
    } catch {
      setLiked(liked);
      setCount(comment.like_count);
    }
  }

  async function handleReport() {
    if (!currentUserId || reported) return;
    try {
      await fetch("/api/comments/report", {
        method:  "POST",
        headers: await authHeaders(),
        body:    JSON.stringify({ commentId: comment.id }),
      });
      setReported(true);
    } catch { /* silent */ }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/comments", {
        method:  "DELETE",
        headers: await authHeaders(),
        body:    JSON.stringify({ commentId: comment.id }),
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

  return (
    <div className={`flex gap-3 ${isReply ? "" : "rounded-[8px] bg-[#242432] p-4 sm:p-6"}`}>
      <Av name={comment.display_name} color={comment.avatar_color} size={isReply ? 32 : 45} />

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[14px] font-bold text-white">{comment.display_name}</span>
          {isOwn && <span className="text-[12px] font-bold uppercase text-[#22B16B]">Tú</span>}
          <time dateTime={comment.created_at} className="text-[13px] font-bold uppercase text-[#B8B8CC]">
            {timeAgo(comment.created_at)}
          </time>
          {comment.timestamp_ref !== null && (
            <TimestampPill secs={comment.timestamp_ref} movieSlug={movieSlug} />
          )}
        </div>

        <p className="whitespace-pre-line break-words text-[16px] leading-[1.5] text-white">{comment.content}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {!isOwn && currentUserId ? (
            <button
              type="button"
              onClick={() => void handleLike()}
              aria-pressed={liked}
              className={`flex items-center gap-1.5 text-[13px] font-bold transition-colors ${FOCUS} ${liked ? "text-[#22B16B]" : "text-[#B8B8CC] hover:text-white"}`}
            >
              <GmaIcon name="heart" size={14} strokeWidth={liked ? 0 : 1.8} style={{ fill: liked ? "#22B16B" : "none" }} />
              {count > 0 && <span>{count}</span>}
              <span>De acuerdo</span>
            </button>
          ) : count > 0 ? (
            <span className="flex items-center gap-1.5 text-[13px] text-[#B8B8CC]">
              <GmaIcon name="heart" size={14} strokeWidth={1.8} />
              <span>{count}</span>
            </span>
          ) : null}

          {!isReply && !isGuest && (
            <button
              type="button"
              onClick={() => setShowReplyForm((v) => !v)}
              aria-expanded={showReplyForm}
              className={`text-[13px] font-bold text-[#B8B8CC] transition-colors hover:text-white ${FOCUS}`}
            >
              ↩ Responder
            </button>
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
                  className={`text-[#B8B8CC] hover:text-white ${FOCUS}`}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className={`text-[13px] font-bold text-[#B8B8CC] transition-colors hover:text-red-300 ${FOCUS}`}
              >
                Eliminar
              </button>
            )
          )}

          {!isOwn && currentUserId && (
            <button
              type="button"
              onClick={() => void handleReport()}
              disabled={reported}
              className={`ml-auto text-[12px] text-[#B8B8CC] transition-colors hover:text-red-300 disabled:opacity-60 ${FOCUS}`}
            >
              {reported ? "Denunciado" : "Denunciar"}
            </button>
          )}
        </div>

        {deleteError && (
          <p role="alert" className="mt-3 text-[13px] font-medium text-red-200">{deleteError}</p>
        )}

        {showReplyForm && (
          <div className="mt-4 border-l-2 border-[#3A3A52] pl-4">
            <CommentForm
              peliculaId={peliculaId}
              parentId={comment.id}
              placeholder={`Responder a ${comment.display_name}…`}
              compact
              onSubmitted={(reply) => {
                onReplyAdded(comment.id, reply);
                setShowReplyForm(false);
                setShowReplies(true);
              }}
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}

        {replyCount > 0 && !isReply && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              aria-expanded={showReplies}
              className={`flex items-center gap-1.5 text-[13px] font-bold text-[#22B16B] transition-opacity hover:opacity-80 ${FOCUS}`}
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                className={`transition-transform motion-reduce:transition-none ${showReplies ? "rotate-180" : ""}`}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 8.5L1 3.5h10L6 8.5z" />
              </svg>
              {showReplies ? "Ocultar" : `${replyCount} respuesta${replyCount !== 1 ? "s" : ""}`}
            </button>

            {showReplies && (
              <div className="mt-3 flex flex-col gap-4 border-l-2 border-[#3A3A52] pl-4">
                {replies.map((r) => (
                  <CommentCard
                    key={r.id}
                    comment={r}
                    movieSlug={movieSlug}
                    peliculaId={peliculaId}
                    currentUserId={currentUserId}
                    onReplyAdded={onReplyAdded}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main block ───────────────────────────────────────────────────────────────

export function CommentsBlock({ peliculaId, movieSlug }: CommentsBlockProps) {
  const isGuest      = useIsGuest();
  const currentUserId = useSupabaseUserId();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [hasError, setHasError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setHasError(false);
    void (async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        const res = await fetch(`/api/comments?peliculaId=${peliculaId}`, {
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
  }, [peliculaId, reloadKey]);

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

  const visible = comments.slice(0, visibleCount);

  return (
    <section className="mx-auto w-full max-w-[768px]">
      <h2 className="mb-5 text-[clamp(22px,2.4vw,32px)] font-bold text-white">
        Comentarios{comments.length > 0 ? <span className="ml-2 text-[18px] font-medium text-[#B8B8CC]">({comments.length})</span> : null}
      </h2>

      {isGuest ? (
        <div className="mb-8">
          <LoginPromptInput />
        </div>
      ) : (
        <CommentForm peliculaId={peliculaId} onSubmitted={handleNewComment} />
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Cargando comentarios" className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-[8px] bg-[#242432] motion-reduce:animate-none" />
          ))}
        </div>
      ) : hasError ? (
        <div role="alert" className="rounded-[8px] bg-[#242432] px-6 py-8 text-center">
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
        <p className="rounded-[8px] bg-[#242432] px-6 py-8 text-center text-[16px] text-[#B8B8CC]">
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
