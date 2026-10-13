"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface CommunityScore {
  readonly avgScore: number | null;
  readonly voteCount: number;
}

const cache = new Map<number, CommunityScore>();
const inflight = new Map<number, Promise<CommunityScore | null>>();

/**
 * Lee la nota media y el nº de votos (solo lectura, mismo endpoint que la ficha)
 * con caché en memoria, para poder precargarla antes de abrir una vista previa.
 */
export function loadCommunityScore(numericId: number): Promise<CommunityScore | null> {
  const cached = cache.get(numericId);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(numericId);
  if (pending) return pending;

  const request = (async (): Promise<CommunityScore | null> => {
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/ratings/community?peliculaId=${numericId}`, { headers });
      if (!res.ok) return null;
      const body = (await res.json()) as { avgScore: number | null; voteCount: number };
      const score: CommunityScore = { avgScore: body.avgScore ?? null, voteCount: body.voteCount ?? 0 };
      cache.set(numericId, score);
      return score;
    } catch {
      return null;
    } finally {
      inflight.delete(numericId);
    }
  })();

  inflight.set(numericId, request);
  return request;
}

/** Nota de la comunidad; si ya estaba precargada se devuelve en el primer render. */
export function useCommunityScore(numericId: number): CommunityScore & { readonly isLoading: boolean } {
  const [score, setScore] = useState<CommunityScore | null>(() => cache.get(numericId) ?? null);
  const [isLoading, setIsLoading] = useState(() => !cache.has(numericId));

  useEffect(() => {
    if (cache.has(numericId)) return;
    let isActive = true;
    void loadCommunityScore(numericId).then((result) => {
      if (!isActive) return;
      setScore(result);
      setIsLoading(false);
    });
    return () => {
      isActive = false;
    };
  }, [numericId]);

  return { avgScore: score?.avgScore ?? null, voteCount: score?.voteCount ?? 0, isLoading };
}
