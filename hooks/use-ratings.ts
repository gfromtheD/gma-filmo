"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

/** Una escritura salió bien solo si la respuesta es 2xx y el servidor confirma `ok`. */
async function confirmed(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
  return body?.ok === true;
}

export function useRatings() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const [entries, setEntries] = useState<Record<number, RatingEntry>>({});
  // Última copia conocida, para poder deshacer un cambio optimista si el servidor lo rechaza.
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const profileRef = useRef(profileId);
  useEffect(() => { profileRef.current = profileId; }, [profileId]);

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
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
      if (isActive) setEntries(map);
    })();
    return () => { isActive = false; };
  }, [userId, profileId]);

  /**
   * Guarda la valoración. El cambio se refleja al instante y, si el servidor lo
   * rechaza (límite de peticiones, sesión caducada, red), se deshace.
   * Devuelve `true` solo si quedó guardada.
   */
  const setRating = useCallback(async (numericId: number, rating: number, review: string): Promise<boolean> => {
    const previous = entriesRef.current[numericId] ?? null;
    const optimistic: RatingEntry = { rating, review, ratedAt: Date.now() };
    setEntries((prev) => ({ ...prev, [numericId]: optimistic }));

    let saved = false;
    try {
      const headers = await authHeader();
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, score: rating, comment: review, profileId }),
      });
      saved = await confirmed(res);
    } catch {
      saved = false;
    }

    if (profileRef.current !== profileId) return saved; // cambió el perfil activo: no tocar su estado
    if (!saved) {
      setEntries((prev) => {
        if (prev[numericId] !== optimistic) return prev; // otro cambio posterior: no pisarlo
        const next = { ...prev };
        if (previous) next[numericId] = previous;
        else delete next[numericId];
        return next;
      });
    }
    return saved;
  }, [profileId]);

  /** Quita la valoración (con deshacer si el servidor falla). Devuelve `true` si se eliminó. */
  const removeRating = useCallback(async (numericId: number): Promise<boolean> => {
    const previous = entriesRef.current[numericId] ?? null;
    setEntries((prev) => {
      const next = { ...prev };
      delete next[numericId];
      return next;
    });

    let removed = false;
    try {
      const headers = await authHeader();
      const res = await fetch("/api/ratings", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
      removed = await confirmed(res);
    } catch {
      removed = false;
    }

    if (profileRef.current !== profileId) return removed;
    if (!removed && previous) {
      setEntries((prev) => (prev[numericId] ? prev : { ...prev, [numericId]: previous }));
    }
    return removed;
  }, [profileId]);

  const getRating = useCallback(
    (numericId: number): RatingEntry | null => entries[numericId] ?? null,
    [entries],
  );

  return { entries, setRating, removeRating, getRating };
}
