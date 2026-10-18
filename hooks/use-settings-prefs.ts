"use client";

import { useState, useEffect, useCallback } from "react";

export type SubtitleSize = "s" | "m" | "l";
export type SubtitleBackground = "shadow" | "box" | "none";

/**
 * Preferencias que la app aplica de verdad, guardadas en este navegador. Si quedan en localStorage claves de
 * versiones anteriores (idioma, calidad, avisos…), se ignoran.
 */
export interface SettingsPrefs {
  /** Reproducir el tráiler de la portada. */
  autoPreviews: boolean;
  /** Empezar las obras con los subtítulos puestos (si la obra los tiene). */
  subtitlesOn: boolean;
  subtitleSize: SubtitleSize;
  subtitleBackground: SubtitleBackground;
  /** No guardar lo que se ve en el historial (ni en «Seguir viendo»). */
  pauseHistory: boolean;
}

const DEFAULTS: SettingsPrefs = {
  autoPreviews: true,
  subtitlesOn: false,
  subtitleSize: "m",
  subtitleBackground: "shadow",
  pauseHistory: false,
};

const KEY = "gma_settings";

const pick = <T,>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** Lee las preferencias guardadas (con valores por defecto para lo que falte o esté mal). Solo en el navegador. */
export function readSettingsPrefs(): SettingsPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Record<string, unknown>;
    return {
      autoPreviews: pick(s.autoPreviews, [true, false], DEFAULTS.autoPreviews),
      subtitlesOn: pick(s.subtitlesOn, [true, false], DEFAULTS.subtitlesOn),
      subtitleSize: pick(s.subtitleSize, ["s", "m", "l"] as const, DEFAULTS.subtitleSize),
      subtitleBackground: pick(s.subtitleBackground, ["shadow", "box", "none"] as const, DEFAULTS.subtitleBackground),
      pauseHistory: pick(s.pauseHistory, [true, false], DEFAULTS.pauseHistory),
    };
  } catch {
    return DEFAULTS;
  }
}

export function useSettingsPrefs() {
  const [prefs, setPrefs] = useState<SettingsPrefs>(DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setPrefs(readSettingsPrefs());
    setIsLoaded(true);
  }, []);

  const set = useCallback(<K extends keyof SettingsPrefs>(key: K, value: SettingsPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* navegador sin almacenamiento: dura esta visita */ }
      return next;
    });
  }, []);

  return { prefs, set, isLoaded };
}
