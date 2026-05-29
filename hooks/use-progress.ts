"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";

export interface ProgressEntry {
  currentTime: number;
  completed:   boolean;
  updatedAt:   number;
}

export function useProgress() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const [entries, setEntries] = useState<Record<number, ProgressEntry>>({});

  useEffect(() => {
    if (!userId) return;
    setEntries({});
    void getSupabaseBrowserClient()
      .from("view_history")
      .select("pelicula_id, last_position, completed, last_watched_at")
      .eq("user_id",    userId)
      .eq("profile_id", profileId)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<number, ProgressEntry> = {};
        for (const r of data) {
          map[r.pelicula_id] = {
            currentTime: r.last_position,
            completed:   r.completed,
            updatedAt:   new Date(r.last_watched_at).getTime(),
          };
        }
        setEntries(map);
      });
  }, [userId, profileId]);

  const saveProgress = useCallback(
    async (numericId: number, currentTime: number, completed: boolean): Promise<void> => {
      const updatedAt = Date.now();
      setEntries((prev) => ({ ...prev, [numericId]: { currentTime, completed, updatedAt } }));
      if (!userId) return;
      await getSupabaseBrowserClient()
        .from("view_history")
        .upsert(
          {
            user_id:         userId,
            profile_id:      profileId,
            pelicula_id:     numericId,
            last_position:   currentTime,
            completed,
            last_watched_at: new Date(updatedAt).toISOString(),
          },
          { onConflict: "user_id,profile_id,pelicula_id" },
        );
    },
    [userId, profileId],
  );

  const getProgress = useCallback(
    (numericId: number): ProgressEntry | null => entries[numericId] ?? null,
    [entries],
  );

  return { entries, saveProgress, getProgress };
}
