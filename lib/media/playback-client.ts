import type { MediaItem } from '@/types/catalog';
import type { PlaybackSource } from '@/types/playback';
import { playbackSourceSchema } from './contracts';

/** Compatibility for in-memory legacy callers. Catalog rows always use their authorized resolver. */
export function legacyClientSource(item: MediaItem): PlaybackSource | null {
  if (item.playbackRef || ['media', 'stream', 'r2_hls'].includes(item.playbackKind ?? '')) return null;
  const common = { version: 1, mediaId: null, titleSlug: item.id, titleId: item.numericId, revision: 0, expiresAt: null,
    refreshUrl: `/api/titles/${encodeURIComponent(item.id)}/playback`, posterUrl: null, thumbnails: null,
    subtitles: item.subtitleUrl ? [{ id: 'legacy', language: 'und', label: 'Subtítulos', default: false, format: 'vtt',
      url: item.subtitleUrl.startsWith('/api/media/') ? item.subtitleUrl : `/api/subtitle-proxy?url=${encodeURIComponent(item.subtitleUrl)}` }] : [] };
  if (item.r2VideoUrl) {
    try {
      const url = new URL(item.r2VideoUrl);
      const configuredHost = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname : null;
      const fixture = ['127.0.0.1', 'localhost'].includes(url.hostname)
        && ['3218', '3219'].includes(url.port) && /^\/(?:__responsive-video|__support-video)\.mp4$/.test(url.pathname);
      const r2 = url.protocol === 'https:' && !url.username && !url.password && !url.port
        && (url.hostname === 'pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev' || url.hostname === configuredHost);
      if (fixture || r2) return playbackSourceSchema.parse({ ...common, kind: 'mp4', url: url.href, mimeType: 'video/mp4' });
    } catch { /* untrusted legacy URLs are resolved by the authorized server route */ }
    return null;
  }
  let id: string | null = null;
  try {
    const url = new URL(item.videoUrl ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port) {
      if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
      else if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) id = url.searchParams.get('v') ?? /^\/(?:embed|shorts)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
    }
  } catch { /* no valid historical source */ }
  return id && /^[\w-]{11}$/.test(id) ? playbackSourceSchema.parse({ ...common, kind: 'youtube', videoId: id }) : null;
}

export type RecoveryAction = { kind: 'stop' } | { kind: 'refresh' } | { kind: 'media' } | { kind: 'network'; delay: number } | { kind: 'fallback' };
export class PlaybackRecovery {
  private network = 0;
  private media = 0;
  private refreshed = false;
  private fallback = false;
  decide(category: 'network' | 'media' | 'unsupported', status?: number, allowFallback = false): RecoveryAction {
    if (status === 404) return { kind: 'stop' };
    if (status === 401 || status === 403) {
      if (this.refreshed) return { kind: 'stop' };
      this.refreshed = true; return { kind: 'refresh' };
    }
    if (category === 'network' && this.network < 3) return { kind: 'network', delay: [1000, 2000, 4000][this.network++]! };
    if (category === 'media' && this.media++ === 0) return { kind: 'media' };
    if (allowFallback && !this.fallback) { this.fallback = true; return { kind: 'fallback' }; }
    return { kind: 'stop' };
  }
}
