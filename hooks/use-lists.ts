"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";

export interface UserList {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  /** Obras de la lista (numericId), de la añadida más reciente a la más antigua. */
  readonly itemIds: readonly number[];
}

/** Resultado de una acción: `error` es el mensaje para el usuario si salió mal. */
export type ListResult = { ok: true; list?: UserList } | { ok: false; error: string };

interface State {
  readonly key: string | null;
  readonly lists: readonly UserList[];
  readonly isLoaded: boolean;
  /** `false` si el servidor no pudo leer las listas (p. ej. la migración aún no está aplicada). */
  readonly isAvailable: boolean;
}

const INITIAL: State = { key: null, lists: [], isLoaded: false, isAvailable: true };
let state: State = INITIAL;
const listeners = new Set<() => void>();
const setState = (next: State) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL;

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function call(path: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method,
      headers: { ...(await authHeader()), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    return { ok: res.ok && data.ok !== false, data };
  } catch {
    return { ok: false, data: {} };
  }
}

/** El servidor manda en `message` los errores pensados para el usuario; si no hay, se usa el genérico. */
const failure = (data: Record<string, unknown>, fallback: string): ListResult =>
  ({ ok: false, error: typeof data.message === "string" ? data.message : fallback });

async function load(key: string, profileId: string) {
  if (state.key === key && state.isLoaded) return;
  setState({ ...INITIAL, key });
  const res = await call(`/api/lists?profileId=${encodeURIComponent(profileId)}`, "GET");
  if (state.key !== key) return; // cambió de perfil mientras cargaba
  const lists = Array.isArray(res.data.lists) ? (res.data.lists as UserList[]) : [];
  setState({ key, lists, isLoaded: true, isAvailable: res.ok && !res.data.error });
}

const replaceList = (id: string, update: (l: UserList) => UserList) =>
  setState({ ...state, lists: state.lists.map((l) => (l.id === id ? update(l) : l)) });

/**
 * Listas personalizadas del perfil activo (además de Guardados). Todo el sitio comparte un mismo estado; los
 * cambios se ven al instante y se deshacen si el servidor los rechaza.
 */
export function useLists() {
  const userId = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!userId) { setState(INITIAL); return; }
    void load(`${userId}|${profileId}`, profileId);
  }, [userId, profileId]);

  const createList = useCallback(async (name: string): Promise<ListResult> => {
    const res = await call("/api/lists", "POST", { name, profileId });
    if (!res.ok || !res.data.list) return failure(res.data, "No se pudo crear la lista.");
    const list = res.data.list as UserList;
    setState({ ...state, lists: [...state.lists, list] });
    return { ok: true, list };
  }, [profileId]);

  const renameList = useCallback(async (id: string, name: string): Promise<ListResult> => {
    const previous = state.lists.find((l) => l.id === id);
    if (!previous) return { ok: false, error: "Esa lista ya no existe." };
    replaceList(id, (l) => ({ ...l, name: name.trim().replace(/\s+/g, " ") }));
    const res = await call(`/api/lists/${id}`, "PATCH", { name });
    if (!res.ok) { replaceList(id, () => previous); return failure(res.data, "No se pudo renombrar la lista."); }
    return { ok: true };
  }, []);

  const deleteList = useCallback(async (id: string): Promise<ListResult> => {
    const before = state.lists;
    setState({ ...state, lists: before.filter((l) => l.id !== id) });
    const res = await call(`/api/lists/${id}`, "DELETE");
    if (!res.ok) { setState({ ...state, lists: before }); return failure(res.data, "No se pudo borrar la lista."); }
    return { ok: true };
  }, []);

  /** Añade o quita la obra de la lista, según esté o no. */
  const toggleItem = useCallback(async (id: string, numericId: number): Promise<ListResult> => {
    const list = state.lists.find((l) => l.id === id);
    if (!list) return { ok: false, error: "Esa lista ya no existe." };
    const isIn = list.itemIds.includes(numericId);
    replaceList(id, (l) => ({ ...l, itemIds: isIn ? l.itemIds.filter((x) => x !== numericId) : [numericId, ...l.itemIds] }));
    const res = await call(`/api/lists/${id}/items`, isIn ? "DELETE" : "POST", { peliculaId: numericId });
    if (!res.ok) { replaceList(id, () => list); return failure(res.data, isIn ? "No se pudo quitar de la lista." : "No se pudo añadir a la lista."); }
    return { ok: true };
  }, []);

  return { ...snapshot, canUse: userId !== null, createList, renameList, deleteList, toggleItem };
}
