"use client";

import { useEffect, useState, type RefObject } from "react";
import { usePreviewTurnStore } from "@/store/use-preview-turn-store";

/** Por debajo de esta parte visible el hero se considera fuera de pantalla. */
const VISIBLE_RATIO = 0.25;

/**
 * El hero debe ceder su tráiler (pausarlo, sin cambiar de diapositiva ni de sonido) cuando otra vista previa tiene el
 * turno, cuando sale de la pantalla al bajar o cuando la pestaña no se está viendo.
 */
export function useHeroSuspended(ref: RefObject<HTMLElement>): boolean {
  const otherHasTurn = usePreviewTurnStore((state) => state.holder !== null);
  const [isOffscreen, setIsOffscreen] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setIsOffscreen((entry?.intersectionRatio ?? 1) < VISIBLE_RATIO), {
      threshold: [0, VISIBLE_RATIO, 1],
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const update = () => setIsTabHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return otherHasTurn || isOffscreen || isTabHidden;
}
