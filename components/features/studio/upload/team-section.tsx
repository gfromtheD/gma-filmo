"use client";

import { BUTTON_SECONDARY, CARD_CLASS, SelectField, TextField } from "./fields";
import { ROLE_OPTIONS } from "./options";
import { errorIf, type StepProps } from "./step-props";
import { DIRECTOR_ROLE } from "@/lib/studio/catalogs";

/**
 * «Reparto y equipo»: solo nombre y papel de quienes salen en la ficha. No se piden datos de contacto: los de quien
 * sube la obra viven en su perfil de creador.
 */
export function TeamSection({ draft, update, showErrors }: StepProps) {
  const { team } = draft;
  const patchMember = (index: number, next: Partial<(typeof team)[number]>) =>
    update({ team: team.map((m, i) => (i === index ? { ...m, ...next } : m)) });
  const needsDirector = !team.some((m) => m.role === DIRECTOR_ROLE && m.name.trim() !== "");

  return (
    <div className={`${CARD_CLASS} flex flex-col gap-5`}>
      <div>
        <h3 className="text-[19px] font-extrabold text-white">Reparto y equipo</h3>
        <p className="mt-1 text-[14px] text-[#A8A8A8]">Quiénes salen en la ficha: dirección, guion, intérpretes principales… Basta con lo principal, no hace falta la lista de créditos.</p>
      </div>
      {team.length === 0 && <p className="text-[14px] text-[#A8A8A8]">Empieza añadiendo a la dirección de la obra.</p>}
      <ul className="flex flex-col gap-4">
        {team.map((m, i) => (
          <li key={i} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
            <TextField label="Nombre" required value={m.name} autoComplete="off" onChange={(v) => patchMember(i, { name: v })}
              error={errorIf(showErrors, !m.name.trim(), "Escribe el nombre.")} />
            <SelectField label="Papel" required value={m.role} options={ROLE_OPTIONS} onChange={(v) => patchMember(i, { role: v })}
              error={errorIf(showErrors, !m.role, "Elige su papel.")} />
            <button type="button" onClick={() => update({ team: team.filter((_, j) => j !== i) })}
              className="self-start text-[13px] font-semibold text-[#ff7b7b] underline-offset-2 hover:underline sm:mt-8">
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {showErrors && needsDirector && <p role="alert" className="text-[13px] text-[#ff7b7b]">Añade al menos a una persona con el papel de director/a.</p>}
      <button type="button" onClick={() => update({ team: [...team, { name: "", role: team.length === 0 ? DIRECTOR_ROLE : "" }] })} className={`${BUTTON_SECONDARY} self-start`}>
        Añadir persona
      </button>
    </div>
  );
}
