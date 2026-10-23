/**
 * Película o corto: una sola regla para todo el sitio.
 *
 * Criterio de la industria (Academia de Hollywood, AFI, BFI): un corto dura 40 minutos o menos; una película, más de 40.
 * La base de datos lo decide al publicar a partir de la duración REAL del vídeo medida en el servidor
 * (`gma_upload_command_v2_compat`: `genre = 'Película'` si dura más de 2400 s) y `queries.ts` lo expone como `genre`
 * («Película» o «Cortometraje»). Las obras antiguas ya traen «Película» a mano (p. ej. «La Película», 1 h 02 m).
 */
export const FEATURE_GENRE = "Película";
/** Duración (s) a partir de la cual una obra deja de ser un corto. Debe coincidir con la función de publicación de la base. */
export const FEATURE_MIN_SECONDS_EXCLUSIVE = 2400;

export interface WorkRef {
  readonly id: string;
  readonly genre?: string | null;
}

export const isFeature = (work: Pick<WorkRef, "genre">): boolean => work.genre === FEATURE_GENRE;

/** Ruta de la ficha de una obra: `/peliculas/<id>` si es película, `/cortos/<id>` si es corto. */
export const workPath = (work: WorkRef): string => `${isFeature(work) ? "/peliculas" : "/cortos"}/${work.id}`;

/** Duración en segundos a partir del texto de la base: «9m 40s», «1h 02m», «62m» (formato antiguo del motor) o «Corto». */
export function durationSeconds(text: string | null | undefined): number | null {
  if (!text) return null;
  const part = (unit: string) => {
    const match = new RegExp(`(\\d+)\\s*${unit}(?![a-z])`, "i").exec(text);
    return match ? Number(match[1]) : 0;
  };
  const total = part("h") * 3600 + part("m") * 60 + part("s");
  return total > 0 ? total : null;
}
