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
import { useActiveProfileId } from "@/hooks/use-active-profile-id";
import { usePopularity } from "@/hooks/use-popularity";
import { authHeaders } from "@/lib/api/auth-headers";
import { markShown, mergeShown, SHOWN_BATCH_MAX, type ShownMap } from "@/lib/recommendation/shown-memory";
import type { MediaItem } from "@/types/catalog";

// ── Shown-on-home persistence (localStorage) ──────────────────────────────────

// Cada perfil tiene su memoria: la de la cuenta (`profileId` vacío) y la de cada perfil secundario.
function shownKey(memoryId: string) { return `gma-home-shown:${memoryId}`; }

function loadShownOnHome(memoryId: string): ShownMap {
  try {
    const raw = localStorage.getItem(shownKey(memoryId));
    return raw ? (JSON.parse(raw) as ShownMap) : {};
  } catch { return {}; }
}

function saveShownOnHome(memoryId: string, items: MediaItem[]) {
  const next = markShown(loadShownOnHome(memoryId), items.map((item) => item.id), Date.now());
  try { localStorage.setItem(shownKey(memoryId), JSON.stringify(next)); } catch { /* quota */ }
}

/** Anota en la base de datos lo enseñado, para que no se pierda al cambiar de navegador. Nunca rompe la portada. */
async function syncShownToServer(profileId: string, items: MediaItem[]) {
  const ids = [...new Set(items.map((item) => item.id))].slice(0, SHOWN_BATCH_MAX);
  if (ids.length === 0) return;
  try {
    await fetch(`/api/home-shown?profile=${encodeURIComponent(profileId)}`, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ items: ids }) });
  } catch { /* sin red: la memoria local sigue valiendo */ }
}

/** Lo que la base de datos recuerda de este perfil (vacío si falla). */
async function fetchShownFromServer(profileId: string): Promise<ShownMap> {
  try {
    const res = await fetch(`/api/home-shown?profile=${encodeURIComponent(profileId)}`, { headers: await authHeaders() });
    if (!res.ok) return {};
    const body = (await res.json()) as { shown?: ShownMap };
    return body.shown ?? {};
  } catch { return {}; }
}

// Lo mostrado en visitas anteriores se lee una sola vez por carga de página: así la portada no cambia de
// sitio mientras navegas, pero al recargar o volver otro día rota lo que ya se enseñó.
const shownBeforeThisLoad = new Map<string, ShownMap>();

function shownBeforeLoad(memoryId: string): ShownMap {
  const cached = shownBeforeThisLoad.get(memoryId);
  if (cached) return cached;
  const loaded = loadShownOnHome(memoryId);
  shownBeforeThisLoad.set(memoryId, loaded);
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
  const profileId                         = useActiveProfileId();
  const popularity                        = usePopularity();
  const { entries: progressByNumericId }  = useProgress();
  // La lista tal como llegó al cargar: si se usara la viva, cada «guardar» recalcularía todas las filas y las
  // tarjetas se reordenarían bajo el cursor (la tarjeta flotante desaparecía). Lo guardado cuenta en la próxima visita.
  const { loadedMediaIds: watchlistNumericIds } = useWatchlist();

  const [homeRows, setHomeRows] = useState<HomeRow[]>([]);
  const [picks, setPicks]       = useState<MediaItem[]>([]);
  const [newArrivals, setNewArrivals] = useState<MediaItem[]>(() => allItems.slice(0, NEW_ARRIVALS_COUNT));
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({});
  const [sessionSeed, setSessionSeed]         = useState(0.5);
  // Sube una vez la memoria de la base de datos a esta página (solo si este navegador no recordaba nada de este perfil).
  const [serverShownVersion, setServerShownVersion] = useState(0);

  const memoryId = `${userId ?? "anonymous"}:${profileId}`;
  useEffect(() => {
    if (!userId || Object.keys(shownBeforeLoad(memoryId)).length > 0) return;
    let cancelled = false;
    void fetchShownFromServer(profileId).then((remote) => {
      if (cancelled || Object.keys(remote).length === 0) return;
      const merged = mergeShown(shownBeforeLoad(memoryId), remote, Date.now());
      shownBeforeThisLoad.set(memoryId, merged);
      try { localStorage.setItem(shownKey(memoryId), JSON.stringify(merged)); } catch { /* quota */ }
      setServerShownVersion((v) => v + 1);
    });
    return () => { cancelled = true; };
  }, [userId, profileId, memoryId]);

  useEffect(() => {
    const uid = userId ?? "anonymous";
    const shownOnHome = shownBeforeLoad(memoryId);

    const profile = buildUserProfileFromSupabase({
      userId:              uid,
      allItems,
      progressByNumericId,
      watchlistNumericIds,
      shownOnHome,
    });

    const rows = buildHomeRows(allItems, profile, undefined, undefined, popularity);
    const arrivals = pickNewArrivals(allItems, getPageLoadSeed(), shownOnHome, NEW_ARRIVALS_COUNT);
    setHomeRows(rows);
    setNewArrivals(arrivals);
    setPicks(recommendItems(allItems, profile, { count: pickCount, popularity }));
    setCategoryWeights(buildUserAffinity(profile.events, allItems).categoryWeights);
    setSessionSeed(getOrCreateSessionSeed(uid));

    // Mark every item in these rows as shown so they rotate out next time
    const shownNow = [...arrivals, ...rows.flatMap((r) => r.items)];
    saveShownOnHome(memoryId, shownNow);
    if (userId) void syncShownToServer(profileId, shownNow);
  }, [userId, profileId, memoryId, allItems, progressByNumericId, watchlistNumericIds, pickCount, popularity, serverShownVersion]);

  return { homeRows, newArrivals, picks, categoryWeights, sessionSeed };
}
