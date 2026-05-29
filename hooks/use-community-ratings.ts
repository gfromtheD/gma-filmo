"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface CommunityReview {
  userId:      string;
  displayName: string;
  score:       number;
  comment:     string;
  ratedAt:     string;
  likeCount:   number;
  likedByMe:   boolean;
}

interface CommunityRatingsState {
  reviews:   CommunityReview[];
  avgScore:  number | null;
  voteCount: number;
  loading:   boolean;
}

export function useCommunityRatings(numericId: number, refreshKey = 0): CommunityRatingsState {
  const [state, setState] = useState<CommunityRatingsState>({
    reviews:   [],
    avgScore:  null,
    voteCount: 0,
    loading:   true,
  });

  useEffect(() => {
    setState({ reviews: [], avgScore: null, voteCount: 0, loading: true });
    void (async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

        const res = await fetch(`/api/ratings/community?peliculaId=${numericId}`, { headers });
        if (!res.ok) { setState((s) => ({ ...s, loading: false })); return; }

        const body = (await res.json()) as {
          reviews:   CommunityReview[];
          avgScore:  number | null;
          voteCount: number;
        };
        setState({
          reviews:   body.reviews   ?? [],
          avgScore:  body.avgScore  ?? null,
          voteCount: body.voteCount ?? 0,
          loading:   false,
        });
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    })();
  }, [numericId, refreshKey]);

  return state;
}
