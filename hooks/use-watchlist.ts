"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export function useWatchlist() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (!userId) return;
    setIds([]);
    void (async () => {
      const headers = await authHeader();
      const res = await fetch(`/api/watchlist?profileId=${encodeURIComponent(profileId)}`, { headers });
      if (!res.ok) return;
      const body = (await res.json()) as { ids: number[] };
      if (Array.isArray(body.ids)) setIds(body.ids);
    })();
  }, [userId, profileId]);

  const addMedia = useCallback((numericId: number) => {
    setIds((prev) => [...new Set([...prev, numericId])]);
    void (async () => {
      const headers = await authHeader();
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
    })();
  }, [profileId]);

  const removeMedia = useCallback((numericId: number) => {
    setIds((prev) => prev.filter((id) => id !== numericId));
    void (async () => {
      const headers = await authHeader();
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
    })();
  }, [profileId]);

  const hasMedia = useCallback((numericId: number) => ids.includes(numericId), [ids]);

  return { mediaIds: ids, addMedia, removeMedia, hasMedia };
}
