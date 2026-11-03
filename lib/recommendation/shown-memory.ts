/**
 * Memoria de lo que se enseñó en la portada (por perfil): título → instante (ms) de la última vez. Se guarda en el navegador y
 * también en la base de datos, para que no se pierda al cambiar de navegador o borrar datos. Sin dependencias de red.
 */

export type ShownMap = Record<string, number>;

/** Un título enseñado hace menos de esto (48 h) cuenta como «ya visto en la portada». */
export const SHOWN_WINDOW_MS = 48 * 3_600_000;
/** Máximo de títulos que se envían al servidor de una vez. */
export const SHOWN_BATCH_MAX = 200;

/** Quita lo anterior a la ventana. No modifica el original. */
export function pruneShown(shown: ShownMap, now: number): ShownMap {
  const cutoff = now - SHOWN_WINDOW_MS;
  return Object.fromEntries(Object.entries(shown).filter(([, at]) => Number.isFinite(at) && at >= cutoff));
}

/** Une dos memorias quedándose con la fecha más reciente de cada título, ya sin lo caducado. */
export function mergeShown(a: ShownMap, b: ShownMap, now: number): ShownMap {
  const merged: ShownMap = { ...a };
  for (const [id, at] of Object.entries(b)) merged[id] = Math.max(merged[id] ?? 0, at);
  return pruneShown(merged, now);
}

/** Añade los títulos recién enseñados con la hora de ahora, sin caducados. */
export function markShown(shown: ShownMap, ids: readonly string[], now: number): ShownMap {
  const next: ShownMap = { ...shown };
  for (const id of ids) next[id] = now;
  return pruneShown(next, now);
}

/** Valida el cuerpo de `POST /api/home-shown`: una lista de identificadores de título (se admiten hasta `SHOWN_BATCH_MAX`). */
export function parseShownBody(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length === 0 || items.length > SHOWN_BATCH_MAX) return null;
  if (!items.every((id) => typeof id === "string" && id.length > 0 && id.length <= 120)) return null;
  return [...new Set(items as string[])];
}

/** Filas de la base (`item_id`, `shown_at`) a memoria. */
export function shownFromRows(rows: readonly { item_id: string; shown_at: string }[]): ShownMap {
  const result: ShownMap = {};
  for (const row of rows) {
    const at = Date.parse(row.shown_at);
    if (Number.isFinite(at)) result[row.item_id] = Math.max(result[row.item_id] ?? 0, at);
  }
  return result;
}
