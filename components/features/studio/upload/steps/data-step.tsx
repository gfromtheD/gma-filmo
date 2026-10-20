"use client";

import { CheckboxField, MultiSelect, SelectField, StepHeading, TextAreaField } from "../fields";
import { DurationInput } from "../minutes-field";
import { AwardsSection } from "../awards-section";
import { AGE_OPTIONS, CATEGORY_OPTIONS, GENRE_OPTIONS, THEME_OPTIONS, countryOptions } from "../options";
import { SheetRow } from "../sheet-row";
import { TeamSection } from "../team-section";
import { errorIf, type StepProps } from "../step-props";
import { LanguageSection } from "./language-section";
import { LIMITS } from "@/lib/studio/catalogs";

/** Años que se pueden elegir: del actual hacia atrás (en GMA solo hay obras ya terminadas). */
function yearOptions() {
  const last = new Date().getFullYear();
  return Array.from({ length: last - LIMITS.firstYear + 1 }, (_, i) => String(last - i)).map((y) => ({ value: y, label: y }));
}

/**
 * «Completa los detalles»: la ficha técnica de la obra, en un único pliego. Cada fila dice a la izquierda qué se pide;
 * a la derecha van los campos. Lo obligatorio va primero; lo opcional, al final.
 */
export function DataStep(props: StepProps) {
  const { draft, update, showErrors } = props;
  const countries = countryOptions();
  const years = yearOptions();

  return (
    <section aria-labelledby="step-datos" className="flex flex-col gap-6">
      <div id="step-datos">
        <StepHeading title="Completa los detalles" intro="La ficha técnica de tu obra. Lo marcado con * es obligatorio; el resto ayuda a que la encuentren en el catálogo." />
      </div>

      <div className="divide-y divide-white/[0.08] overflow-clip rounded-[14px] border border-white/10 bg-black/40 backdrop-blur-md">
        <SheetRow id="datos-obra" title="La obra" description="Cuándo se terminó, cuánto dura y de dónde es.">
          <div className="flex flex-col gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <DurationInput label="Duración" required value={draft.durationMinutes}
                onChange={(minutes) => update({ durationMinutes: minutes })}
                error={errorIf(showErrors, !draft.durationMinutes, "Indica la duración.")} />
              <SelectField label="Año de estreno" required value={draft.releaseYear ? String(draft.releaseYear) : ""} options={years}
                onChange={(v) => update({ releaseYear: v ? Number(v) : null })} placeholder="Elige el año"
                error={errorIf(showErrors, !draft.releaseYear, "Indica el año de estreno.")} />
              <SelectField label="País de producción" value={draft.productionCountry} options={countries} onChange={(v) => update({ productionCountry: v })}
                placeholder="Sin indicar" hint="El de su productora, no dónde se rodó." />
              <SelectField label="Edad recomendada" value={draft.ageRating} options={AGE_OPTIONS} onChange={(v) => update({ ageRating: v })} placeholder="Sin indicar" />
            </div>
            <CheckboxField label="Ópera prima" hint="Es la primera obra de su director o directora." checked={draft.firstFilm} onChange={(v) => update({ firstFilm: v })} />
          </div>
        </SheetRow>

        <SheetRow id="datos-clasificacion" title="Clasificación" description="Ayuda a que la encuentren en el catálogo y en las recomendaciones.">
          <div className="flex flex-col gap-5">
            <MultiSelect label="Categoría" required options={CATEGORY_OPTIONS} value={draft.categories} onChange={(v) => update({ categories: v })}
              hint="Elige todas las que encajen."
              error={errorIf(showErrors, draft.categories.length === 0, "Elige al menos una categoría.")} />
            <div className="grid gap-5 sm:grid-cols-2">
              <MultiSelect label="Género" searchable options={GENRE_OPTIONS} value={draft.genres} onChange={(v) => update({ genres: v })} />
              <MultiSelect label="Temática" searchable options={THEME_OPTIONS} value={draft.themes} onChange={(v) => update({ themes: v })} />
            </div>
          </div>
        </SheetRow>

        <SheetRow id="datos-idioma" title="Idioma y subtítulos" description="El idioma del audio y, si los tienes, subtítulos en otros idiomas.">
          <LanguageSection {...props} />
        </SheetRow>

        <SheetRow id="datos-creditos" title="Créditos" description="Quién la ha hecho. Basta con lo principal; empieza por la dirección.">
          <TeamSection {...props} />
        </SheetRow>

        <SheetRow id="datos-premios" title="Premios y selecciones" description="Festivales por los que ha pasado o premios que ha ganado.">
          <AwardsSection {...props} />
        </SheetRow>

        <SheetRow id="datos-ia" title="IA disclaimer" description="Si alguna parte se creó o se ayudó con IA, se indicará en su ficha.">
          <div className="flex flex-col gap-4">
            <CheckboxField label="Esta obra contiene contenido creado o asistido con IA" checked={draft.ai.used} onChange={(v) => update({ ai: { ...draft.ai, used: v } })} />
            {draft.ai.used && (
              <TextAreaField label="Qué partes" rows={2} maxLength={LIMITS.shortSynopsisChars} value={draft.ai.note}
                onChange={(v) => update({ ai: { ...draft.ai, note: v } })} hint="Por ejemplo: voz, imágenes de fondo, guion." />
            )}
          </div>
        </SheetRow>
      </div>
    </section>
  );
}
