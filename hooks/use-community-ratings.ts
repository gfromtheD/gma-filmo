"use client";

import { useState, useEffect } from "react";

export interface CommunityReview {
  userId:      string;
  displayName: string;
  score:       number;
  comment:     string;
  ratedAt:     string;
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
        const res = await fetch(`/api/ratings/community?peliculaId=${numericId}`);
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
