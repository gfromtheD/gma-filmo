/** El servidor responde con este código cuando el borrador cambió entre que se leyó y se escribió (p. ej. otra subida reservó hueco justo antes). */
export const REVISION_CONFLICT = "UPLOAD_REVISION_CONFLICT";

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 120;
const JITTER_MS = 180;

const isRevisionConflict = (error: unknown): boolean => error instanceof Error && error.message === REVISION_CONFLICT;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta `operation` (que debe releer el estado que necesita) y la repite si choca con otra escritura concurrente del mismo borrador.
 * Subir a la vez el tráiler y un extra, o varios archivos arrastrados juntos, hace que dos reservas lean la misma revisión: solo una
 * gana y la otra no es un error del usuario, así que se reintenta con una espera corta y aleatoria para que no vuelvan a coincidir.
 */
export async function retryOnRevisionConflict<T>(
  operation: () => Promise<T>,
  options: { readonly attempts?: number; readonly sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = options.attempts ?? MAX_ATTEMPTS;
  const sleep = options.sleep ?? wait;
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRevisionConflict(error) || attempt >= attempts) throw error;
      await sleep(BASE_DELAY_MS * attempt + Math.random() * JITTER_MS);
    }
  }
}
