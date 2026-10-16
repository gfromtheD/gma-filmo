"use client";

import { useState, useEffect } from "react";
import {
  buildUserAffinity,
  buildUserProfileFromSupabase,
  buildHomeRows,
  getOrCreateSessionSeed,
  getPageLoadSeed,
  pickNewArrivals,
  recommendItems,
  type HomeRow,
} from "@/lib/recommendation/recommendation-engine";
import { useProgress }  from "@/hooks/use-progress";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import type { MediaItem } from "@/types/catalog";

// ── Shown-on-home persistence (localStorage) ──────────────────────────────────

function shownKey(userId: string) { return `gma-home-shown:${userId}`; }

function loadShownOnHome(userId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(shownKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}

function saveShownOnHome(userId: string, items: MediaItem[]) {
  const existing = loadShownOnHome(userId);
  const now = Date.now();
  for (const item of items) existing[item.id] = now;
  // Prune entries older than 48 hours to keep localStorage lean
  const cutoff = now - 48 * 3_600_000;
  for (const [id, ts] of Object.entries(existing)) {
    if (ts < cutoff) delete existing[id];
  }
  try { localStorage.setItem(shownKey(userId), JSON.stringify(existing)); } catch { /* quota */ }
}

// Lo mostrado en visitas anteriores se lee una sola vez por carga de página: así la portada no cambia de
// sitio mientras navegas, pero al recargar o volver otro día rota lo que ya se enseñó.
const shownBeforeThisLoad = new Map<string, Record<string, number>>();

function shownBeforeLoad(userId: string): Record<string, number> {
  const cached = shownBeforeThisLoad.get(userId);
  if (cached) return cached;
  const loaded = loadShownOnHome(userId);
  shownBeforeThisLoad.set(userId, loaded);
  return loaded;
}

const NEW_ARRIVALS_COUNT = 15;

// ─────────────────────────────────────────────────────────────────────────────

interface UseRecommendationsResult {
  homeRows: HomeRow[];
  /** «Recién llegados»: una selección rotativa entre los títulos más nuevos. */
  newArrivals: MediaItem[];
  picks: MediaItem[];
  /** Afinidad del espectador por categoría (vacío si no hay historial). */
  categoryWeights: Record<string, number>;
  /** Semilla de sesión estable (rota cada 2 h) para variar sin saltos. */
  sessionSeed: number;
}

export function useRecommendations(
  allItems: readonly MediaItem[],
  pickCount = 8,
): UseRecommendationsResult {
  const userId                            = useSupabaseUserId();
  const { entries: progressByNumericId }  = useProgress();
  // La lista tal como llegó al cargar: si se usara la viva, cada «guardar» recalcularía todas las filas y las
  // tarjetas se reordenarían bajo el cursor (la tarjeta flotante desaparecía). Lo guardado cuenta en la próxima visita.
  const { loadedMediaIds: watchlistNumericIds } = useWatchlist();

  const [homeRows, setHomeRows] = useState<HomeRow[]>([]);
  const [picks, setPicks]       = useState<MediaItem[]>([]);
  const [newArrivals, setNewArrivals] = useState<MediaItem[]>(() => allItems.slice(0, NEW_ARRIVALS_COUNT));
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({});
  const [sessionSeed, setSessionSeed]         = useState(0.5);

  useEffect(() => {
    const uid = userId ?? "anonymous";
    const shownOnHome = shownBeforeLoad(uid);

    const profile = buildUserProfileFromSupabase({
      userId:              uid,
      allItems,
      progressByNumericId,
      watchlistNumericIds,
      shownOnHome,
    });

    const rows = buildHomeRows(allItems, profile);
    const arrivals = pickNewArrivals(allItems, getPageLoadSeed(), shownOnHome, NEW_ARRIVALS_COUNT);
    setHomeRows(rows);
    setNewArrivals(arrivals);
    setPicks(recommendItems(allItems, profile, { count: pickCount }));
    setCategoryWeights(buildUserAffinity(profile.events, allItems).categoryWeights);
    setSessionSeed(getOrCreateSessionSeed(uid));

    // Mark every item in these rows as shown so they rotate out next time
    saveShownOnHome(uid, [...arrivals, ...rows.flatMap((r) => r.items)]);
  }, [userId, allItems, progressByNumericId, watchlistNumericIds, pickCount]);

  return { homeRows, newArrivals, picks, categoryWeights, sessionSeed };
}
