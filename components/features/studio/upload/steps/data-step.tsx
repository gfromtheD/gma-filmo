"use client";

import { CARD_CLASS, CheckboxField, MultiSelect, SelectField, StepHeading, TextAreaField, TextField } from "../fields";
import { AwardsSection } from "../awards-section";
import { AGE_OPTIONS, CATEGORY_OPTIONS, GENRE_OPTIONS, THEME_OPTIONS, countryOptions } from "../options";
import { TeamSection } from "../team-section";
import { errorIf, type StepProps } from "../step-props";
import { LanguageSection } from "./language-section";
import { LIMITS } from "@/lib/studio/catalogs";

/** «Completa los detalles»: datos técnicos, idioma y subtítulos, enlaces del proyecto y aviso de IA. */
export function DataStep(props: StepProps) {
  const { draft, update, showErrors } = props;
  const countries = countryOptions();

  return (
    <section aria-labelledby="step-datos" className="flex flex-col gap-6">
      <div id="step-datos"><StepHeading title="Completa los detalles" intro="Último paso: datos que se eligen en listas, como año, duración, idioma, géneros y reparto. Lo marcado con * es obligatorio." /></div>

      <div className={`${CARD_CLASS} grid gap-5 sm:grid-cols-2`}>
        <TextField label="Año de estreno" required type="number" min={LIMITS.firstYear} value={draft.releaseYear ? String(draft.releaseYear) : ""}
          onChange={(v) => update({ releaseYear: v === "" ? null : Math.round(Number(v)) || null })}
          hint="El año en que se estrenó o terminó la obra."
          error={errorIf(showErrors, !draft.releaseYear, "Indica el año de estreno.")} />
        <TextField label="Duración (minutos)" required type="number" min={1} value={draft.durationMinutes ? String(draft.durationMinutes) : ""}
          onChange={(v) => update({ durationMinutes: v === "" ? null : Math.max(0, Math.round(Number(v)) || 0) })}
          error={errorIf(showErrors, !draft.durationMinutes, "Indica la duración en minutos.")} />
        <SelectField label="País de producción" value={draft.productionCountry} options={countries} onChange={(v) => update({ productionCountry: v })}
          placeholder="Sin indicar" hint="El país al que pertenece la obra (el de su productora), no dónde se rodó." />
      </div>

      <div className={`${CARD_CLASS} grid gap-5 sm:grid-cols-2`}>
        <MultiSelect label="Categoría" required options={CATEGORY_OPTIONS} value={draft.categories} onChange={(v) => update({ categories: v })}
          hint="Elige todas las que encajen."
          error={errorIf(showErrors, draft.categories.length === 0, "Elige al menos una categoría.")} />
        <MultiSelect label="Género" searchable options={GENRE_OPTIONS} value={draft.genres} onChange={(v) => update({ genres: v })} />
        <MultiSelect label="Temática" searchable options={THEME_OPTIONS} value={draft.themes} onChange={(v) => update({ themes: v })} />
        <SelectField label="Edad recomendada" value={draft.ageRating} options={AGE_OPTIONS} onChange={(v) => update({ ageRating: v })} placeholder="Sin indicar" />
        <div className="flex flex-col gap-3 sm:col-span-2">
          <CheckboxField label="Ópera prima" checked={draft.firstFilm} onChange={(v) => update({ firstFilm: v })} />
        </div>
      </div>

      <LanguageSection {...props} />

      <TeamSection {...props} />

      <AwardsSection {...props} />

      <div className={`${CARD_CLASS} flex flex-col gap-4`}>
        <CheckboxField
          label="Esta obra puede contener contenido creado o asistido con IA"
          hint="Se mostrará un aviso en su ficha."
          checked={draft.ai.used} onChange={(v) => update({ ai: { ...draft.ai, used: v } })}
        />
        {draft.ai.used && (
          <TextAreaField label="Detalles del aviso" rows={2} maxLength={LIMITS.shortSynopsisChars} value={draft.ai.note}
            onChange={(v) => update({ ai: { ...draft.ai, note: v } })} hint="Opcional: qué partes (voz, imagen, guion…)." />
        )}
      </div>
    </section>
  );
}
