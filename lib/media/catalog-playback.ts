import type { PlaybackReference } from '@/types/playback';

export function toPlaybackReference(titleSlug: string, playbackKind?: string | null): PlaybackReference {
  return { titleSlug, mode: ['media', 'r2_hls', 'stream'].includes(playbackKind ?? '') ? 'managed' : 'legacy' };
}
