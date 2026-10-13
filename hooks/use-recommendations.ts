"use client";

import { useState, useEffect } from "react";
import {
  buildUserAffinity,
  buildUserProfileFromSupabase,
  buildHomeRows,
  getOrCreateSessionSeed,
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

// ─────────────────────────────────────────────────────────────────────────────

interface UseRecommendationsResult {
  homeRows: HomeRow[];
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
  const { mediaIds: watchlistNumericIds } = useWatchlist();

  const [homeRows, setHomeRows] = useState<HomeRow[]>([]);
  const [picks, setPicks]       = useState<MediaItem[]>([]);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({});
  const [sessionSeed, setSessionSeed]         = useState(0.5);

  useEffect(() => {
    const uid = userId ?? "anonymous";
    const shownOnHome = loadShownOnHome(uid);

    const profile = buildUserProfileFromSupabase({
      userId:              uid,
      allItems,
      progressByNumericId,
      watchlistNumericIds,
      shownOnHome,
    });

    const rows = buildHomeRows(allItems, profile);
    setHomeRows(rows);
    setPicks(recommendItems(allItems, profile, { count: pickCount }));
    setCategoryWeights(buildUserAffinity(profile.events, allItems).categoryWeights);
    setSessionSeed(getOrCreateSessionSeed(uid));

    // Mark every item in these rows as shown so they rotate out next time
    saveShownOnHome(uid, rows.flatMap((r) => r.items));
  }, [userId, allItems, progressByNumericId, watchlistNumericIds, pickCount]);

  return { homeRows, picks, categoryWeights, sessionSeed };
}
