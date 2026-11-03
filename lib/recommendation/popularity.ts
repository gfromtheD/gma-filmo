/**
 * Popularidad real de los títulos: cuántas personas distintas los vieron en los últimos días. Sin dependencias de red.
 * El motor de recomendaciones la mezcla con la posición del título en la lista (lo que usaba antes).
 */

/** Popularidad de 0 a 1 por `numericId` de título. */
export type PopularityByNumericId = ReadonlyMap<number, number>;

export interface PopularityRow {
  readonly pelicula_id: number | string;
  readonly viewers: number | string;
}

/** Peso de la popularidad real frente a la posición en la lista cuando hay datos reales. */
export const REAL_POPULARITY_WEIGHT = 0.7;

/** Normaliza a 0–1 dividiendo por el título más visto. Filas no válidas o sin espectadores se descartan. */
export function normalizePopularity(rows: readonly PopularityRow[]): Map<number, number> {
  const parsed = rows
    .map((row) => ({ id: Number(row.pelicula_id), viewers: Number(row.viewers) }))
    .filter((row) => Number.isInteger(row.id) && row.id > 0 && Number.isFinite(row.viewers) && row.viewers > 0);
  const max = Math.max(0, ...parsed.map((row) => row.viewers));
  const result = new Map<number, number>();
  if (max === 0) return result;
  for (const row of parsed) result.set(row.id, row.viewers / max);
  return result;
}

/**
 * Popularidad final de un título: la posición en la lista (0–1) si no hay datos reales de ese título; si los hay, una mezcla
 * con más peso en lo real. Un título sin vistas recientes (`undefined`) sigue valiendo por su posición.
 */
export function popularityScore(positional: number, real: number | undefined): number {
  if (real === undefined) return positional;
  return REAL_POPULARITY_WEIGHT * real + (1 - REAL_POPULARITY_WEIGHT) * positional;
}
