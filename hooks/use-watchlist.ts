"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";
import { WatchlistStore, type WatchlistTransport, type WriteResult } from "@/lib/watchlist/store";

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

const transport: WatchlistTransport = {
  async load(profileId) {
    const res = await fetch(`/api/watchlist?profileId=${encodeURIComponent(profileId)}`, { headers: await authHeader() });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { ids?: number[] } | null;
    return Array.isArray(body?.ids) ? body.ids : null;
  },

  async write(kind, numericId, profileId): Promise<WriteResult> {
    try {
      const res = await fetch("/api/watchlist", {
        method: kind === "add" ? "POST" : "DELETE",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ peliculaId: numericId, profileId }),
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        return { ok: false, reason: "rate_limited", retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined };
      }
      return (await confirmed(res)) ? { ok: true } : { ok: false, reason: "failed" };
    } catch {
      return { ok: false, reason: "failed" };
    }
  },
};

/** Una sola lista para toda la página: cada tarjeta, la ficha y el panel flotante comparten estado y petición. */
const watchlistStore = new WatchlistStore(transport);
const EMPTY: readonly number[] = [];

/** Texto del aviso tras un fallo al guardar o quitar, según el motivo. */
export function watchlistErrorMessage(): string {
  const failure = watchlistStore.lastFailure;
  if (failure && !failure.ok && failure.reason === "rate_limited") {
    return failure.retryAfterSeconds
      ? `Estás guardando muy rápido. Espera ${failure.retryAfterSeconds} s e inténtalo de nuevo.`
      : "Estás guardando muy rápido. Espera unos segundos e inténtalo de nuevo.";
  }
  return "No se pudo actualizar tu lista. Inténtalo de nuevo.";
}

export function useWatchlist() {
  const userId    = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const ids = useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getSnapshot, () => EMPTY);
  const loadedIds = useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getLoadedSnapshot, () => EMPTY);

  /** Sin sesión (invitado) no hay dónde guardar: la interfaz debe pedir iniciar sesión. */
  const canSave = userId !== null;

  useEffect(() => {
    if (!userId) {
      watchlistStore.reset();
      return;
    }
    void watchlistStore.ensureLoaded(`${userId}|${profileId}`, profileId);
  }, [userId, profileId]);

  /**
   * Añade el título a la lista. El cambio se ve al instante y, si el servidor lo rechaza, se deshace.
   * Devuelve `true` solo si quedó guardado (`false` también para invitados). Si falla,
   * `watchlistErrorMessage()` da el motivo para avisar al usuario.
   */
  const addMedia = useCallback(async (numericId: number): Promise<boolean> => {
    if (!canSave) return false;
    return (await watchlistStore.mutate("add", numericId)).ok;
  }, [canSave]);

  /** Quita el título de la lista (con deshacer si falla). Devuelve `true` si se eliminó. */
  const removeMedia = useCallback(async (numericId: number): Promise<boolean> => {
    if (!canSave) return false;
    return (await watchlistStore.mutate("remove", numericId)).ok;
  }, [canSave]);

  const hasMedia = useCallback((numericId: number) => ids.includes(numericId), [ids]);

  return { mediaIds: ids as number[], loadedMediaIds: loadedIds as number[], addMedia, removeMedia, hasMedia, canSave };
}
