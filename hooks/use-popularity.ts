"use client";

import { useEffect, useState } from "react";
import type { PopularityByNumericId } from "@/lib/recommendation/popularity";

// Una sola petición por carga de página: la portada y sus filas comparten el resultado.
let pending: Promise<Map<number, number>> | null = null;

function loadPopularity(): Promise<Map<number, number>> {
  pending ??= fetch("/api/popularity")
    .then((res) => (res.ok ? (res.json() as Promise<{ popularity?: [number, number][] }>) : { popularity: [] }))
    .then((body) => new Map(body.popularity ?? []))
    .catch(() => new Map<number, number>());
  return pending;
}

/** Popularidad real de los últimos 7 días, o `undefined` mientras carga o si no hay datos (el motor usa entonces la posición). */
export function usePopularity(): PopularityByNumericId | undefined {
  const [popularity, setPopularity] = useState<PopularityByNumericId | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void loadPopularity().then((map) => { if (!cancelled && map.size > 0) setPopularity(map); });
    return () => { cancelled = true; };
  }, []);
  return popularity;
}
