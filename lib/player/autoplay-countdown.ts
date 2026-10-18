/**
 * Reglas de la cuenta atrás del reproductor hacia el siguiente título. Funciones puras: las usa `PlayerScreen` y las
 * cubre `e2e/unit/autoplay-countdown.spec.ts`.
 */

/** Segundos antes del final en que aparece la cuenta atrás en una obra de duración normal. */
export const AUTOPLAY_WINDOW_SECS = 10;

/** Parte máxima de la duración que puede ocupar la cuenta atrás en un vídeo corto. */
const MAX_SHARE_OF_RUNTIME = 0.15;

/**
 * Cuántos segundos antes del final aparece la cuenta atrás. En obras largas son 10; en vídeos cortos se reduce para
 * no ocupar más del 15 % de la duración (si no, un vídeo de 6 s tendría la cuenta atrás desde el primer segundo).
 * Con una duración desconocida devuelve 0: no se arranca.
 */
export function autoplayWindowFor(durationSecs: number): number {
  if (!Number.isFinite(durationSecs) || durationSecs <= 0) return 0;
  return Math.min(AUTOPLAY_WINDOW_SECS, durationSecs * MAX_SHARE_OF_RUNTIME);
}

/** El contador solo baja mientras el vídeo se reproduce: si el usuario pausa, la cuenta atrás espera. */
export function shouldTickCountdown(secs: number | null, isPlaying: boolean): boolean {
  return secs !== null && secs > 0 && isPlaying;
}
