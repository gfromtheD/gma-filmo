"use client";

import { useEffect, useRef, useState } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";

const SAVED_COLOR = "#22B16B";
/** El estado cambia casi al instante tras el clic (la interfaz es optimista); este margen cubre cualquier retraso. */
const CLICK_WINDOW_MS = 3000;

interface SaveIconProps {
  readonly saved: boolean;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
}

/**
 * Marcador de «guardar». Vacío cuando no está guardado y coloreado cuando sí.
 * Al guardar con un clic da un saltito corto y suave (como una cinta que se deja sobre la página de un libro).
 * Va dentro del botón: escucha el clic de su botón, así solo anima la tarjeta pulsada, no el mismo título en
 * otro sitio de la pantalla, ni al cargar ya guardado, ni al quitarlo. Con «reducir movimiento» solo cambia de
 * estado, sin saltito.
 */
export function SaveIcon({ saved, size = 22, strokeWidth = 1.8, className = "" }: SaveIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const lastClickAt = useRef(0);
  const wasSaved = useRef(saved);
  const [hopping, setHopping] = useState(false);

  useEffect(() => {
    const button = ref.current?.closest("button");
    if (!button) return;
    const arm = () => { lastClickAt.current = Date.now(); };
    button.addEventListener("click", arm, true);
    return () => button.removeEventListener("click", arm, true);
  }, []);

  useEffect(() => {
    const justSavedByClick = !wasSaved.current && saved && Date.now() - lastClickAt.current < CLICK_WINDOW_MS;
    wasSaved.current = saved;
    if (!justSavedByClick) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setHopping(true);
  }, [saved]);

  return (
    <span
      ref={ref}
      data-save-icon
      data-saved={saved}
      className={`save-icon inline-flex ${hopping ? "save-hop" : ""} ${className}`}
      style={{ color: saved ? SAVED_COLOR : undefined, lineHeight: 0 }}
      onAnimationEnd={() => setHopping(false)}
    >
      <GmaIcon
        name="bookmark"
        size={size}
        strokeWidth={strokeWidth}
        style={{ fill: saved ? "currentColor" : "transparent" }}
      />
    </span>
  );
}
