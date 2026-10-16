"use client";

import { useEffect, useState } from "react";
import type { MovieExtra } from "@/types/catalog";

/**
 * Extras de un título: parte de lo cargado en el servidor y se refresca desde `/api/extras`
 * (así los extras recién publicados aparecen sin esperar a la caché de la página).
 * Si la petición falla se conserva lo inicial.
 */
export function useExtras(peliculaId: number, initial: readonly MovieExtra[]): readonly MovieExtra[] {
  const [extras, setExtras] = useState<readonly MovieExtra[]>(initial);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/extras?peliculaId=${peliculaId}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { extras?: MovieExtra[] } | null) => {
        if (body && Array.isArray(body.extras)) setExtras(body.extras);
      })
      .catch(() => undefined); // sin red o abortado: se mantiene lo inicial
    return () => controller.abort();
  }, [peliculaId]);

  return extras;
}
