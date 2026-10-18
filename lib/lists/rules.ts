/**
 * Reglas de las listas personalizadas de Mi lista, compartidas por la interfaz y por las rutas /api/lists.
 */

export const LIST_NAME_MAX = 60;
export const MAX_LISTS_PER_PROFILE = 30;
export const MAX_ITEMS_PER_LIST = 500;

/** Nombre sin espacios al principio, al final ni repetidos. */
export function normalizeListName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const compareKey = (name: string) =>
  normalizeListName(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");

/** Error a mostrar para un nombre de lista, o `null` si vale. `existing`: nombres de las otras listas del perfil. */
export function listNameError(name: string, existing: readonly string[] = []): string | null {
  const clean = normalizeListName(name);
  if (!clean) return "Ponle un nombre a la lista.";
  if (clean.length > LIST_NAME_MAX) return `El nombre puede tener como mucho ${LIST_NAME_MAX} caracteres.`;
  if (existing.some((other) => compareKey(other) === compareKey(clean))) return "Ya tienes una lista con ese nombre.";
  return null;
}
