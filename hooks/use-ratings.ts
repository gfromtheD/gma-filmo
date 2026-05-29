"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";

export interface RatingEntry {
  rating:  number;
  review:  string;
  ratedAt: number;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

type RatingRow = { pelicula_id: number; score: number; comment: string; rated_at: string };

export function useRatings() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const [entries, setEntries] = useState<Record<number, RatingEntry>>({});

  useEffect(() => {
    if (!userId) return;
    setEntries({});
    void (async () => {
      const headers = await authHeader();
      const res = await fetch(`/api/ratings?profileId=${encodeURIComponent(profileId)}`, { headers });
      if (!res.ok) return;
      const body = (await res.json()) as { entries: RatingRow[] };
      if (!Array.isArray(body.entries)) return;
      const map: Record<number, RatingEntry> = {};
      for (const r of body.entries) {
        map[r.pelicula_id] = {
          rating:  r.score,
          review:  r.comment ?? "",
          ratedAt: new Date(r.rated_at).getTime(),
        };
      }
      setEntries(map);
    })();
  }, [userId, profileId]);

  const setRating = useCallback((numericId: number, rating: number, review: string) => {
    const ratedAt = Date.now();
    setEntries((prev) => ({ ...prev, [numericId]: { rating, review, ratedAt } }));
    void (async () => {
      const headers = await authHeader();
      await fetch("/api/ratings", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, score: rating, comment: review, profileId }),
      });
    })();
  }, [profileId]);

  const removeRating = useCallback((numericId: number) => {
    setEntries((prev) => {
      const next = { ...prev };
      delete next[numericId];
      return next;
    });
    void (async () => {
      const headers = await authHeader();
      await fetch("/api/ratings", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
    })();
  }, [profileId]);

  const getRating = useCallback(
    (numericId: number): RatingEntry | null => entries[numericId] ?? null,
    [entries],
  );

  return { entries, setRating, removeRating, getRating };
}
