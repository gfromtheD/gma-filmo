"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly avatarId: string;
  readonly color: string;
}

export interface ActiveProfile {
  readonly id: string;
  readonly name: string;
}

interface ProfileData {
  name: string;
  avatarId: string;
  color: string;
}

interface ProfileStore {
  readonly profiles: readonly Profile[];
  readonly activeProfile: ActiveProfile | null;
  // Local cache of active user (for rehydration)
  readonly _ownerId: string | null;
  // Actions
  readonly checkOwner: (userId: string | null) => Promise<void>;
  readonly setActiveProfile:   (profile: ActiveProfile) => void;
  readonly clearActiveProfile: () => void;
  readonly addProfile: (data: ProfileData) => Promise<Profile>;
  readonly updateProfile: (id: string, data: ProfileData) => Promise<void>;
  readonly removeProfile: (id: string) => Promise<void>;
}

// ── DB row → Profile ──────────────────────────────────────────────────────────
// Las columnas is_kids, require_pin, pin y autoplay de `sub_profiles` ya no se usan: la app no las lee ni las escribe
// (la base de datos les da su valor por defecto al crear un perfil).

const COLUMNS = "id, name, avatar_id, color";

type SubProfileRow = { id: string; name: string; avatar_id: string; color: string };

function rowToProfile(r: SubProfileRow): Profile {
  return { id: r.id, name: r.name, avatarId: r.avatar_id, color: r.color };
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles:      [],
      activeProfile: null,
      _ownerId:      null,

      checkOwner: async (userId) => {
        const { _ownerId } = get();
        if (_ownerId === userId) return;

        if (userId === null) {
          set({ _ownerId: null });
          return;
        }

        // Load profiles for this user from Supabase
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("sub_profiles")
          .select(COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        const profiles = error || !data ? [] : data.map(rowToProfile);

        // Restore active profile only if it still exists
        const prev = get().activeProfile;
        const activeProfile = prev && profiles.some((p) => p.id === prev.id)
          ? { id: prev.id, name: prev.name }
          : null;

        set({ profiles, activeProfile, _ownerId: userId });
      },

      setActiveProfile: (profile) => set({ activeProfile: profile }),

      clearActiveProfile: () => set({ activeProfile: null }),

      addProfile: async ({ name, avatarId, color }) => {
        const userId = get()._ownerId;
        if (!userId) throw new Error("No active user");

        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("sub_profiles")
          .insert({ user_id: userId, name, avatar_id: avatarId, color })
          .select(COLUMNS)
          .single();

        if (error || !data) throw new Error(error?.message ?? "Failed to create profile");

        const profile = rowToProfile(data as SubProfileRow);
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return profile;
      },

      updateProfile: async (id, { name, avatarId, color }) => {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase
          .from("sub_profiles")
          .update({ name, avatar_id: avatarId, color })
          .eq("id", id);

        if (error) throw new Error(error.message);

        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name, avatarId, color } : p)),
          activeProfile: s.activeProfile?.id === id ? { ...s.activeProfile, name } : s.activeProfile,
        }));
      },

      removeProfile: async (id) => {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase
          .from("sub_profiles")
          .delete()
          .eq("id", id);

        if (error) throw new Error(error.message);

        set((s) => ({
          profiles:      s.profiles.filter((p) => p.id !== id),
          activeProfile: s.activeProfile?.id === id ? null : s.activeProfile,
        }));
      },
    }),
    {
      name: "gma-profiles-v2",
      partialize: (state) => ({
        _ownerId:      state._ownerId,
        activeProfile: state.activeProfile,
      }),
    },
  ),
);
