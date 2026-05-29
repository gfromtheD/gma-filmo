"use client";

import { useState, useEffect } from "react";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import type { MovieMedia } from "@/types/catalog";
import type { ProgressEntry } from "@/hooks/use-progress";

const FEATURED_COUNT = 8;

// Keyed by userId so logging out and back in generates a fresh shuffle
function getSessionSeed(userId: string): number {
  const KEY = `gma-rec-seed:${userId}`;
  const stored = sessionStorage.getItem(KEY);
  if (stored) return parseFloat(stored);
  const seed = Math.random();
  sessionStorage.setItem(KEY, String(seed));
  return seed;
}

// Deterministic float in [0,1) from seed + index — no external dependency
function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 10000;
  return x - Math.floor(x);
}

function computeFeatured(
  items: readonly MovieMedia[],
  progressEntries: Record<number, ProgressEntry>,
  userId: string,
): MovieMedia[] {
  const seed = getSessionSeed(userId);

  const completedIds = new Set(
    Object.entries(progressEntries)
      .filter(([, e]) => e.completed)
      .map(([id]) => Number(id)),
  );

  const recentlyWatched = [...items]
    .filter((m) => progressEntries[m.numericId] != null)
    .sort(
      (a, b) =>
        (progressEntries[b.numericId]?.updatedAt ?? 0) -
        (progressEntries[a.numericId]?.updatedAt ?? 0),
    )
    .slice(0, 5);

  const preferredCats    = new Set(recentlyWatched.flatMap((m) => m.categories));
  const preferredArtists = new Set(
    recentlyWatched.flatMap((m) => m.artistas?.map((a) => a.name) ?? []),
  );

  const scored = items
    .filter((m) => !completedIds.has(m.numericId))
    .map((item, i) => {
      const base     = seededRandom(seed, i);
      const catBoost = item.categories.filter((c) => preferredCats.has(c)).length * 0.35;
      const artBoost = (item.artistas?.filter((a) => preferredArtists.has(a.name)).length ?? 0) * 0.55;
      return { item, score: base + catBoost + artBoost };
    });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, FEATURED_COUNT).map((s) => s.item);
}

export function useRecommendedHero(
  items: readonly MovieMedia[],
  progressEntries: Record<number, ProgressEntry>,
): MovieMedia[] {
  const userId = useSupabaseUserId() ?? "anon";

  const [featured, setFeatured] = useState<MovieMedia[]>(
    () => items.slice(0, FEATURED_COUNT) as MovieMedia[],
  );

  useEffect(() => {
    if (items.length === 0) return;
    setFeatured(computeFeatured(items, progressEntries, userId));
  }, [items, progressEntries, userId]);

  return featured;
}
