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
/** Código del servidor cuando se reservan demasiados archivos en un minuto (freno anti-scripts). */
export const RATE_LIMITED = "UPLOAD_RATE_LIMITED";
/** El servidor aún está preparando la subida (respuesta reintentable): la misma reserva, con su misma clave, se repite. */
const PROVISION_PENDING = ["UPLOAD_PROVISION_PENDING", "UPLOAD_PROVISION_RECOVERY_REQUIRED"];
const WAIT_CODES: ReadonlySet<string> = new Set([CONCURRENCY_LIMIT, RATE_LIMITED, ...PROVISION_PENDING]);

const BUSY_INTERVAL_MS = 4000;
const BUSY_MAX_WAIT_MS = 3 * 60 * 1000;
/** En cola se espera mientras la página siga abierta: una película de varios GB puede tener ocupado un hueco mucho rato. */
const QUEUE_MAX_WAIT_MS = 6 * 60 * 60 * 1000;

const aborted = () => new DOMException("Cancelado", "AbortError");

/**
 * Si el usuario ya tiene el máximo de subidas activas, la nueva espera su turno (se reintenta cada pocos segundos) en vez de
 * fallar: así puede soltar película, tráiler y varios extras de una vez y se van subiendo según quedan huecos (`onWait` avisa
 * para enseñar «En cola»). Lo mismo si salta el freno de reservas por minuto, o si el servidor aún está preparando la subida:
 * entonces solo se espera unos minutos. Cancelar (`signal`) deja de esperar sin reservar nada.
 */
export async function retryWhileBusy<T>(
  operation: () => Promise<T>,
  options: {
    readonly maxWaitMs?: number; readonly queueMaxWaitMs?: number; readonly intervalMs?: number;
    readonly sleep?: (ms: number) => Promise<void>; readonly signal?: AbortSignal; readonly onWait?: (code: string) => void;
  } = {},
): Promise<T> {
  const maxWait = options.maxWaitMs ?? BUSY_MAX_WAIT_MS;
  const queueMaxWait = options.queueMaxWaitMs ?? QUEUE_MAX_WAIT_MS;
  const interval = options.intervalMs ?? BUSY_INTERVAL_MS;
  const sleep = options.sleep ?? wait;
  const { signal } = options;
  let waited = 0;
  let notified: string | null = null;
  for (;;) {
    if (signal?.aborted) throw aborted();
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error) || !WAIT_CODES.has(error.message)) throw error;
      if (waited >= (error.message === CONCURRENCY_LIMIT ? queueMaxWait : maxWait)) throw error;
      if (notified !== error.message) { notified = error.message; options.onWait?.(error.message); }
      await sleep(interval);
      if (signal?.aborted) throw aborted();
      waited += interval;
    }
  }
}
