"use client";

import { BUTTON_SECONDARY, TextField } from "./fields";
import { errorIf, type StepProps } from "./step-props";

/** Premios y selecciones: un dato extra, plegado por defecto, para quien quiera mencionar dónde ha estado la obra. */
export function AwardsSection({ draft, update, showErrors }: StepProps) {
  const { awards } = draft;
  const patchAward = (index: number, next: Partial<(typeof awards)[number]>) =>
    update({ awards: awards.map((a, i) => (i === index ? { ...a, ...next } : a)) });

  return (
    <details className="rounded-[10px] border border-white/10 bg-white/[0.03] p-4">
      <summary className="cursor-pointer text-[14px] font-bold text-white">
        Premios y selecciones <span className="font-medium text-[#7C7C7C]">{awards.length > 0 ? `(${awards.length})` : "Opcional"}</span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-[13.5px] text-[#A8A8A8]">Si la obra ha pasado por festivales o ha ganado algún premio, cuéntalo aquí.</p>
        <ul className="flex flex-col gap-4">
          {awards.map((a, i) => (
            <li key={i} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <TextField label="Festival o certamen" required value={a.festival} onChange={(v) => patchAward(i, { festival: v })}
                error={errorIf(showErrors, !a.festival.trim(), "Escribe el festival.")} />
              <TextField label="Premio o selección" value={a.award} onChange={(v) => patchAward(i, { award: v })} hint="Por ejemplo, «Mejor cortometraje» o «Selección oficial»." />
              <button type="button" onClick={() => update({ awards: awards.filter((_, j) => j !== i) })}
                className="self-start text-[13px] font-semibold text-[#ff7b7b] underline-offset-2 hover:underline sm:mt-8">
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => update({ awards: [...awards, { festival: "", award: "" }] })} className={`${BUTTON_SECONDARY} self-start`}>
          Añadir premio o selección
        </button>
      </div>
    </details>
  );
}
