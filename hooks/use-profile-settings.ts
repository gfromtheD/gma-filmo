"use client";

import { useState, useEffect, useCallback } from "react";

export interface ProfileSettings {
  avatarIconId:   string;   // IconId key or "" (uses initial circle)
  avatarImageUrl: string;   // "/profiles/..." or "data:..." or ""
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  avatarIconId:   "",
  avatarImageUrl: "",
};

function storageKey(userId: string) {
  return `gma-profile-settings:${userId}`;
}

export function useProfileSettings(userId: string | null) {
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);

  // Load from localStorage once userId is known. Si quedan claves antiguas (niños, PIN…), se ignoran.
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (raw) {
        const stored = JSON.parse(raw) as Partial<ProfileSettings>;
        setSettings({
          avatarIconId: typeof stored.avatarIconId === "string" ? stored.avatarIconId : DEFAULT_SETTINGS.avatarIconId,
          avatarImageUrl: typeof stored.avatarImageUrl === "string" ? stored.avatarImageUrl : DEFAULT_SETTINGS.avatarImageUrl,
        });
      }
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
