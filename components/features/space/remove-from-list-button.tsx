"use client";

import { useEffect, useRef, useState } from "react";

/** Lo que dura la animación antes de quitar el título (la tapa se abre y la papelera da su saltito). */
const REMOVE_DELAY_MS = 260;

/** Papelera con la tapa separada para poder abrirla. Mismo trazo fino que el resto de iconos. */
function TrashSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8l1 11.2a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 8" />
      <path d="M10 11.5v5M14 11.5v5" />
      <g data-trash-lid className="trash-lid">
        <path d="M4.5 6.5h15" />
        <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      </g>
    </svg>
  );
}

interface RemoveFromListButtonProps {
  readonly onRemove: () => void;
  /** Clases de posición y visibilidad (aparece al pasar el cursor sobre el cartel). */
  readonly className?: string;
  /** Nombre accesible; por defecto, quitar de Guardados. */
  readonly label?: string;
}

/**
 * Papelera pequeña para quitar un título de la lista. Lo que se ve mide 28 px (la zona pulsable, 44 px) y
 * al pulsarla da un saltito suave y abre la tapa, en la línea del icono de guardar pero con tono de borrado.
 * El título se quita al terminar la animación. Con «reducir movimiento» se quita al instante.
 */
export function RemoveFromListButton({ onRemove, className = "", label = "Quitar de Mi Lista" }: RemoveFromListButtonProps) {
  const [removing, setRemoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  // Si el cartel desaparece con la animación en marcha, la orden del usuario no se pierde.
  useEffect(() => () => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      onRemoveRef.current();
    }
  }, []);

  function handleClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (removing) return; // una segunda pulsación no envía otra petición
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onRemove();
      return;
    }
    setRemoving(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      onRemoveRef.current();
    }, REMOVE_DELAY_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-white ${className}`}
    >
      <span
        data-trash-visual
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/80 hover:text-[#ff8a8a] ${removing ? "trash-removing" : ""}`}
      >
        <TrashSvg />
      </span>
    </button>
  );
}
