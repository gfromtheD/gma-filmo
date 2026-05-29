"use client";

import { useState, useEffect, useCallback } from "react";

export interface ProfileSettings {
  avatarIconId:   string;   // IconId key or "" (uses initial circle)
  avatarImageUrl: string;   // "/profiles/..." or "data:..." or ""
  isKids:         boolean;
  requirePin:     boolean;
  pin:            string;   // 4-digit string
  autoplay:       boolean;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  avatarIconId:   "",
  avatarImageUrl: "",
  isKids:         false,
  requirePin:     false,
  pin:            "",
  autoplay:       true,
};

function storageKey(userId: string) {
  return `gma-profile-settings:${userId}`;
}

export function useProfileSettings(userId: string | null) {
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);

  // Load from localStorage once userId is known
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<ProfileSettings> });
    } catch { /* ignore parse errors */ }
  }, [userId]);

  const updateSettings = useCallback((patch: Partial<ProfileSettings>) => {
    if (!userId) return;
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(storageKey(userId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [userId]);

  return { settings, updateSettings };
}
