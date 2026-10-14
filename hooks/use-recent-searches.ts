"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gma_recent_searches";
const MAX_RECENT = 6;
const MIN_LENGTH = 2;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function write(list: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): el historial simplemente no se guarda.
  }
}

/** Últimas búsquedas del usuario en este dispositivo (sin duplicados, la más reciente primero). */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { setRecent(read()); }, []);

  const remember = useCallback((query: string) => {
    const clean = query.trim().replace(/\s+/g, " ");
    if (clean.length < MIN_LENGTH) return;
    setRecent((prev) => {
      const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
      write(next);
      return next;
    });
  }, []);

  const forget = useCallback((query: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== query);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setRecent([]);
  }, []);

  return { recent, remember, forget, clear };
}
