import type { Coleccion } from "@/lib/supabase/queries";
import type { MediaItem } from "@/types/catalog";

export interface CollectionWithCount {
  readonly col: Coleccion;
  readonly filmCount: number;
}

/** Peso de la afinidad del espectador frente al azar de la sesión (0–1). */
const AFFINITY_SHARE = 0.7;

// Mismo generador determinista que usa el motor: misma semilla → mismo orden.
function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 10_000;
  return x - Math.floor(x);
}

/** Colecciones con al menos un título (las vacías no se recomiendan nunca). */
export function collectionsWithContent(
  colecciones: readonly Coleccion[],
  items: readonly MediaItem[],
): CollectionWithCount[] {
  return colecciones
    .map((col) => ({ col, filmCount: items.filter((x) => x.categories.includes(col.name)).length }))
    .filter(({ filmCount }) => filmCount > 0);
}

/**
 * Elige pocas colecciones para la portada. Sin historial es aleatorio (estable
 * dentro de la sesión); con historial pesa la afinidad del espectador, pero el
 * azar de la sesión sigue moviendo el orden para que no sea siempre la misma fila.
 */
export function pickRecommendedCollections(
  candidates: readonly CollectionWithCount[],
  categoryWeights: Readonly<Record<string, number>>,
  seed: number,
  count: number,
): CollectionWithCount[] {
  const maxWeight = Math.max(0, ...candidates.map(({ col }) => categoryWeights[col.name] ?? 0));

  return candidates
    .map((candidate, i) => {
      const affinity = maxWeight > 0 ? (categoryWeights[candidate.col.name] ?? 0) / maxWeight : 0;
      const jitter = seededRandom(seed, i);
      const score = maxWeight > 0 ? affinity * AFFINITY_SHARE + jitter * (1 - AFFINITY_SHARE) : jitter;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count))
    .map(({ candidate }) => candidate);
}
