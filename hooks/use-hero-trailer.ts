"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useSettingsPrefs } from "@/hooks/use-settings-prefs";

/** Tiempo que se ve la portada antes de que arranque el tráiler. */
export const TRAILER_DELAY_MS = 3000;

interface NetworkInformationLike {
  readonly saveData?: boolean;
}

interface HeroTrailer {
  readonly videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  /** Hay tráiler que mostrar (existe y no ha fallado). */
  readonly hasTrailer: boolean;
  /** El elemento <video> está en pantalla (arrancó solo o a petición). */
  readonly isMounted: boolean;
  /** El vídeo ya ha empezado a reproducirse alguna vez (sirve para el fundido). */
  readonly isVisible: boolean;
  readonly isPlaying: boolean;
  /** Debe mostrarse el botón play/pausa. */
  readonly showControl: boolean;
  /** El tráiler ocupa el hero: el carrusel no debe pasar de diapositiva. */
  readonly isActive: boolean;
  readonly hasEnded: boolean;
  readonly toggle: () => void;
  readonly handlers: {
    readonly onPlaying: () => void;
    readonly onPause: () => void;
    readonly onEnded: () => void;
    readonly onError: () => void;
  };
}

/**
 * Tráiler opcional del hero. Sin `trailerUrl` no hace nada y no se muestra control.
 * Con tráiler: tras unos segundos de portada arranca solo (silenciado) si el usuario
 * no lo desactivó en Ajustes ("Reproducir vistas previas"), no pidió menos movimiento
 * y no ahorra datos. En esos casos el tráiler queda disponible a petición.
 */
export function useHeroTrailer(trailerUrl: string | undefined): HeroTrailer {
  const { prefs } = useSettingsPrefs();
  const reduceMotion = useReducedMotion();
  const [saveData, setSaveData] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  /** El usuario lo pausó: vuelve la portada y el carrusel sigue con el tiempo normal de cada diapositiva. */
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    setSaveData(Boolean(connection?.saveData));
  }, []);

  const canAutoplay = prefs.autoPreviews && !reduceMotion && !saveData;
  const hasTrailer = Boolean(trailerUrl) && !hasFailed;

  // Arranque automático tras la portada
  useEffect(() => {
    if (!trailerUrl || !canAutoplay) return;
    const id = setTimeout(() => setIsMounted(true), TRAILER_DELAY_MS);
    return () => clearTimeout(id);
  }, [trailerUrl, canAutoplay]);

  const toggle = useCallback(() => {
    if (!isMounted) {
      setHasEnded(false);
      setIsMounted(true); // a petición: el vídeo se monta con autoPlay
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (hasEnded) {
      video.currentTime = 0;
      setHasEnded(false);
    }
    if (video.paused || video.ended) {
      setIsDismissed(false);
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsDismissed(true);
    }
  }, [isMounted, hasEnded]);

  return {
    videoRef,
    hasTrailer,
    isMounted,
    isVisible: isVisible && !hasEnded && !isDismissed,
    isPlaying,
    showControl: hasTrailer && (isMounted || !canAutoplay),
    isActive: hasTrailer && isMounted && !hasEnded && !isDismissed,
    hasEnded,
    toggle,
    handlers: {
      onPlaying: () => { setIsPlaying(true); setIsVisible(true); setHasEnded(false); },
      onPause: () => setIsPlaying(false),
      onEnded: () => { setIsPlaying(false); setHasEnded(true); },
      onError: () => { setHasFailed(true); setIsPlaying(false); setIsMounted(false); },
    },
  };
}
