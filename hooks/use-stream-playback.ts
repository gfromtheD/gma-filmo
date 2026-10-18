'use client';
import { useEffect, useState, type RefObject } from 'react';
import { useMediaPlayback } from './use-media-playback';

/** Compatibility export for the earlier HLS/Stream callers. New players use useMediaPlayback. */
export function useHlsPlayback(ref: RefObject<HTMLVideoElement>, slug: string, enabled: boolean) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const playback = useMediaPlayback(video, `/api/titles/${encodeURIComponent(slug)}/playback`, enabled);
  useEffect(() => { setVideo(ref.current); }, [ref, playback.source, enabled]);
  return { url: playback.source?.kind === 'hls' ? playback.source.url : null, error: playback.error, retry: playback.retry };
}
export const useStreamPlayback = useHlsPlayback;
