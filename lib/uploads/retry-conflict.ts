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

/** Código del servidor cuando el usuario ya tiene el máximo de subidas activas a la vez. */
export const CONCURRENCY_LIMIT = "UPLOAD_CONCURRENCY_LIMIT";

const BUSY_INTERVAL_MS = 4000;
const BUSY_MAX_WAIT_MS = 3 * 60 * 1000;

/**
 * Si el usuario ya tiene el máximo de subidas activas, la nueva espera su turno (se reintenta cada pocos segundos, hasta unos
 * minutos) en vez de fallar: así puede soltar película, tráiler y varios extras de una vez y se van subiendo según quedan huecos.
 */
export async function retryWhileBusy<T>(
  operation: () => Promise<T>,
  options: { readonly maxWaitMs?: number; readonly intervalMs?: number; readonly sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const maxWait = options.maxWaitMs ?? BUSY_MAX_WAIT_MS;
  const interval = options.intervalMs ?? BUSY_INTERVAL_MS;
  const sleep = options.sleep ?? wait;
  let waited = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error) || error.message !== CONCURRENCY_LIMIT || waited >= maxWait) throw error;
      await sleep(interval);
      waited += interval;
    }
  }
}
