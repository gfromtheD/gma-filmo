/**
 * Cuánto le queda al servidor para convertir un vídeo. PeerTube no nos da su avance, así que se estima con la duración
 * del vídeo y la velocidad medida en el VPS (perfil «gma», 6 hilos): unos 1,6 s de película por segundo contando
 * todas las calidades. Lógica pura (sin React ni reloj propio).
 */
import type { UploadedAsset } from "@/lib/studio/upload-draft";

/** Segundos de vídeo que el VPS convierte por segundo (medido el 2026-10-27/28 con las películas de Pablo Parés). */
export const PROCESSING_SPEED = 1.6;
/** La estimación nunca llega sola al 100 %: el último tramo lo marca el servidor al terminar. */
const MAX_ESTIMATED_PERCENT = 95;

export interface ProcessingEstimate {
  readonly percent: number;
  /** Segundos que faltan según la estimación; 0 si ya debería haber terminado. */
  readonly remainingSeconds: number;
}

export function processingEstimate(mediaSeconds: number | undefined, sinceMs: number | undefined, nowMs: number): ProcessingEstimate | null {
  if (!mediaSeconds || mediaSeconds <= 0 || !sinceMs) return null;
  const total = mediaSeconds / PROCESSING_SPEED;
  const elapsed = Math.max(0, (nowMs - sinceMs) / 1000);
  return {
    percent: Math.min(MAX_ESTIMATED_PERCENT, Math.floor((elapsed / total) * 100)),
    remainingSeconds: Math.max(0, total - elapsed),
  };
}

/**
 * Al cambiar el archivo de un hueco, conserva cuándo empezó a convertirse (para que una recarga no reinicie la cuenta)
 * y la duración medida al elegirlo.
 */
export function keepProcessingClock(previous: UploadedAsset | null, next: UploadedAsset, nowMs: number): UploadedAsset {
  const sameFile = previous !== null && previous.name === next.name && previous.sizeBytes === next.sizeBytes;
  const mediaSeconds = next.mediaSeconds ?? (sameFile ? previous.mediaSeconds : undefined);
  if (next.status !== "processing") return mediaSeconds === next.mediaSeconds ? next : { ...next, mediaSeconds };
  const processingSince = next.processingSince ?? (sameFile && previous.status === "processing" ? previous.processingSince : undefined) ?? nowMs;
  return { ...next, mediaSeconds, processingSince };
}

/** Tiempo máximo para leer la duración: si el navegador no entiende el contenedor (MXF, algunos MKV) se sigue sin ella. */
const PROBE_TIMEOUT_MS = 4000;

/** Duración (s) de un vídeo leída en el propio navegador, sin subir nada; `undefined` si no se puede saber. */
export function readVideoSeconds(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (seconds?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds : undefined);
    };
    const timer = setTimeout(() => done(), PROBE_TIMEOUT_MS);
    video.preload = "metadata";
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done();
    video.src = url;
  });
}
