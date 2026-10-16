"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoginPromptInput } from "@/components/features/ratings/login-prompt-input";
import { RatingForm } from "@/components/features/ratings/rating-form";
import { ReviewCard } from "@/components/features/ratings/review-card";
import { useIsGuest } from "@/hooks/use-is-guest";
import { useRatings } from "@/hooks/use-ratings";
import { useCommunityRatings, type CommunityReview } from "@/hooks/use-community-ratings";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { starsToScore } from "@/lib/ratings/score-format";
import type { ReviewSort } from "@/lib/ratings/review-query";

/** Reseñas que se cargan por página. */
const PAGE_SIZE = 10;
/** Tiempo de cortesía antes de hacer scroll/abrir al llegar con ?valorar=1. */
const AUTO_OPEN_DELAY_MS = 350;

const SORT_OPTIONS: readonly { readonly id: ReviewSort; readonly label: string }[] = [
  { id: "top", label: "Más votadas" },
  { id: "recent", label: "Más recientes" },
];

interface RatingsBlockProps {
  readonly title:     string;
  readonly numericId: number;
  readonly autoOpen?: boolean;
  /** Se llama cuando el usuario guarda o quita su valoración (para refrescar la nota de la ficha). */
  readonly onChange?: () => void;
}

type SaveState = { readonly status: "idle" | "saving" } | { readonly status: "error"; readonly message: string };

export function RatingsBlock({ title, numericId, autoOpen, onChange }: RatingsBlockProps) {
  const isGuest = useIsGuest();
  const currentUserId = useSupabaseUserId();
  // El perfil activo del selector (foto o icono, color y nombre), el mismo con el que se guarda la valoración.
  const { displayName, avatarColor, avatarImageUrl, avatarIconId } = useActiveProfileDisplay();
  const activeProfileId = useActiveProfileId();
  const { getRating, setRating, removeRating } = useRatings();
  const existingEntry = getRating(numericId);
  const liveExisting = existingEntry
    ? { score: starsToScore(existingEntry.rating), comment: existingEntry.review, ratedAt: existingEntry.ratedAt }
    : null;
  // Mientras se quita la valoración la entrada local desaparece al instante; esta copia
  // mantiene la tarjeta visible (y evita que asome el formulario) hasta saber el resultado.
  const lastExisting = useRef(liveExisting);
  if (liveExisting) lastExisting.current = liveExisting;
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const existing = liveExisting ?? (isRemoving ? lastExisting.current : null);

  const [sort, setSort] = useState<ReviewSort>("top");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const sectionRef = useRef<HTMLElement>(null);
  const didAutoOpen = useRef(false);

  const { reviews, total, hasMore, loading, loadingMore, hasError, loadMore } = useCommunityRatings(
    numericId,
    refreshKey,
    { pageSize: PAGE_SIZE, sort },
  );

  // Llegar con ?valorar=1: llevar al formulario...
  useEffect(() => {
    if (!autoOpen) return;
    const id = setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(id);
  }, [autoOpen]);

  // ...y, si el usuario ya había valorado (sus valoraciones cargan después), abrir la edición una vez.
  const hasExisting = liveExisting !== null;
  useEffect(() => {
    if (autoOpen && hasExisting && !didAutoOpen.current) {
      didAutoOpen.current = true;
      setIsEditing(true);
    }
  }, [autoOpen, hasExisting]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    onChange?.();
  }, [onChange]);

  async function handleSubmit(score: number, comment: string) {
    setSave({ status: "saving" });
    const saved = await setRating(numericId, score / 2, comment);
    if (!saved) {
      setSave({ status: "error", message: "No se pudo guardar tu valoración. Comprueba tu conexión e inténtalo de nuevo." });
      return;
    }
    setSave({ status: "idle" });
    setIsEditing(false);
    refresh();
  }

  async function handleRemove() {
    setRemoveError(null);
    setIsRemoving(true);
    const removed = await removeRating(numericId);
    setIsRemoving(false);
    setIsConfirmingRemove(false);
    if (!removed) {
      setRemoveError("No se pudo quitar tu valoración. Inténtalo de nuevo.");
      return;
    }
    setIsEditing(false);
    refresh();
  }

  const toggleLike = useCallback(
    async (review: CommunityReview): Promise<boolean> => {
      if (!currentUserId) return false;
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!session?.access_token) return false;
        const res = await fetch("/api/ratings/community/like", {
          method:  "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ reviewerUserId: review.userId, peliculaId: numericId }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [currentUserId, numericId],
  );

  // La valoración del perfil activo se fija arriba (aunque no esté entre las primeras de la lista).
  // Las de otros perfiles de la misma cuenta se muestran como propias, sin "De acuerdo".
  const isActiveProfileReview = (r: CommunityReview) =>
    r.userId === currentUserId && (r.profileId ?? "") === activeProfileId;
  const others = existing ? reviews.filter((r) => !isActiveProfileReview(r)) : reviews;
  const isSaving = save.status === "saving";
  // El formulario no se desmonta mientras se guarda o hay un error: así no se pierde lo escrito.
  const showForm = !isGuest && !isRemoving && (existing === null || isEditing || save.status !== "idle");

  return (
    <section ref={sectionRef} className="flex flex-col gap-10">
      {isGuest ? (
        <div className="mx-auto w-full max-w-[768px]">
          <h2 className="mb-4 text-[clamp(22px,2.4vw,32px)] font-bold text-white">Valoraciones</h2>
          <LoginPromptInput />
        </div>
      ) : showForm ? (
        <RatingForm
          key="rating-form"
          title={title}
          initial={existing ? { score: existing.score, comment: existing.comment } : null}
          isSaving={isSaving}
          errorMessage={save.status === "error" ? save.message : null}
          onSubmit={(score, comment) => void handleSubmit(score, comment)}
          onCancel={existing ? () => { setIsEditing(false); setSave({ status: "idle" }); } : undefined}
          shouldFocus={Boolean(autoOpen)}
        />
      ) : null}

      {/* Tu valoración, fijada arriba con sus acciones */}
      {existing && !isEditing && !isGuest && (
        <div className="mx-auto w-full max-w-[768px]">
          <ReviewCard
            isOwn
            review={{
              displayName: displayName || "Tú",
              avatarUrl:   avatarImageUrl || null,
              avatarIconId: avatarIconId || null,
              avatarColor: avatarColor || null,
              score:       existing.score,
              comment:     existing.comment,
              ratedAt:     new Date(existing.ratedAt).toISOString(),
              likeCount:   reviews.find((r) => r.userId === currentUserId)?.likeCount ?? 0,
              likedByMe:   false,
            }}
            actions={
              isConfirmingRemove ? (
                <span className="flex items-center gap-3 text-[13px] font-bold">
                  <span className="text-white">¿Quitar tu valoración?</span>
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    disabled={isRemoving}
                    className="text-red-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                  >
                    {isRemoving ? "Quitando…" : "Sí, quitar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingRemove(false)}
                    className="text-[#BBBBBB] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    No
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-4 text-[13px] font-bold">
                  <button
                    type="button"
                    onClick={() => { setSave({ status: "idle" }); setRemoveError(null); setIsEditing(true); }}
                    className="text-white hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {existing.comment ? "Editar" : "Añadir comentario"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingRemove(true)}
                    className="text-[#BBBBBB] hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Quitar
                  </button>
                </span>
              )
            }
          />
          {removeError && (
            <p role="alert" className="mt-3 rounded-[6px] border border-red-400/40 bg-red-500/10 px-4 py-3 text-[14px] font-medium text-red-200">
              {removeError}
            </p>
          )}
        </div>
      )}

      {/* Valoraciones de otros usuarios */}
      <div className="mx-auto flex w-full max-w-[768px] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[20px] font-bold text-white">
            Valoraciones de usuarios{total > 0 ? <span className="ml-2 text-[16px] font-medium text-[#BBBBBB]">({total})</span> : null}
          </h3>
          {total > 1 && (
            <div role="group" aria-label="Ordenar valoraciones" className="flex gap-1 rounded-[6px] border border-white/10 bg-black/40 p-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={sort === option.id}
                  onClick={() => setSort(option.id)}
                  className={`h-8 rounded-[4px] px-3 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    sort === option.id ? "bg-white/15 text-white" : "text-[#BBBBBB] hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Cargando valoraciones" className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-[8px] bg-white/5 motion-reduce:animate-none" />
            ))}
          </div>
        ) : hasError && reviews.length === 0 ? (
          <div role="alert" className="rounded-[8px] border border-white/10 bg-black/40 backdrop-blur-md px-6 py-8 text-center">
            <p className="text-[16px] font-medium text-white">No se pudieron cargar las valoraciones.</p>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="mt-4 h-10 rounded-[4px] bg-white/10 px-5 text-[14px] font-bold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Reintentar
            </button>
          </div>
        ) : others.length === 0 && !existing ? (
          <p className="rounded-[8px] border border-white/10 bg-black/40 backdrop-blur-md px-6 py-8 text-center text-[16px] text-[#BBBBBB]">
            Aún no hay valoraciones con comentario. ¡Sé el primero en opinar!
          </p>
        ) : (
          <>
            {others.map((review) => {
              const isMine = review.userId === currentUserId;
              return (
                <ReviewCard
                  // La clave incluye los "De acuerdo": al refrescar se reinicia el estado local de la tarjeta.
                  key={`${review.userId}-${review.profileId ?? ""}-${review.ratedAt}-${review.likeCount}-${review.likedByMe}`}
                  review={review}
                  isOwn={isMine}
                  onToggleLike={currentUserId && !isMine ? () => toggleLike(review) : undefined}
                />
              );
            })}
            {hasMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mx-auto h-12 rounded-[4px] border-2 border-[#3A3A52] px-6 text-[15px] font-bold text-white transition-colors hover:border-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
              >
                {loadingMore ? "Cargando…" : "Ver más valoraciones"}
              </button>
            )}
            {hasError && reviews.length > 0 && (
              <p role="alert" className="text-center text-[14px] text-red-200">
                No se pudieron cargar más valoraciones. Inténtalo de nuevo.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
