/**
 * Nota media de la gente por título. Sin dependencias de red: la lectura de la base de datos está en
 * `summary-server.ts`. La escala es la misma que la de la ficha: las estrellas (0,5–5) por 2, es decir, de 0 a 10
 * con un decimal. Un título sin valoraciones no tiene nota (no se inventa ninguna).
 */

export interface RatingRow {
  readonly pelicula_id: number;
  /** Estrellas de 0,5 a 5; 0 = sin valorar. */
  readonly score: number;
}

export interface CommunityScoreSummary {
  /** Nota media de 0 a 10 con un decimal. */
  readonly average: number;
  readonly votes: number;
}

const MAX_STARS = 5;

/** Media por título de las valoraciones válidas. Los títulos sin ninguna no aparecen en el resultado. */
export function summarizeRatings(rows: readonly RatingRow[]): Map<number, CommunityScoreSummary> {
  const totals = new Map<number, { sum: number; votes: number }>();
  for (const row of rows) {
    const stars = row.score;
    if (typeof stars !== "number" || !Number.isFinite(stars) || stars <= 0) continue;
    const entry = totals.get(row.pelicula_id) ?? { sum: 0, votes: 0 };
    entry.sum += Math.min(stars, MAX_STARS);
    entry.votes += 1;
    totals.set(row.pelicula_id, entry);
  }

  const result = new Map<number, CommunityScoreSummary>();
  for (const [id, { sum, votes }] of totals) {
    result.set(id, { average: Math.round((sum / votes) * 2 * 10) / 10, votes });
  }
  return result;
}

/** «8.4»: siempre con un decimal y entre 0 y 10. */
export function formatCommunityScore(average: number): string {
  return Math.min(10, Math.max(0, average)).toFixed(1);
}

/** Añade `communityScore` a los títulos que ya tienen votos. Devuelve copias: no modifica la lista. */
export function attachCommunityScores<T extends { readonly numericId: number }>(
  items: readonly T[],
  summaries: ReadonlyMap<number, CommunityScoreSummary>,
): (T & { communityScore?: CommunityScoreSummary })[] {
  return items.map((item) => {
    const summary = summaries.get(item.numericId);
    return summary ? { ...item, communityScore: summary } : { ...item };
  });
}
