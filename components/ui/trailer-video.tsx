"use client";

import { useCallback, useEffect, useState, type MutableRefObject, type VideoHTMLAttributes } from "react";
import { useMediaPlayback } from "@/hooks/use-media-playback";

const MUTED_AUTOPLAY = { playing: true, volume: 1, muted: true, rate: 1 } as const;

interface TrailerVideoProps extends Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "ref"> {
  /** Tráiler histórico (mp4). */
  readonly src?: string;
  /** Tráiler del motor (HLS desde el VPS): se pide a este punto y lo reproduce `useMediaPlayback`. */
  readonly endpoint?: string | null;
  readonly videoRef?: MutableRefObject<HTMLVideoElement | null>;
  /** Sin tráiler (404) o sin poder reproducirlo: quien lo muestra vuelve a la portada. */
  readonly onError?: () => void;
}

/** Tráiler silenciado del hero y de la tarjeta flotante: mp4 directo o, para títulos del motor, HLS por la pasarela. */
export function TrailerVideo({ src, endpoint = null, videoRef, onError, ...videoProps }: TrailerVideoProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const managed = useMediaPlayback(video, endpoint, Boolean(endpoint) && video !== null, null, MUTED_AUTOPLAY);

  useEffect(() => {
    if (endpoint && managed.error) onError?.();
  }, [endpoint, managed.error, onError]);

  const attach = useCallback((element: HTMLVideoElement | null) => {
    setVideo(element);
    if (videoRef) videoRef.current = element;
  }, [videoRef]);

  return <video ref={attach} src={endpoint ? undefined : src} muted playsInline onError={endpoint ? undefined : onError} {...videoProps} />;
}
