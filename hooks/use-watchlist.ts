"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Una escritura salió bien solo si la respuesta es 2xx y el servidor confirma `ok`. */
async function confirmed(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
  return body?.ok === true;
}

export function useWatchlist() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const [ids, setIds] = useState<number[]>([]);
  const profileRef = useRef(profileId);
  useEffect(() => { profileRef.current = profileId; }, [profileId]);

  /** Sin sesión (invitado) no hay dónde guardar: la interfaz debe pedir iniciar sesión. */
  const canSave = userId !== null;

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    setIds([]);
    void (async () => {
      const headers = await authHeader();
      const res = await fetch(`/api/watchlist?profileId=${encodeURIComponent(profileId)}`, { headers });
      if (!res.ok) return;
      const body = (await res.json()) as { ids: number[] };
      if (isActive && Array.isArray(body.ids)) setIds(body.ids);
    })();
    return () => { isActive = false; };
  }, [userId, profileId]);

  /**
   * Añade el título a la lista. El cambio se ve al instante y, si el servidor lo rechaza,
   * se deshace. Devuelve `true` solo si quedó guardado (`false` también para invitados).
   */
  const addMedia = useCallback(async (numericId: number): Promise<boolean> => {
    if (!canSave) return false;
    setIds((prev) => [...new Set([...prev, numericId])]);
    let saved = false;
    try {
      const headers = await authHeader();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
      saved = await confirmed(res);
    } catch {
      saved = false;
    }
    if (!saved && profileRef.current === profileId) setIds((prev) => prev.filter((id) => id !== numericId));
    return saved;
  }, [profileId, canSave]);

  /** Quita el título de la lista (con deshacer si falla). Devuelve `true` si se eliminó. */
  const removeMedia = useCallback(async (numericId: number): Promise<boolean> => {
    if (!canSave) return false;
    setIds((prev) => prev.filter((id) => id !== numericId));
    let removed = false;
    try {
      const headers = await authHeader();
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
      removed = await confirmed(res);
    } catch {
      removed = false;
    }
    if (!removed && profileRef.current === profileId) setIds((prev) => [...new Set([...prev, numericId])]);
    return removed;
  }, [profileId, canSave]);

  const hasMedia = useCallback((numericId: number) => ids.includes(numericId), [ids]);

  return { mediaIds: ids, addMedia, removeMedia, hasMedia, canSave };
}
