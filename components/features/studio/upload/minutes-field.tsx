"use client";

import { useId } from "react";
import { FieldShell } from "./fields";

/** Duración máxima: 12 horas (en GMA no hay obras más largas). */
const MAX_TOTAL = 12 * 60 + 59;

/** Contenedor con el mismo aspecto que el resto de campos; se ilumina al enfocar cualquiera de sus dos partes. */
const BOX =
  "flex w-full items-center gap-4 rounded-[8px] border border-white/15 bg-black/40 px-3.5 py-2.5 transition-colors focus-within:border-[#22B16B]";

const PART_INPUT =
  "w-[2.6ch] bg-transparent text-right text-[15px] leading-6 tabular-nums text-white outline-none placeholder:text-[#5E5E5E]";

const ARROW =
  "grid h-3 w-4 place-items-center text-[#22B16B]/55 transition-colors hover:text-[#5FD39A] disabled:cursor-not-allowed disabled:opacity-25";

function Chevron({ up }: { readonly up: boolean }) {
  return (
    <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-1.5 w-2.5">
      <path d={up ? "M1 5 5 1l4 4" : "M1 1l4 4 4-4"} />
    </svg>
  );
}

interface PartProps {
  readonly id?: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly max: number;
  readonly isEmpty: boolean;
  readonly onType: (value: number) => void;
  readonly onStep: (delta: 1 | -1) => void;
  readonly canUp: boolean;
  readonly canDown: boolean;
  readonly describedBy?: string;
  readonly invalid?: boolean;
}

/** Una parte de la duración (horas o minutos): número escrito a mano, su unidad y dos flechas diminutas que aparecen al pasar por encima. */
function Part({ id, label, unit, value, max, isEmpty, onType, onStep, canUp, canDown, describedBy, invalid }: PartProps) {
  return (
    <span className="group/part flex items-center gap-1.5">
      <input
        id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="0" aria-label={label}
        aria-describedby={describedBy} aria-invalid={invalid ? true : undefined}
        value={isEmpty ? "" : String(value)}
        onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 2); onType(digits === "" ? 0 : Math.min(max, Number(digits))); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") { event.preventDefault(); onStep(1); }
          if (event.key === "ArrowDown") { event.preventDefault(); onStep(-1); }
        }}
        className={PART_INPUT}
      />
      <span aria-hidden="true" className="text-[14px] text-[#8A8A8A]">{unit}</span>
      {/* Las flechas solo aparecen al pasar el cursor por esta parte (o al escribir en ella); el hueco se reserva para que nada se mueva. */}
      <span className="ml-0.5 flex flex-col opacity-0 transition-opacity duration-150 group-hover/part:opacity-100 group-focus-within/part:opacity-100 motion-reduce:transition-none">
        <button type="button" tabIndex={-1} className={ARROW} onClick={() => onStep(1)} disabled={!canUp} aria-label={`Más ${label.toLowerCase()}`}><Chevron up /></button>
        <button type="button" tabIndex={-1} className={ARROW} onClick={() => onStep(-1)} disabled={!canDown} aria-label={`Menos ${label.toLowerCase()}`}><Chevron up={false} /></button>
      </span>
    </span>
  );
}

interface DurationInputProps {
  readonly label: string;
  /** Duración total en minutos, o `null` si está vacía. */
  readonly value: number | null;
  readonly onChange: (minutes: number | null) => void;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
}

/**
 * Duración en horas y minutos («1 h 32 min»), escrita a mano o con las flechas. Se guarda en minutos; las flechas de
 * los minutos pasan a la hora siguiente al llegar a 59. Las flechas ↑ ↓ del teclado también funcionan en cada parte.
 */
export function DurationInput({ label, value, onChange, required, hint, error }: DurationInputProps) {
  const id = useId();
  const total = value ?? 0;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const set = (next: number) => onChange(next > 0 ? Math.min(MAX_TOTAL, next) : null);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <div className={`${BOX} ${error ? "border-[#ff5252]/60" : ""}`}>
        <Part id={id} label="Horas" unit="h" value={hours} max={12} isEmpty={value === null}
          onType={(h) => set(h * 60 + minutes)} onStep={(d) => set(total + d * 60)}
          canUp={total + 60 <= MAX_TOTAL} canDown={total >= 60} describedBy={describedBy} invalid={Boolean(error)} />
        <Part label="Minutos" unit="min" value={minutes} max={59} isEmpty={value === null}
          onType={(m) => set(hours * 60 + m)} onStep={(d) => set(total + d)}
          canUp={total < MAX_TOTAL} canDown={total > 0} describedBy={describedBy} invalid={Boolean(error)} />
      </div>
    </FieldShell>
  );
}
