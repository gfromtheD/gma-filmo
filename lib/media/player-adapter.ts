/**
 * Punto de conexión entre el Player visual de Windows y la capa de reproducción del Mac, sin tocar la interfaz.
 *
 * Regla: solo los títulos gestionados por el motor (`playbackRef.mode === 'managed'`: media, r2_hls, stream) necesitan el
 * resolvedor autorizado `/api/titles/:slug/playback` (URLs firmadas, HLS privado, renovación). Los históricos siguen
 * reproduciéndose como hoy (MP4 de R2 o YouTube) con `legacyClientSource`, sin una petición extra.
 *
 * El Player de Windows podrá adoptar `useMediaPlayback(video, playbackEndpointFor(item), enabled, legacySourceFor(item))`
 * cuando se acuerde el punto de integración (ver COORDINACION-BACKEND.md).
 */
import type { MediaItem } from '@/types/catalog';
import type { PlaybackSource } from '@/types/playback';
import { legacyClientSource } from './playback-client';

export function isManagedPlayback(item: Pick<MediaItem, 'playbackRef' | 'playbackKind'>): boolean {
  if (item.playbackRef) return item.playbackRef.mode === 'managed';
  return ['media', 'stream', 'r2_hls'].includes(item.playbackKind ?? '');
}

export function playbackEndpointFor(item: Pick<MediaItem, 'id' | 'playbackRef' | 'playbackKind'>): string | null {
  return isManagedPlayback(item) ? `/api/titles/${encodeURIComponent(item.playbackRef?.titleSlug ?? item.id)}/playback` : null;
}

/**
 * Tráiler de un título del motor para el hero y la tarjeta flotante: lo resuelve `/api/titles/:slug/trailer/playback`
 * (404 si el título no tiene tráiler listo, y entonces se queda la portada). Los históricos usan `trailerUrl` (mp4).
 */
export function trailerEndpointFor(item: Pick<MediaItem, 'id' | 'playbackRef' | 'playbackKind' | 'trailerUrl'>): string | null {
  if (item.trailerUrl || !isManagedPlayback(item)) return null;
  return `/api/titles/${encodeURIComponent(item.playbackRef?.titleSlug ?? item.id)}/trailer/playback`;
}

/** Fuente histórica en el navegador. `legacyClientSource` rechaza cualquier item con `playbackRef`, así que se le pasa sin él. */
export function legacySourceFor(item: MediaItem): PlaybackSource | null {
  if (isManagedPlayback(item)) return null;
  try { return legacyClientSource({ ...item, playbackRef: undefined }); } catch { return null; }
}
