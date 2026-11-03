import { fichaSchema, type Ficha } from "@/lib/media/ficha";
import { countryName, languageName } from "@/lib/studio/geo";

/**
 * Lo que de la ficha completa de un título (la que rellena su creador en Mi Estudio) se enseña en la ficha pública.
 * Es una lista cerrada: la aceptación de condiciones, el permiso de comentarios y la nota sobre el uso de IA son del
 * creador y no salen de aquí.
 */
export interface PublicFicha {
  readonly originalTitle: string | null;
  readonly country: string | null;
  readonly language: string | null;
  readonly subtitleLanguages: readonly string[];
  readonly firstFilm: boolean;
  readonly usesAi: boolean;
  readonly themes: readonly string[];
  readonly awards: readonly { readonly festival: string; readonly award: string }[];
}

const clean = (value: string): string => value.trim();
const unique = (values: readonly string[]): string[] => [...new Set(values.map(clean).filter(Boolean))];

/** Convierte la ficha guardada en lo público; `null` si no es una ficha válida o no tiene nada que mostrar. */
export function toPublicFicha(raw: unknown): PublicFicha | null {
  const parsed = fichaSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ficha: Ficha = parsed.data;
  const result: PublicFicha = {
    originalTitle: clean(ficha.originalTitle) || null,
    country: ficha.productionCountry ? countryName(ficha.productionCountry) : null,
    language: ficha.language ? languageName(ficha.language) : null,
    subtitleLanguages: unique(ficha.subtitleLanguages.map((code) => languageName(code))),
    firstFilm: ficha.firstFilm,
    usesAi: ficha.ai.used,
    themes: unique(ficha.themes),
    awards: ficha.awards
      .map((a) => ({ festival: clean(a.festival), award: clean(a.award) }))
      .filter((a) => a.festival || a.award),
  };
  return hasPublicContent(result) ? result : null;
}

export function hasPublicContent(ficha: PublicFicha): boolean {
  return Boolean(
    ficha.originalTitle || ficha.country || ficha.language || ficha.subtitleLanguages.length > 0 ||
      ficha.firstFilm || ficha.usesAi || ficha.themes.length > 0 || ficha.awards.length > 0,
  );
}
