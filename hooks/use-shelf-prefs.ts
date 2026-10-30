"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { useActiveProfileId } from "@/hooks/use-active-profile-id";

export type ShelfSort = "manual" | "nombre" | "color" | "tamano";
export type ShelfSize = "s" | "m" | "l";
export type ShelfLayout = "fila" | "cuadricula";

export interface ShelfPrefs {
  readonly sort: ShelfSort;
  readonly size: ShelfSize;
  readonly layout: ShelfLayout;
  /** Color elegido para cada carpeta, por id de colección. */
  readonly colors: Readonly<Record<string, string>>;
  /** Orden manual de las carpetas (ids). Las que no aparezcan van al final, por orden de creación. */
  readonly order: readonly string[];
}

const KEY = "gma_shelf_prefs";
const DEFAULTS: ShelfPrefs = { sort: "manual", size: "m", layout: "fila", colors: {}, order: [] };
const SORTS: readonly ShelfSort[] = ["manual", "nombre", "color", "tamano"];
const SIZES: readonly ShelfSize[] = ["s", "m", "l"];
const LAYOUTS: readonly ShelfLayout[] = ["fila", "cuadricula"];
const SAVE_DELAY_MS = 700;

function sanitize(data: Partial<ShelfPrefs> | null | undefined): ShelfPrefs {
  if (!data || typeof data !== "object") return DEFAULTS;
  const colors = data.colors && typeof data.colors === "object" ? Object.fromEntries(
    Object.entries(data.colors).filter(([, v]) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)),
  ) : {};
  const order = Array.isArray(data.order) ? data.order.filter((id): id is string => typeof id === "string").slice(0, 200) : [];
  return {
    sort: SORTS.includes(data.sort as ShelfSort) ? (data.sort as ShelfSort) : DEFAULTS.sort,
    size: SIZES.includes(data.size as ShelfSize) ? (data.size as ShelfSize) : DEFAULTS.size,
    layout: LAYOUTS.includes(data.layout as ShelfLayout) ? (data.layout as ShelfLayout) : DEFAULTS.layout,
    colors,
    order,
  };
}

function parse(raw: string | null): ShelfPrefs {
  if (!raw) return DEFAULTS;
  try { return sanitize(JSON.parse(raw) as Partial<ShelfPrefs>); } catch { return DEFAULTS; }
}

let cache: ShelfPrefs | null = null;
/** Clave de sesión (`usuario|perfil`) cuyas preferencias ya se han traído del servidor; `null` = sin sincronizar. */
let syncedKey: string | null = null;
let remote: { readonly key: string; readonly profileId: string } | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function read(): ShelfPrefs {
  if (cache) return cache;
  try { cache = parse(window.localStorage.getItem(KEY)); } catch { cache = DEFAULTS; }
  return cache;
}
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function store(next: ShelfPrefs) {
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: vale solo en esta visita */ }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Sube las preferencias a la cuenta (sin esperar y sin quejarse si falla: siguen guardadas en este navegador). */
function scheduleSave() {
  if (!remote || syncedKey !== remote.key) return;
  const { profileId } = remote;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch("/api/shelf-prefs", {
        method: "PUT",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, prefs: read() }),
      });
    } catch { /* se reintentará con el próximo cambio */ }
  }, SAVE_DELAY_MS);
}

function write(next: ShelfPrefs) {
  store(next);
  notify();
  scheduleSave();
}

/** Trae las preferencias de la cuenta: si ya había, mandan sobre las de este navegador; si no, se sube lo que hay. */
async function syncWithAccount(key: string, profileId: string) {
  if (syncedKey === key) return;
  remote = { key, profileId };
  try {
    const res = await fetch(`/api/shelf-prefs?profileId=${encodeURIComponent(profileId)}`, { headers: await authHeader() });
    const data = (await res.json().catch(() => ({}))) as { prefs?: Partial<ShelfPrefs> | null; available?: boolean };
    if (!res.ok || data.available === false) return; // la cuenta aún no guarda preferencias: se queda lo local
    syncedKey = key;
    if (data.prefs) { store(sanitize(data.prefs)); notify(); } else scheduleSave();
  } catch { /* sin red: se usa lo local */ }
}

/**
 * Cómo ve el usuario sus carpetas de Mi lista: orden, tamaño, fila o cuadrícula, el color de cada una y su orden manual.
 * Se guarda en este navegador al instante y, con sesión iniciada, también en la cuenta (por perfil) para verlo igual
 * desde cualquier dispositivo.
 */
export function useShelfPrefs() {
  const userId = useSupabaseUserId();
  const profileId = useActiveProfileId();
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);

  useEffect(() => {
    if (!userId) { syncedKey = null; remote = null; return; }
    void syncWithAccount(`${userId}|${profileId}`, profileId);
  }, [userId, profileId]);

  const setSort = useCallback((sort: ShelfSort) => write({ ...read(), sort }), []);
  const setSize = useCallback((size: ShelfSize) => write({ ...read(), size }), []);
  const setLayout = useCallback((layout: ShelfLayout) => write({ ...read(), layout }), []);
  const setColor = useCallback((id: string, hex: string) => write({ ...read(), colors: { ...read().colors, [id]: hex } }), []);
  const setOrder = useCallback((order: readonly string[]) => write({ ...read(), order: order.slice(0, 200), sort: "manual" }), []);
  return { prefs, setSort, setSize, setLayout, setColor, setOrder };
}
