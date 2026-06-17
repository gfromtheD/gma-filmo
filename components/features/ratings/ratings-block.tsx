"use client";

import { useState, useEffect, useRef } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useIsGuest } from "@/hooks/use-is-guest";
import { LoginPromptInput } from "./login-prompt-input";
import { useRatings } from "@/hooks/use-ratings";
import { useCommunityRatings, type CommunityReview } from "@/hooks/use-community-ratings";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const FALLBACK_COLORS = ["#22B16B", "#E5654B", "#C28BE6", "#5B8FB0", "#E8C672"] as const;

interface RatingsBlockProps {
  readonly title:     string;
  readonly numericId: number;
  readonly autoOpen?: boolean;
}

export function RatingsBlock({ title, numericId, autoOpen }: RatingsBlockProps) {
  const { getRating, setRating } = useRatings();
  const currentUserId = useSupabaseUserId();
  const isGuest = useIsGuest();
  const existingEntry = getRating(numericId);
  const savedScore = existingEntry ? Math.round(existingEntry.rating * 2) : null;

  const [modalOpen, setModalOpen]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const { reviews, avgScore, voteCount, loading } = useCommunityRatings(numericId, refreshKey);

  useEffect(() => {
    if (!autoOpen) return;
    // Give the page a moment to finish painting before scrolling + opening
    const id = setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setModalOpen(true);
    }, 350);
    return () => clearTimeout(id);
  }, [autoOpen]);

  return (
    <>
      <section ref={sectionRef}>
        <h2 className="mb-4 text-[20px] font-extrabold tracking-[-0.02em] text-white">
          Valoraciones
        </h2>

        {/* Score row */}
        <div className="mb-5 flex items-center gap-7 rounded-[12px] border border-[#262626] bg-[#0D0D0D] p-5">
          <div className="shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[52px] leading-none text-[#22B16B]"
                style={{
                  fontFamily: '"Georgia", "Times New Roman", serif',
                  fontStyle: "italic",
                  letterSpacing: "-0.02em",
                }}
              >
                {loading ? "—" : avgScore !== null ? String(avgScore).replace(".", ",") : "—"}
              </span>
              <span className="text-[18px] text-[#6D7D94]">/10</span>
            </div>
            <div className="mt-1.5 text-[12.5px] text-[#6D7D94]">
              <span className="font-mono text-white">{loading ? "…" : voteCount}</span> votos
            </div>
          </div>

          <span className="h-14 w-px shrink-0 bg-[#262626]" />

          <div className="flex-1">
            <div className="text-[14px] text-[#6D7D94]">Tu valoración</div>
            <div className="mt-1 text-[16px] text-white">
              {savedScore !== null ? (
                <span>
                  <span className="font-bold text-[#22B16B]">{savedScore}/10</span>
                  {" — ya has valorado."}
                </span>
              ) : (
                "No has valorado todavía."
              )}
            </div>
          </div>

          {isGuest ? (
            <LoginPromptInput />
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A]"
            >
              <GmaIcon name="star" size={14} strokeWidth={2} />
              {savedScore !== null ? "Editar nota" : "Valorar"}
            </button>
          )}
        </div>

        {/* Reviews header */}
        <h3 className="mb-4 text-[16px] font-extrabold tracking-[-0.01em] text-white">
          Valoraciones de usuarios
        </h3>

        {loading ? (
          <div className="py-6 text-center text-[13px] text-[#4A5568]">Cargando valoraciones…</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-[12px] border border-[#262626] bg-[#0D0D0D] px-5 py-8 text-center text-[14px] text-[#4A5568]">
            Aún no hay comentarios. ¡Sé el primero en valorar!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <ReviewCard
                key={r.userId + r.ratedAt}
                review={r}
                peliculaId={numericId}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <RatingModal
          title={title}
          initialScore={savedScore}
          initialComment={existingEntry?.review ?? ""}
          onClose={() => setModalOpen(false)}
          onSubmit={(score, comment) => {
            setRating(numericId, score / 2, comment);
            setRefreshKey((k) => k + 1);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

function ReviewAvatar({ displayName, avatarUrl, avatarColor }: { displayName: string; avatarUrl: string | null; avatarColor: string | null }) {
  const fallback = FALLBACK_COLORS[displayName.length % FALLBACK_COLORS.length];
  const bg = avatarColor ?? fallback;
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
      style={{ background: bg + "33", color: bg }}
    >
      {displayName[0]?.toUpperCase() ?? "U"}
    </div>
  );
}

function ReviewCard({
  review,
  peliculaId,
  currentUserId,
}: {
  review: CommunityReview;
  peliculaId: number;
  currentUserId: string | null;
}) {
  const { userId, displayName, avatarUrl, avatarColor, score, comment, ratedAt } = review;
  const [liked, setLiked] = useState(review.likedByMe);
  const [count, setCount] = useState(review.likeCount);

  const isHighScore = score >= 8;
  const isOwn       = currentUserId === userId;
  const date        = new Date(ratedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  async function handleLike() {
    if (!currentUserId || isOwn) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));

    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) { setLiked(liked); setCount(count); return; }

      const res = await fetch("/api/ratings/community/like", {
        method:  "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ reviewerUserId: userId, peliculaId }),
      });
      if (!res.ok) { setLiked(liked); setCount(count); }
    } catch {
      setLiked(liked);
      setCount(count);
    }
  }

  return (
    <div className="flex gap-4 rounded-[12px] border border-[#262626] bg-[#0D0D0D] p-5">
      <ReviewAvatar displayName={displayName} avatarUrl={avatarUrl} avatarColor={avatarColor} />

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline gap-2.5">
          <span className="text-[14px] font-bold text-white">@{displayName}</span>
          <span
            className="rounded px-2 py-0.5 text-[11.5px] font-bold"
            style={{
              fontFamily: "ui-monospace, 'Cascadia Code', monospace",
              background: isHighScore ? "rgba(34,177,107,0.12)" : "rgba(255,255,255,0.06)",
              color:      isHighScore ? "#22B16B"                : "#6D7D94",
            }}
          >
            {score}/10
          </span>
          <span
            className="text-[11.5px] text-[#4A5568]"
            style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace" }}
          >
            {date}
          </span>
        </div>
        <p className="text-[14px] leading-[1.55] text-[#D9E2EC]">{comment}</p>

        {/* Like button */}
        {!isOwn && currentUserId && (
          <button
            type="button"
            onClick={() => void handleLike()}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
            style={{ color: liked ? "#22B16B" : "#4A5568" }}
          >
            <GmaIcon
              name="heart"
              size={13}
              strokeWidth={liked ? 0 : 1.8}
              style={{ fill: liked ? "#22B16B" : "none" }}
            />
            {count > 0 && <span>{count}</span>}
            <span>{liked ? "De acuerdo" : "De acuerdo"}</span>
          </button>
        )}
        {isOwn && count > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#4A5568]">
            <GmaIcon name="heart" size={13} strokeWidth={1.8} />
            <span>{count} {count === 1 ? "persona" : "personas"} de acuerdo</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingModal({
  title,
  initialScore,
  initialComment = "",
  onClose,
  onSubmit,
}: {
  title: string;
  initialScore: number | null;
  initialComment?: string;
  onClose: () => void;
  onSubmit: (score: number, comment: string) => void;
}) {
  const [score, setScore]     = useState<number | null>(initialScore);
  const [comment, setComment] = useState(initialComment);
  const [withProfile, setWithProfile] = useState(true);

  const SCALE_HINTS = [
    "1 — Horrible",
    "5 — Mediocre",
    "10 — Imprescindible",
  ];

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{ background: "rgba(5,8,16,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[600px] overflow-hidden rounded-[14px] border border-[#262626] shadow-2xl"
        style={{ background: "#0D0D0D" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#262626] px-6 py-5">
          <GmaIcon name="star" size={20} className="text-[#22B16B]" />
          <span className="text-[16px] font-bold text-white">
            Valorar &ldquo;{title}&rdquo;
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6D7D94] transition-colors hover:bg-[#1A1A1A] hover:text-white"
          >
            <GmaIcon name="close" size={16} />
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="mb-4 text-[13px] text-[#6D7D94]">Tu puntuación</p>

          {/* 1–10 number grid */}
          <div className="relative mb-2 flex gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = score !== null && n <= score;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className="relative flex flex-1 items-center justify-center rounded-[8px] border py-3 text-[15px] font-bold transition-colors"
                  style={{
                    fontFamily:  "ui-monospace, 'Cascadia Code', monospace",
                    background:  active ? "rgba(34,177,107,0.10)" : "rgba(255,255,255,0.04)",
                    borderColor: active ? "#22B16B"                : "#262626",
                    color:       active ? "#22B16B"                : "#6D7D94",
                  }}
                >
                  {n}
                  {score === n && (
                    <span
                      className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#22B16B]"
                      style={{ fontFamily: "ui-monospace, monospace" }}
                    >
                      Nota
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="mb-6 mt-1 flex justify-between text-[11px] uppercase tracking-[0.06em] text-[#4A5568]"
            style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace" }}
          >
            {SCALE_HINTS.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>

          {/* Comment */}
          <p className="mb-2 text-[13px] text-[#6D7D94]">
            Comentario{" "}
            <span className="text-[#4A5568]">(opcional)</span>
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder="Escribe tu opinión sobre este título..."
            rows={4}
            className="w-full resize-none rounded-[10px] border border-[#262626] bg-[#0A0A0A] px-4 py-3 text-[14px] leading-[1.55] text-white placeholder-[#4A5568] outline-none transition-colors focus:border-[#3A3A3A]"
          />

          <div className="mt-2 flex items-center justify-between">
            <span
              className="text-[11.5px] text-[#4A5568]"
              style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace" }}
            >
              {comment.length} / 1.000 caracteres
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#6D7D94]">
              <span
                role="checkbox"
                aria-checked={withProfile}
                tabIndex={0}
                onClick={() => setWithProfile((v) => !v)}
                onKeyDown={(e) => e.key === " " && setWithProfile((v) => !v)}
                className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                  withProfile
                    ? "border-[#22B16B] bg-[#22B16B]"
                    : "border-[#262626] bg-transparent"
                }`}
              >
                {withProfile && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                    <path d="M1 4l2.5 2.5L9 1" stroke="#051910" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              Publicar con mi perfil
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-[#262626] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#262626] px-4 py-2 text-[13px] font-semibold text-[#6D7D94] transition-colors hover:border-[#3A3A3A] hover:text-white"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => score !== null && onSubmit(score, comment.trim())}
            disabled={score === null}
            className="rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {comment.trim() ? "Publicar valoración" : "Guardar nota"}
          </button>
        </div>
      </div>
    </div>
  );
}
