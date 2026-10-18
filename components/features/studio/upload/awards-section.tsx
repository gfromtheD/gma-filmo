"use client";

import { TextField } from "./fields";
import { AddRowButton, ColumnHeads, RemoveRowButton } from "./sheet-row";
import { errorIf, type StepProps } from "./step-props";

const ROW = "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px]";

/** Premios y selecciones: festivales por los que ha pasado la obra o premios que ha ganado. Opcional. */
export function AwardsSection({ draft, update, showErrors }: StepProps) {
  const { awards } = draft;
  const patchAward = (index: number, next: Partial<(typeof awards)[number]>) =>
    update({ awards: awards.map((a, i) => (i === index ? { ...a, ...next } : a)) });

  return (
    <div className="flex flex-col">
      {awards.length > 0 && <ColumnHeads columns={["Festival o certamen", "Premio o selección", ""]} template={ROW} />}
      <ul className="flex flex-col gap-3">
        {awards.map((a, i) => (
          <li key={i} className={`grid items-start gap-2 sm:gap-4 ${ROW}`}>
            <TextField label="Festival o certamen" required labelHidden value={a.festival} placeholder="Por ejemplo, Festival de Sitges"
              onChange={(v) => patchAward(i, { festival: v })} error={errorIf(showErrors, !a.festival.trim(), "Escribe el festival.")} />
            <TextField label="Premio o selección" labelHidden value={a.award} placeholder="Mejor cortometraje, Selección oficial…"
              onChange={(v) => patchAward(i, { award: v })} />
            <RemoveRowButton label={`Quitar ${a.festival.trim() || "este premio"}`} onClick={() => update({ awards: awards.filter((_, j) => j !== i) })} />
          </li>
        ))}
      </ul>
      <AddRowButton onClick={() => update({ awards: [...awards, { festival: "", award: "" }] })}>Añadir premio o selección</AddRowButton>
    </div>
  );
}
