"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/** Espera con el ratón encima antes de abrir (medido en Filmin: ~300 ms). */
const OPEN_DELAY_MS = 300;
/** Margen para poder cruzar del póster al panel sin que se cierre. */
const CLOSE_DELAY_MS = 120;

interface UseHoverPreview<T extends HTMLElement> {
  readonly anchorRef: React.RefObject<T>;
  /** Caja de la portada cuando la vista previa está abierta; `null` si no. */
  readonly anchorBox: DOMRect | null;
  readonly onPointerEnter: (event: PointerEvent) => void;
  readonly onPointerLeave: (event: PointerEvent) => void;
  readonly keepOpen: () => void;
  readonly scheduleClose: () => void;
  readonly close: () => void;
}

/**
 * Abre una vista previa flotante al pasar el ratón (solo puntero de ratón: nunca
 * en táctil). Se cierra al salir, con Escape, al hacer scroll o al redimensionar.
 */
export function useHoverPreview<T extends HTMLElement>(isEnabled: boolean): UseHoverPreview<T> {
  const anchorRef = useRef<T>(null);
  const [anchorBox, setAnchorBox] = useState<DOMRect | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tras Escape no se reabre hasta que el ratón salga de la portada. */
  const isDismissed = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setAnchorBox(null);
  }, [clearTimers]);

  const keepOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setAnchorBox(null), CLOSE_DELAY_MS);
  }, []);

  const onPointerEnter = useCallback(
    (event: PointerEvent) => {
      if (!isEnabled || event.pointerType !== "mouse" || isDismissed.current) return;
      keepOpen();
      if (openTimer.current) return;
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        const el = anchorRef.current;
        if (el) setAnchorBox(el.getBoundingClientRect());
      }, OPEN_DELAY_MS);
    },
    [isEnabled, keepOpen],
  );

  const onPointerLeave = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      isDismissed.current = false;
      scheduleClose();
    },
    [scheduleClose],
  );

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!anchorBox) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      isDismissed.current = true;
      close();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [anchorBox, close]);

  return { anchorRef, anchorBox, onPointerEnter, onPointerLeave, keepOpen, scheduleClose, close };
}
