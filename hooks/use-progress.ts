"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";
import { readSettingsPrefs } from "@/hooks/use-settings-prefs";

export interface ProgressEntry {
  currentTime: number;
  completed:   boolean;
  updatedAt:   number;
}

export function useProgress() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const [entries, setEntries] = useState<Record<number, ProgressEntry>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setEntries({});
    setReady(!userId);
    if (!userId) return () => { active = false; };
    void getSupabaseBrowserClient()
      .from("view_history")
      .select("pelicula_id, last_position, completed, last_watched_at")
      .eq("user_id",    userId)
      .eq("profile_id", profileId)
      .then(({ data }) => {
        if (!active) return;
        const map: Record<number, ProgressEntry> = {};
        for (const r of data ?? []) {
          map[r.pelicula_id] = {
            currentTime: r.last_position,
            completed:   r.completed,
            updatedAt:   new Date(r.last_watched_at).getTime(),
          };
        }
        setEntries(map);
        setReady(true);
      });
    return () => { active = false; };
  }, [userId, profileId]);

  const saveProgress = useCallback(
    async (numericId: number, currentTime: number, completed: boolean): Promise<void> => {
      const updatedAt = Date.now();
      setEntries((prev) => ({ ...prev, [numericId]: { currentTime, completed, updatedAt } }));
      // Configuración → «Pausar historial»: lo visto no se guarda (solo se recuerda mientras dura la visita).
      if (!userId || readSettingsPrefs().pauseHistory) return;
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

  /** Borra todo el historial de este perfil (y con él «Seguir viendo»). Devuelve `true` si salió bien. */
  const clearHistory = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const { error } = await getSupabaseBrowserClient()
      .from("view_history")
      .delete()
      .eq("user_id", userId)
      .eq("profile_id", profileId);
    if (error) return false;
    setEntries({});
    return true;
  }, [userId, profileId]);

  return { entries, saveProgress, getProgress, ready, clearHistory };
}
