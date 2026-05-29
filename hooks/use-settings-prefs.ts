"use client";

import { useState, useEffect, useCallback } from "react";

export interface SettingsPrefs {
  appLang:         string;
  audioLang:       string;
  subsLang:        string;
  audioDesc:       boolean;
  forcedSubs:      boolean;
  calidad:         string;
  autoNext:        boolean;
  autoPreviews:    boolean;
  skipIntro:       boolean;
  dataWarning:     boolean;
  pinEnabled:      boolean;
  maxRating:       string;
  newEpisodes:     boolean;
  reminders:       boolean;
  recommendations: boolean;
  newsletter:      boolean;
  pushNotifs:      boolean;
}

const DEFAULTS: SettingsPrefs = {
  appLang:         "Español (España)",
  audioLang:       "Español castellano · Original",
  subsLang:        "Español",
  audioDesc:       false,
  forcedSubs:      true,
  calidad:         "Auto",
  autoNext:        true,
  autoPreviews:    true,
  skipIntro:       true,
  dataWarning:     false,
  pinEnabled:      false,
  maxRating:       "Todo el catálogo",
  newEpisodes:     true,
  reminders:       false,
  recommendations: true,
  newsletter:      false,
  pushNotifs:      true,
};

const KEY = "gma_settings";

function load(): SettingsPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function useSettingsPrefs() {
  const [prefs, setPrefs] = useState<SettingsPrefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(load());
  }, []);

  const set = useCallback(<K extends keyof SettingsPrefs>(key: K, value: SettingsPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { prefs, set };
}
