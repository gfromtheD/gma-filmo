"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Xmark as X } from "@/components/ui/icons";
import { MAX_COMMENT_CHARS } from "@/components/features/ratings/rating-form";
import { ScoreScale } from "@/components/features/ratings/score-scale";
import { starsToScore } from "@/lib/ratings/score-format";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { lockPageScroll } from "@/lib/scroll-lock";
import type { RatingEntry } from "@/hooks/use-ratings";
import type { MovieMedia } from "@/types/catalog";

// Estrellas y modal de valoración de Mi lista.

const STAR_PATH =
  "M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z";


// ─── Stars (shared) ───────────────────────────────────────────────────────────

function StarGlyph({ fill, size }: { fill: number; size: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d={STAR_PATH} fill="#2C4334" />
      </svg>
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${Math.min(1, Math.max(0, fill)) * 100}%` }}>
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path d={STAR_PATH} fill="#22B16B" />
        </svg>
      </div>
    </div>
  );
}

export function StarRating({
  value, onChange, readOnly = false, size = 18, gap = 2,
}: {
  value: number; onChange?: (v: number) => void;
  readOnly?: boolean; size?: number; gap?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const displayed = hover ?? value;
  return (
    <div
      className="flex flex-wrap items-center"
      style={{ gap }}
      role={readOnly ? undefined : "group"}
      aria-label={readOnly ? `${value} de 5 estrellas` : "Selecciona una valoración; las flechas ajustan media estrella"}
      onMouseLeave={() => !readOnly && setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, displayed - (star - 1)));
        if (readOnly) return <div key={star}><StarGlyph fill={fill} size={size} /></div>;
        return (
          <button
            key={star}
            type="button"
            aria-label={`Valorar con ${star} ${star === 1 ? "estrella" : "estrellas"}`}
            aria-pressed={Math.ceil(value) === star}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#22B16B]"
            onFocus={() => setHover(null)}
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse") return;
              const r = e.currentTarget.getBoundingClientRect();
              setHover(e.clientX < r.left + r.width / 2 ? star - 0.5 : star);
            }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHover(null);
              onChange?.(e.detail === 0 ? star : e.clientX < r.left + r.width / 2 ? star - 0.5 : star);
            }}
            onKeyDown={(e) => {
              const keys: Record<string, number> = {
                ArrowLeft: value - 0.5, ArrowDown: value - 0.5,
                ArrowRight: value + 0.5, ArrowUp: value + 0.5,
                Home: 0.5, End: 5,
              };
              const next = keys[e.key];
              if (next === undefined) return;
              e.preventDefault();
              setHover(null);
              onChange?.(Math.max(0.5, Math.min(5, next)));
            }}
          >
            <StarGlyph fill={fill} size={size} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Rating modal ─────────────────────────────────────────────────────────────

/**
 * Valorar desde Mi lista con el mismo formulario que la ficha de cada obra: casillas del 1 al 10 y comentario
 * opcional. La nota se guarda igual que allí (sobre 10 → mitad en el registro de valoraciones).
 */
export function RatingModal({
  item, existing, onSave, onClose,
}: {
  item: MovieMedia; existing: RatingEntry | null;
  onSave: (rating: number, review: string) => void; onClose: () => void;
}) {
  const viewportBounds = useVisibleViewport();
  const [score, setScore] = useState<number | null>(existing ? starsToScore(existing.rating) : null);
  const [review, setReview] = useState(existing?.review ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll();
    dialogRef.current?.focus();
    return () => {
      unlockScroll();
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, [tabindex="0"]') ?? []);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isEditing = existing !== null;
  const submitLabel = isEditing ? "Actualizar valoración" : review.trim() ? "Publicar valoración" : "Guardar nota";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4"
      style={{ ...viewportBounds, background: "rgba(0,0,0,0.78)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="valorar-titulo" ref={dialogRef} tabIndex={-1}
        className="relative w-full max-w-[920px] overflow-y-auto overscroll-y-contain rounded-[18px] border border-white/10 bg-[#0B0F0D]/95 px-5 pb-6 pt-10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:px-10 sm:pb-9"
        style={{ maxHeight: "calc(var(--visible-viewport-height, 100dvh) - 32px)", animation: "modalIn 0.25s ease both" }}
      >
        <button type="button" onClick={onClose} aria-label="Cerrar valoración"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-[#909090] transition-colors hover:bg-white/10 hover:text-white">
          <X size={18} strokeWidth={1.75} />
        </button>

        <h2 id="valorar-titulo" className="text-center text-[clamp(22px,2.4vw,30px)] font-bold leading-tight text-white">
          ¿Cómo valoras {item.title}?
        </h2>
        <p className="mb-6 mt-2 text-center text-[15px] font-medium text-white">
          Elige una nota del 1 al 10{score === null ? " para poder escribir un comentario" : ""}
        </p>

        <ScoreScale value={score} onChange={setScore} />

        {score !== null && (
          <div className="mx-auto mt-8 w-full max-w-[720px]">
            <label htmlFor="valorar-comentario" className="mb-2 block text-[14px] font-bold text-white">
              Tu comentario <span className="font-medium text-[#909090]">(opcional)</span>
            </label>
            <textarea
              id="valorar-comentario" value={review} onChange={(e) => setReview(e.target.value)}
              maxLength={MAX_COMMENT_CHARS} rows={4}
              placeholder="¿Qué te ha parecido? Cuéntanos sin destripar el final…"
              className="w-full resize-y rounded-[8px] border-2 border-white/15 bg-black/40 px-4 py-3 text-[16px] leading-[1.5] text-white placeholder-[#909090] outline-none transition-colors focus:border-[#22B16B]"
            />
            <p aria-live="polite" className="mt-2 text-[13px] text-[#BBBBBB]">{review.length} / {MAX_COMMENT_CHARS.toLocaleString("es-ES")} caracteres</p>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={onClose}
                className="h-12 rounded-[4px] px-5 text-[15px] font-bold text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Cancelar
              </button>
              <button type="button" onClick={() => onSave(score / 2, review.trim())}
                className="h-12 rounded-[4px] bg-[#22B16B] px-6 text-[15px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {submitLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
