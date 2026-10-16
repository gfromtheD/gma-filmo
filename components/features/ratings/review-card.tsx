"use client";

import { useState, type ReactNode } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { formatReviewDate, scoreLabel } from "@/lib/ratings/score-format";
import { ProfileAvatar } from "@/components/ui/profile-avatar";

/** A partir de esta longitud el comentario se recorta con "Leer más". */
const LONG_COMMENT_CHARS = 280;

export interface ReviewCardData {
  readonly displayName: string;
  readonly avatarUrl: string | null;
  /** Icono del catálogo cuando el perfil elige uno en vez de una foto. */
  readonly avatarIconId?: string | null;
  readonly avatarColor: string | null;
  readonly score: number;
  readonly comment: string;
  readonly ratedAt: string;
  readonly likeCount: number;
  readonly likedByMe: boolean;
}

interface ReviewCardProps {
  readonly review: ReviewCardData;
  /** Es la valoración del usuario actual (se destaca y no se puede "estar de acuerdo" con uno mismo). */
  readonly isOwn?: boolean;
  /** Si se omite, no se muestra el botón "De acuerdo". Debe devolver `true` si se guardó. */
  readonly onToggleLike?: () => Promise<boolean>;
  /** Acciones propias (editar, quitar…). */
  readonly actions?: ReactNode;
}

/**
 * Tarjeta de valoración: avatar y nombre, nota con su etiqueta, comentario y fecha.
 * Presentacional; el guardado del "De acuerdo" lo hace el contenedor.
 */
export function ReviewCard({ review, isOwn = false, onToggleLike, actions }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [liked, setLiked] = useState(review.likedByMe);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [isLiking, setIsLiking] = useState(false);

  const isLong = review.comment.length > LONG_COMMENT_CHARS;
  const label = scoreLabel(review.score);

  async function handleLike() {
    if (!onToggleLike || isLiking) return;
    const next = !liked;
    setIsLiking(true);
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const saved = await onToggleLike();
    if (!saved) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
    setIsLiking(false);
  }

  return (
    <article
      className={`w-full rounded-[8px] border border-white/10 bg-black/40 backdrop-blur-md p-4 sm:p-6 ${isOwn ? "ring-1 ring-[#22B16B]/60" : ""}`}
      aria-label={`Valoración de ${review.displayName}: ${review.score} sobre 10`}
    >
      <header className="flex items-center gap-3">
        <ProfileAvatar name={review.displayName} url={review.avatarUrl} iconId={review.avatarIconId} color={review.avatarColor} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-white">{review.displayName}</p>
          {isOwn && <p className="text-[12px] font-bold uppercase text-[#22B16B]">Tu valoración</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-7 min-w-8 items-center justify-center border border-white px-1.5 text-[13px] font-extrabold leading-none text-white">
            {review.score}
          </span>
          {label && <span className="hidden text-[14px] font-bold text-white sm:inline">{label}</span>}
        </div>
      </header>

      {review.comment && (
        <div className="mt-4">
          <p
            className={`whitespace-pre-line break-words text-[16px] leading-[1.5] text-white ${
              isLong && !isExpanded ? "line-clamp-4" : ""
            }`}
          >
            {review.comment}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              className="mt-2 text-[14px] font-bold text-[#22B16B] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isExpanded ? "Leer menos" : "Leer más"}
            </button>
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <time dateTime={review.ratedAt} className="text-[13px] font-bold uppercase text-[#BBBBBB]">
          {formatReviewDate(review.ratedAt)}
        </time>
        <div className="ml-auto flex items-center gap-4">
          {actions}
          {onToggleLike && !isOwn ? (
            <button
              type="button"
              onClick={() => void handleLike()}
              aria-pressed={liked}
              disabled={isLiking}
              className={`flex items-center gap-1.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                liked ? "text-[#22B16B]" : "text-[#BBBBBB] hover:text-white"
              }`}
            >
              <GmaIcon name="heart" size={14} strokeWidth={liked ? 0 : 1.8} style={{ fill: liked ? "#22B16B" : "none" }} />
              {likeCount > 0 && <span>{likeCount}</span>}
              <span>De acuerdo</span>
            </button>
          ) : (
            likeCount > 0 && (
              <span className="flex items-center gap-1.5 text-[13px] text-[#BBBBBB]">
                <GmaIcon name="heart" size={14} strokeWidth={1.8} />
                {likeCount} {likeCount === 1 ? "persona de acuerdo" : "personas de acuerdo"}
              </span>
            )
          )}
        </div>
      </footer>
    </article>
  );
}
