"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Se cumple esta media query ahora mismo? Se actualiza sola al cambiar el tamaño de la ventana.
 * En el servidor (y antes de hidratar) devuelve `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
