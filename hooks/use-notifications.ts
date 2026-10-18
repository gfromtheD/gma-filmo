"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import type { NotificationKind } from "@/lib/notifications/rules";

export interface AppNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly score: number | null;
  readonly createdAt: string;
  readonly isRead: boolean;
  readonly film: { readonly slug: string; readonly title: string };
}

/** Cada cuánto se miran las notificaciones nuevas mientras la pestaña está visible. */
const POLL_MS = 60_000;

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/**
 * Notificaciones del usuario (hoy: valoraciones de sus obras). Se cargan al entrar, cada minuto con la pestaña
 * visible y al volver a ella. `enabled`: solo los creadores las reciben, así que para el resto no se pide nada.
 */
export function useNotifications(enabled: boolean) {
  const userId = useSupabaseUserId();
  const [items, setItems] = useState<readonly AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const isActive = enabled && userId !== null;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { headers: await authHeader() });
      if (!res.ok) return;
      const body = (await res.json()) as { items?: AppNotification[]; unread?: number };
      setItems(body.items ?? []);
      setUnread(body.unread ?? 0);
      setIsLoaded(true);
    } catch {
      // Sin red: se reintenta en el siguiente ciclo.
    }
  }, []);

  useEffect(() => {
    if (!isActive) { setItems([]); setUnread(0); setIsLoaded(false); return; }
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [isActive, refresh]);

  /** Marca todas como leídas (al abrir la lista). El cambio se ve al momento. */
  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications", { method: "PATCH", headers: await authHeader() });
    } catch {
      void refresh();
    }
  }, [unread, refresh]);

  return { items, unread, isLoaded, refresh, markAllRead };
}
