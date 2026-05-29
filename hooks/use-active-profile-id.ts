"use client";

import { useProfileStore } from "@/store/use-profile-store";

// Returns the DB-level profile discriminator:
//   ""            → primary Supabase account profile  (default for all existing rows)
//   "p_abc123_xy" → a Zustand sub-profile
export function useActiveProfileId(): string {
  const activeProfile = useProfileStore((s) => s.activeProfile);
  if (!activeProfile || activeProfile.id === "__supabase__") return "";
  return activeProfile.id;
}
