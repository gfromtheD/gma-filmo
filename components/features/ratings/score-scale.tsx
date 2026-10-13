"use client";

import type { KeyboardEvent } from "react";
import { MAX_SCORE, MIN_SCORE, SCORES, scoreLabel } from "@/lib/ratings/score-format";

interface ScoreScaleProps {
  readonly value: number | null;
  readonly onChange: (score: number) => void;
  readonly isDisabled?: boolean;
}

/**
 * Selector de nota 1–10: una casilla grande por valor con su etiqueta debajo
 * (en móvil, 5 por fila y la etiqueta de la nota elegida bajo la escala).
 * Es un `radiogroup` accesible: flechas, Inicio y Fin cambian la nota.
 */
export function ScoreScale({ value, onChange, isDisabled = false }: ScoreScaleProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, score: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowUp" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1
      : 0;
    const target =
      event.key === "Home" ? MIN_SCORE
      : event.key === "End" ? MAX_SCORE
      : step !== 0 ? Math.min(MAX_SCORE, Math.max(MIN_SCORE, score + step))
      : null;
    if (target === null) return;
    event.preventDefault();
    onChange(target);
    document.getElementById(`score-tile-${target}`)?.focus();
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Tu puntuación, del 1 al 10"
        className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-3"
      >
        {SCORES.map((score) => {
          const isSelected = value === score;
          // Con foco itinerante: la nota elegida (o la primera, si no hay ninguna) es la tabulable.
          const isTabStop = value === null ? score === MIN_SCORE : isSelected;
          return (
            <div key={score} className="flex flex-col items-center gap-2">
              <button
                id={`score-tile-${score}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${score}, ${scoreLabel(score)}`}
                tabIndex={isTabStop ? 0 : -1}
                disabled={isDisabled}
                onClick={() => onChange(score)}
                onKeyDown={(event) => handleKeyDown(event, score)}
                className={`flex aspect-square w-full items-center justify-center rounded-[3px] border-2 text-[clamp(28px,4vw,56px)] font-semibold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
                  isSelected
                    ? "border-[#22B16B] bg-[#22B16B]/10 text-[#22B16B]"
                    : "border-[#3A3A52] text-[#8C8CA5] hover:border-white/70 hover:text-white"
                }`}
              >
                {score}
              </button>
              <span
                aria-hidden="true"
                className={`hidden text-center text-[14px] leading-tight sm:block ${isSelected ? "font-bold text-white" : "text-[#8C8CA5]"}`}
              >
                {scoreLabel(score)}
              </span>
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-3 min-h-[1.5em] text-center text-[15px] font-bold text-white sm:hidden">
        {value !== null ? `${value} · ${scoreLabel(value)}` : ""}
      </p>
    </div>
  );
}
