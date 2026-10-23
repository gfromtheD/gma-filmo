/**
 * Velocidad y tiempo restante de una subida, a partir de las muestras de avance. Lógica pura (sin React ni reloj propio).
 * La velocidad se suaviza con una media móvil exponencial para que el tiempo restante no salte con cada trozo.
 */

export interface RateState {
  readonly at: number;
  readonly bytes: number;
  /** Bytes por segundo suavizados; `null` hasta tener dos muestras separadas lo bastante. */
  readonly rate: number | null;
}

/** Cuánto pesa la muestra nueva frente a la media (0–1). */
const SMOOTHING = 0.25;
/** Con menos de esto entre muestras no se calcula velocidad (evita dividir por casi cero). */
const MIN_INTERVAL_MS = 400;

export function nextRate(previous: RateState | null, now: number, bytes: number): RateState {
  if (!previous || bytes < previous.bytes) return { at: now, bytes, rate: null };
  const elapsed = now - previous.at;
  if (elapsed < MIN_INTERVAL_MS) return previous;
  const instant = ((bytes - previous.bytes) * 1000) / elapsed;
  const rate = previous.rate === null ? instant : previous.rate + SMOOTHING * (instant - previous.rate);
  return { at: now, bytes, rate };
}

/** Segundos que faltan; `null` si no hay velocidad todavía o está parado. */
export function etaSeconds(remainingBytes: number, rate: number | null): number | null {
  if (rate === null || rate <= 0 || remainingBytes < 0) return null;
  return remainingBytes / rate;
}

export function formatRate(bytesPerSecond: number): string {
  const mb = bytesPerSecond / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB/s`;
  return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
}

/** «menos de 1 min», «≈ 3 min», «≈ 1 h 05 min». */
export function formatEta(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `≈ ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `≈ ${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** Tiempo transcurrido: «45 s», «3 min 05 s», «1 h 02 min». */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min ${String(total % 60).padStart(2, "0")} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function formatMegabytes(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}
