import { LIMITS } from "@/lib/studio/catalogs";
import { listLanguages } from "@/lib/studio/geo";
import type { EngineMetadata } from "@/lib/studio-media/mapping";

/**
 * «Editar metadatos» de un título ya publicado (Mis títulos). El servidor (`edit_title`) sobrescribe título, sinopsis y año con
 * lo que recibe, así que el formulario tiene que ofrecer siempre el valor actual del título: si no, guardar lo cambiaría sin querer.
 */
export interface TitleEditForm { readonly title: string; readonly description: string; readonly language: string; readonly year: string }

const MAX_TITLE = 160;

/** Del año actual hacia atrás, como en la subida; el del título va siempre, aunque quede fuera. */
export function editYearOptions(current: string): string[] {
  const last = new Date().getFullYear();
  const years = Array.from({ length: last - LIMITS.firstYear + 1 }, (_, i) => String(last - i));
  return current && !years.includes(current) ? [...years, current] : years;
}

/** Idiomas con el mismo nombre que guarda la subida («español»); el del título va primero si no está en la lista. */
export function editLanguageOptions(current: string): string[] {
  const names = listLanguages().map((l) => l.name);
  return current && !names.includes(current) ? [current, ...names] : names;
}

export function editProblem(form: TitleEditForm): string | null {
  const title = form.title.trim();
  if (!title) return "El título no puede quedar vacío.";
  if (title.length > MAX_TITLE) return `El título no puede pasar de ${MAX_TITLE} caracteres.`;
  return null;
}

export function editMetadata(form: TitleEditForm): EngineMetadata {
  return {
    title: form.title.trim(),
    synopsis: form.description.trim() || null,
    ...(/^\d{4}$/.test(form.year) ? { year: form.year } : {}),
    ...(form.language ? { language: form.language } : {}),
  };
}
