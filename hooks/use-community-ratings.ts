"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ReviewSort } from "@/lib/ratings/review-query";

export interface CommunityReview {
  userId:      string;
  /** Perfil que valoró ("" = perfil principal). Una cuenta puede tener varios. */
  profileId?:  string;
  displayName: string;
  avatarUrl:   string | null;
  /** Icono del catálogo cuando el perfil elige uno en vez de una foto. */
  avatarIconId?: string | null;
  avatarColor: string | null;
  score:       number;
  comment:     string;
  ratedAt:     string;
  likeCount:   number;
  likedByMe:   boolean;
}

interface CommunityRatingsState {
  reviews:     CommunityReview[];
  avgScore:    number | null;
  voteCount:   number;
  /** Reseñas con comentario en total (no solo las cargadas). */
  total:       number;
  hasMore:     boolean;
  loading:     boolean;
  loadingMore: boolean;
  /** `true` si la carga falló (distinto de "no hay reseñas"). */
  hasError:    boolean;
}

interface Options {
  /** Reseñas por página. Sin indicarlo la API devuelve 5 (comportamiento histórico). */
  readonly pageSize?: number;
  readonly sort?:     ReviewSort;
}

interface CommunityRatingsResponse {
  reviews:   CommunityReview[];
  avgScore:  number | null;
  voteCount: number;
  total?:    number;
  hasMore?:  boolean;
}

const INITIAL: CommunityRatingsState = {
  reviews: [], avgScore: null, voteCount: 0, total: 0,
  hasMore: false, loading: true, loadingMore: false, hasError: false,
};

async function fetchPage(numericId: number, offset: number, options: Options): Promise<CommunityRatingsResponse | null> {
  try {
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

    const params = new URLSearchParams({ peliculaId: String(numericId) });
    if (options.pageSize) params.set("limit", String(options.pageSize));
    if (offset > 0) params.set("offset", String(offset));
    if (options.sort) params.set("sort", options.sort);

    const res = await fetch(`/api/ratings/community?${params.toString()}`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as CommunityRatingsResponse;
  } catch {
    return null;
  }
}

export function useCommunityRatings(numericId: number, refreshKey = 0, options: Options = {}) {
  const { pageSize, sort } = options;
  const [state, setState] = useState<CommunityRatingsState>(INITIAL);
  const loadedFor = useRef<string | null>(null);
  /** Se incrementa en cada recarga: descarta respuestas de páginas pedidas antes del cambio. */
  const generation = useRef(0);

  useEffect(() => {
    let isActive = true;
    // Al cambiar de título se parte de cero; al refrescar el mismo (p. ej. tras valorar)
    // se conservan los datos actuales mientras llegan los nuevos, para que no parpadeen.
    generation.current += 1;
    // Cambia el título o el orden → se parte de cero. Mismo título y orden (p. ej. tras valorar)
    // → se conservan los datos actuales mientras llegan los nuevos, para que no parpadeen.
    const key = `${numericId}|${sort ?? "top"}|${pageSize ?? 0}`;
    if (loadedFor.current !== key) setState(INITIAL);
    loadedFor.current = key;
    void fetchPage(numericId, 0, { pageSize, sort }).then((body) => {
      if (!isActive) return;
      if (!body) {
        setState({ ...INITIAL, loading: false, hasError: true });
        return;
      }
      setState({
        reviews:     body.reviews   ?? [],
        avgScore:    body.avgScore  ?? null,
        voteCount:   body.voteCount ?? 0,
        total:       body.total     ?? (body.reviews ?? []).length,
        hasMore:     body.hasMore   ?? false,
        loading:     false,
        loadingMore: false,
        hasError:    false,
      });
    });
    return () => { isActive = false; };
  }, [numericId, refreshKey, pageSize, sort]);

  /** Carga la página siguiente y la añade al final, sin repetir reseñas ya mostradas. */
  const loadMore = useCallback(async () => {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    const requestedIn = generation.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const body = await fetchPage(numericId, state.reviews.length, { pageSize, sort });
    if (requestedIn !== generation.current) return; // la lista se recargó mientras tanto
    setState((s) => {
      if (!body) return { ...s, loadingMore: false, hasError: true };
      const seen = new Set(s.reviews.map((r) => `${r.userId}|${r.ratedAt}`));
      const fresh = (body.reviews ?? []).filter((r) => !seen.has(`${r.userId}|${r.ratedAt}`));
      return {
        ...s,
        reviews:     [...s.reviews, ...fresh],
        total:       body.total   ?? s.total,
        hasMore:     body.hasMore ?? false,
        loadingMore: false,
        hasError:    false,
      };
    });
  }, [numericId, pageSize, sort, state.loading, state.loadingMore, state.hasMore, state.reviews.length]);

  return { ...state, loadMore };
}
