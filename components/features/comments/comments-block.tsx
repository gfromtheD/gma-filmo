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

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Av({ name, color, size = 36 }: { name: string; color: string | null; size?: number }) {
  const bg = avatarBg(name, color);
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-extrabold"
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
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] font-bold transition-colors hover:bg-[#22B16B22]"
      style={{
        background:  "rgba(34,177,107,0.10)",
        color:       "#22B16B",
        fontFamily:  "ui-monospace, 'Cascadia Code', monospace",
      }}
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
  peliculaId: number;
  movieSlug:  string;
  parentId?:  number;
  placeholder?: string;
  onSubmitted: (comment: Comment) => void;
  onCancel?:   () => void;
  compact?:    boolean;
}) {
  const currentUserId = useSupabaseUserId();
  const [content, setContent]           = useState("");
  const [tsInput, setTsInput]           = useState("");
  const [showTs, setShowTs]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tsSeconds = showTs ? parseTimestampInput(tsInput) : null;
  const tsValid   = !showTs || tsInput === "" || tsSeconds !== null;
  const canSubmit = content.trim().length > 0 && tsValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !currentUserId) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      const res = await fetch("/api/comments", {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          peliculaId,
          content:      content.trim(),
          timestampRef: tsSeconds,
          parentId:     parentId ?? null,
        }),
      });
      if (!res.ok) throw new Error("Error al publicar");
      const newComment = await res.json() as Comment;
      onSubmitted(newComment);
      setContent("");
      setTsInput("");
      setShowTs(false);
    } catch {
      // silent — user will retry
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={compact ? "" : "mb-6"}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder ?? "Comparte tu opinión sobre esta obra…"}
        maxLength={1000}
        rows={compact ? 2 : 3}
        className="w-full resize-none rounded-[10px] border border-[#262626] bg-[#0A0A0A] px-4 py-3 text-[13.5px] leading-[1.55] text-white placeholder-[#4A5568] outline-none transition-colors focus:border-[#3A3A3A]"
      />

      <div className="mt-2 flex items-center gap-3 flex-wrap">
        {/* Timestamp toggle */}
        {!parentId && (
          showTs ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[#6D7D94]">⏱</span>
              <input
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="ej. 1:23"
                maxLength={8}
                className="w-20 rounded-[6px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-[12px] font-mono text-white outline-none focus:border-[#22B16B]"
                style={{ fontFamily: "ui-monospace, monospace" }}
              />
              {!tsValid && <span className="text-[11px] text-red-400">Formato: m:ss</span>}
              <button
                type="button"
                onClick={() => { setShowTs(false); setTsInput(""); }}
                className="text-[11px] text-[#4A5568] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setShowTs(true); }}
              className="flex items-center gap-1.5 text-[12px] text-[#4A5568] hover:text-[#6D7D94] transition-colors"
            >
              <span>⏱</span>
              <span>Añadir momento del vídeo</span>
            </button>
          )
        )}

        <div className="flex-1" />

        {/* Char count */}
        <span className="text-[11px] text-[#4A5568]" style={{ fontFamily: "ui-monospace, monospace" }}>
          {content.length} / 1.000
        </span>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#262626] px-3 py-1.5 text-[12.5px] font-semibold text-[#6D7D94] transition-colors hover:border-[#3A3A3A] hover:text-white"
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="rounded-full bg-[#22B16B] px-4 py-1.5 text-[12.5px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Publicando…" : "Publicar"}
        </button>
      </div>
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
}: {
  comment:       Comment;
  movieSlug:     string;
  peliculaId:    number;
  currentUserId: string | null;
  onReplyAdded:  (parentId: number, reply: Comment) => void;
}) {
  const isGuest  = useIsGuest();
  const isOwn    = currentUserId === comment.user_id;
  const [liked,  setLiked]  = useState(comment.liked_by_me);
  const [count,  setCount]  = useState(comment.like_count);
  const [showReplies,  setShowReplies]  = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [reported, setReported] = useState(false);

  async function handleLike() {
    if (!currentUserId || isOwn) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      const res = await fetch("/api/comments/like", {
        method:  "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" },
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
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      await fetch("/api/comments/report", {
        method:  "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ commentId: comment.id }),
      });
      setReported(true);
    } catch { /* silent */ }
  }

  const replies     = comment.replies ?? [];
  const replyCount  = replies.length;
  const isReply     = comment.parent_id !== null;

  return (
    <div className={`flex gap-3 ${isReply ? "" : "rounded-[12px] border border-[#262626] bg-[#0D0D0D] p-4"}`}>
      <Av name={comment.display_name} color={comment.avatar_color} size={isReply ? 28 : 36} />

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[13.5px] font-bold text-white">@{comment.display_name}</span>
          <span className="text-[11.5px] text-[#4A5568]" style={{ fontFamily: "ui-monospace, monospace" }}>
            {timeAgo(comment.created_at)}
          </span>
          {comment.timestamp_ref !== null && (
            <TimestampPill secs={comment.timestamp_ref} movieSlug={movieSlug} />
          )}
        </div>

        {/* Content */}
        <p className="text-[13.5px] leading-[1.6] text-[#D9E2EC]">{comment.content}</p>

        {/* Actions */}
        <div className="mt-2.5 flex items-center gap-4">
          {/* Like */}
          {!isOwn && currentUserId ? (
            <button
              type="button"
              onClick={() => void handleLike()}
              className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
              style={{ color: liked ? "#22B16B" : "#4A5568" }}
            >
              <GmaIcon
                name="heart"
                size={13}
                strokeWidth={liked ? 0 : 1.8}
                style={{ fill: liked ? "#22B16B" : "none" }}
              />
              {count > 0 && <span>{count}</span>}
              <span>De acuerdo</span>
            </button>
          ) : count > 0 ? (
            <span className="flex items-center gap-1.5 text-[12px] text-[#4A5568]">
              <GmaIcon name="heart" size={13} strokeWidth={1.8} />
              <span>{count}</span>
            </span>
          ) : null}

          {/* Reply — only on top-level comments */}
          {!isReply && !isGuest && (
            <button
              type="button"
              onClick={() => setShowReplyForm((v) => !v)}
              className="text-[12px] font-semibold text-[#4A5568] transition-colors hover:text-white"
            >
              ↩ Responder
            </button>
          )}

          {/* Report */}
          {!isOwn && currentUserId && (
            <button
              type="button"
              onClick={() => void handleReport()}
              disabled={reported}
              className="ml-auto text-[11px] text-[#4A5568] transition-colors hover:text-red-400 disabled:opacity-50"
            >
              {reported ? "Denunciado" : "Denunciar"}
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <div className="mt-3 pl-1 border-l-2 border-[#262626]">
            <CommentForm
              peliculaId={peliculaId}
              movieSlug={movieSlug}
              parentId={comment.id}
              placeholder={`Responder a @${comment.display_name}…`}
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

        {/* Replies toggle */}
        {replyCount > 0 && !isReply && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#22B16B] transition-opacity hover:opacity-80"
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                className={`transition-transform ${showReplies ? "rotate-180" : ""}`}
                fill="currentColor"
              >
                <path d="M6 8.5L1 3.5h10L6 8.5z" />
              </svg>
              {showReplies ? "Ocultar" : `${replyCount} respuesta${replyCount !== 1 ? "s" : ""}`}
            </button>

            {showReplies && (
              <div className="mt-3 flex flex-col gap-3 border-l-2 border-[#262626] pl-4">
                {replies.map((r) => (
                  <CommentCard
                    key={r.id}
                    comment={r}
                    movieSlug={movieSlug}
                    peliculaId={peliculaId}
                    currentUserId={currentUserId}
                    onReplyAdded={onReplyAdded}
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

  useEffect(() => {
    void (async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        const res = await fetch(`/api/comments?peliculaId=${peliculaId}`, {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (res.ok) setComments(await res.json() as Comment[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [peliculaId]);

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

  return (
    <section>
      <h2 className="mb-4 text-[20px] font-extrabold tracking-[-0.02em] text-white">
        Comentarios
      </h2>

      {/* Comment form */}
      {isGuest ? (
        <div className="mb-6 rounded-[12px] border border-[#262626] bg-[#0D0D0D] px-5 py-4">
          <LoginPromptInput />
        </div>
      ) : (
        <CommentForm
          peliculaId={peliculaId}
          movieSlug={movieSlug}
          onSubmitted={handleNewComment}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="py-6 text-center text-[13px] text-[#4A5568]">Cargando comentarios…</div>
      ) : comments.length === 0 ? (
        <div className="rounded-[12px] border border-[#262626] bg-[#0D0D0D] px-5 py-8 text-center text-[14px] text-[#4A5568]">
          Aún no hay comentarios. ¡Sé el primero en comentar!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              movieSlug={movieSlug}
              peliculaId={peliculaId}
              currentUserId={currentUserId}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>
      )}
    </section>
  );
}
