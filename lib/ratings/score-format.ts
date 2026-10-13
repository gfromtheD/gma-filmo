/** Escala de GMA: nota entera de 1 a 10 (se guarda como estrellas = nota / 2). */

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

const SCORE_LABELS: Readonly<Record<number, string>> = {
  1: "Horrible",
  2: "Muy floja",
  3: "Floja",
  4: "Regular",
  5: "Mediocre",
  6: "Pasable",
  7: "Buena",
  8: "Muy buena",
  9: "Excelente",
  10: "Imprescindible",
};

export const SCORES: readonly number[] = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

/** Palabra que acompaña a una nota ("" si la nota no es válida). */
export function scoreLabel(score: number): string {
  return SCORE_LABELS[score] ?? "";
}

/** Nota 1–10 a partir de las estrellas guardadas (0,5–5). */
export function starsToScore(stars: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(stars * 2)));
}

/** "2026-10-12T10:00:00Z" → "12 OCTUBRE 2026" (hora local de España, sin "de"). */
export function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" })
    .replace(/ de /g, " ")
    .toUpperCase();
}
