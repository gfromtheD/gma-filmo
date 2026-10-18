"use client";

import { SelectField, TextField } from "./fields";
import { ROLE_OPTIONS } from "./options";
import { AddRowButton, ColumnHeads, RemoveRowButton } from "./sheet-row";
import { errorIf, type StepProps } from "./step-props";
import { DIRECTOR_ROLE } from "@/lib/studio/catalogs";

const ROW = "sm:grid-cols-[200px_minmax(0,1fr)_44px]";

/**
 * Créditos: papel y nombre de quienes salen en la ficha, en filas como los créditos de una película (papel a la
 * izquierda, nombre a la derecha). No se piden datos de contacto: los de quien sube la obra viven en su perfil.
 */
export function TeamSection({ draft, update, showErrors }: StepProps) {
  const { team } = draft;
  const patchMember = (index: number, next: Partial<(typeof team)[number]>) =>
    update({ team: team.map((m, i) => (i === index ? { ...m, ...next } : m)) });
  const needsDirector = !team.some((m) => m.role === DIRECTOR_ROLE && m.name.trim() !== "");

  return (
    <div className="flex flex-col">
      {team.length > 0 && <ColumnHeads columns={["Papel", "Nombre", ""]} template={ROW} />}
      <ul className="flex flex-col gap-3">
        {team.map((m, i) => (
          <li key={i} className={`grid items-start gap-2 sm:gap-4 ${ROW}`}>
            <SelectField label="Papel" required labelHidden value={m.role} options={ROLE_OPTIONS} onChange={(v) => patchMember(i, { role: v })}
              error={errorIf(showErrors, !m.role, "Elige su papel.")} />
            <TextField label="Nombre" required labelHidden value={m.name} autoComplete="off" placeholder="Nombre y apellidos"
              onChange={(v) => patchMember(i, { name: v })} error={errorIf(showErrors, !m.name.trim(), "Escribe el nombre.")} />
            <RemoveRowButton label={`Quitar a ${m.name.trim() || "esta persona"}`} onClick={() => update({ team: team.filter((_, j) => j !== i) })} />
          </li>
        ))}
      </ul>
      {team.length === 0 && <p className="text-[14px] text-[#A8A8A8]">Todavía no hay nadie. La primera persona entra como dirección.</p>}
      {showErrors && needsDirector && <p role="alert" className="mt-3 text-[13px] text-[#ff7b7b]">Añade al menos a una persona con el papel de director/a.</p>}
      <AddRowButton onClick={() => update({ team: [...team, { name: "", role: team.length === 0 ? DIRECTOR_ROLE : "" }] })}>
        Añadir persona
      </AddRowButton>
    </div>
  );
}
