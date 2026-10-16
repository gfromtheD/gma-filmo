"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/** Espera con el ratón encima antes de abrir (medido en Filmin: ~300 ms). */
const OPEN_DELAY_MS = 300;
/** Margen para poder cruzar del póster al panel sin que se cierre. */
const CLOSE_DELAY_MS = 120;
/** Lo que dura el desvanecimiento de salida antes de desmontar el panel. */
const EXIT_MS = 130;
/** Lo que puede moverse la portada con un scroll antes de cerrar la tarjeta. */
const MOVE_TOLERANCE_PX = 1;

interface UseHoverPreview<T extends HTMLElement> {
  readonly anchorRef: React.RefObject<T>;
  /** Caja de la portada cuando la vista previa está abierta; `null` si no. */
  readonly anchorBox: DOMRect | null;
  /** El cursor ya salió y el panel se está desvaneciendo. */
  readonly isClosing: boolean;
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
  const [isClosing, setIsClosing] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tras Escape no se reabre hasta que el ratón salga de la portada. */
  const isDismissed = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
    exitTimer.current = null;
  }, []);

  /** Cierre inmediato (Escape, scroll, clic en un enlace): sin animación de salida. */
  const close = useCallback(() => {
    clearTimers();
    setIsClosing(false);
    setAnchorBox(null);
  }, [clearTimers]);

  const keepOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    // Si el cursor vuelve mientras se desvanecía, la tarjeta se queda abierta.
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = null;
    setIsClosing(false);
  }, []);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setIsClosing(true);
      exitTimer.current = setTimeout(() => {
        exitTimer.current = null;
        setIsClosing(false);
        setAnchorBox(null);
      }, EXIT_MS);
    }, CLOSE_DELAY_MS);
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
    // Cualquier scroll de la página llega aquí (también el de carruseles ajenos que se recolocan solos): solo se
    // cierra si la portada de esta tarjeta se ha movido de verdad.
    const closeIfAnchorMoved = () => {
      const now = anchorRef.current?.getBoundingClientRect();
      if (!now) return close();
      if (Math.abs(now.left - anchorBox.left) > MOVE_TOLERANCE_PX || Math.abs(now.top - anchorBox.top) > MOVE_TOLERANCE_PX) close();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      isDismissed.current = true;
      close();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", closeIfAnchorMoved, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", closeIfAnchorMoved, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [anchorBox, close]);

  return { anchorRef, anchorBox, isClosing, onPointerEnter, onPointerLeave, keepOpen, scheduleClose, close };
}
