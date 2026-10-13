"use client";

import { useEffect, useRef, useState } from "react";
import { ScoreScale } from "@/components/features/ratings/score-scale";

/** Mismo límite que el formulario anterior (la API admite hasta 2.000). */
export const MAX_COMMENT_CHARS = 1000;

interface RatingFormProps {
  readonly title: string;
  /** Valoración previa del usuario, si la hay (para editarla). */
  readonly initial: { readonly score: number; readonly comment: string } | null;
  readonly isSaving: boolean;
  readonly errorMessage: string | null;
  readonly onSubmit: (score: number, comment: string) => void;
  /** Si existe, se muestra "Cancelar" (al editar una valoración ya guardada). */
  readonly onCancel?: () => void;
  readonly shouldFocus?: boolean;
}

/**
 * Formulario en línea: primero la nota y, una vez elegida, el comentario
 * opcional y el botón de publicar. No guarda nada por sí mismo.
 */
export function RatingForm({ title, initial, isSaving, errorMessage, onSubmit, onCancel, shouldFocus }: RatingFormProps) {
  const [score, setScore] = useState<number | null>(initial?.score ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Foco inicial una sola vez (sin robar el foco al elegir nota con el teclado).
  const focusOnMount = useRef({ shouldFocus, hasScore: initial !== null });
  useEffect(() => {
    if (!focusOnMount.current.shouldFocus) return;
    if (focusOnMount.current.hasScore) textareaRef.current?.focus();
    else document.getElementById("score-tile-1")?.focus();
  }, []);

  const hasComment = comment.trim().length > 0;
  const isEditing = initial !== null;
  const submitLabel = isSaving
    ? "Guardando…"
    : isEditing
      ? "Actualizar valoración"
      : hasComment
        ? "Publicar valoración"
        : "Guardar nota";

  return (
    <section aria-labelledby="rating-form-title" className="mx-auto w-full max-w-[1100px]">
      <h2 id="rating-form-title" className="text-center text-[clamp(22px,2.4vw,32px)] font-bold leading-tight text-white">
        ¿Cómo valoras {title}?
      </h2>
      <p className="mb-6 mt-2 text-center text-[15px] font-medium text-white">
        Elige una nota del 1 al 10{score === null ? " para poder escribir un comentario" : ""}
      </p>

      <ScoreScale value={score} onChange={setScore} isDisabled={isSaving} />

      {score !== null && (
        <div className="mx-auto mt-8 w-full max-w-[768px]">
          <label htmlFor="rating-comment" className="mb-2 block text-[14px] font-bold text-white">
            Tu comentario <span className="font-medium text-[#8C8CA5]">(opcional)</span>
          </label>
          <textarea
            id="rating-comment"
            ref={textareaRef}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={MAX_COMMENT_CHARS}
            rows={4}
            disabled={isSaving}
            placeholder="¿Qué te ha parecido? Cuéntanos sin destripar el final…"
            className="w-full resize-y rounded-[8px] border-2 border-[#3A3A52] bg-[#242432] px-4 py-3 text-[16px] leading-[1.5] text-white placeholder-[#8C8CA5] outline-none transition-colors focus:border-[#22B16B] disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between text-[13px] text-[#B8B8CC]">
            <span aria-live="polite">{comment.length} / {MAX_COMMENT_CHARS.toLocaleString("es-ES")} caracteres</span>
          </div>

          {errorMessage && (
            <p role="alert" className="mt-3 rounded-[6px] border border-red-400/40 bg-red-500/10 px-4 py-3 text-[14px] font-medium text-red-200">
              {errorMessage}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="h-12 rounded-[4px] px-5 text-[15px] font-bold text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={() => onSubmit(score, comment.trim())}
              disabled={isSaving}
              className="h-12 rounded-[4px] bg-[#22B16B] px-6 text-[15px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
