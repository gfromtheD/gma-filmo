"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly avatarId: string;
  readonly color: string;
  readonly isKids: boolean;
  readonly requirePin: boolean;
  readonly pin: string;
  readonly autoplay: boolean;
}

export interface ActiveProfile {
  readonly id: string;
  readonly name: string;
  readonly isKids: boolean;
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
  readonly addProfile: (data: {
    name: string; avatarId: string; color: string;
    isKids?: boolean; requirePin?: boolean; pin?: string; autoplay?: boolean;
  }) => Promise<Profile>;
  readonly updateProfile: (id: string, data: {
    name: string; avatarId: string; color: string;
    isKids?: boolean; requirePin?: boolean; pin?: string; autoplay?: boolean;
  }) => Promise<void>;
  readonly removeProfile: (id: string) => Promise<void>;
}

// ── DB row → Profile ──────────────────────────────────────────────────────────

type SubProfileRow = {
  id: string;
  name: string;
  avatar_id: string;
  color: string;
  is_kids: boolean;
  require_pin: boolean;
  pin: string | null;
  autoplay: boolean;
};

function rowToProfile(r: SubProfileRow): Profile {
  return {
    id:         r.id,
    name:       r.name,
    avatarId:   r.avatar_id,
    color:      r.color,
    isKids:     r.is_kids,
    requirePin: r.require_pin,
    pin:        r.pin ?? "",
    autoplay:   r.autoplay,
  };
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
          .select("id, name, avatar_id, color, is_kids, require_pin, pin, autoplay")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        const profiles = error || !data ? [] : data.map(rowToProfile);

        // Restore active profile only if it still exists
        const prev = get().activeProfile;
        const activeProfile = prev && profiles.some((p) => p.id === prev.id)
          ? prev
          : null;

        set({ profiles, activeProfile, _ownerId: userId });
      },

      setActiveProfile: (profile) => set({ activeProfile: profile }),

      clearActiveProfile: () => set({ activeProfile: null }),

      addProfile: async ({ name, avatarId, color, isKids = false, requirePin = false, pin = "", autoplay = true }) => {
        const userId = get()._ownerId;
        if (!userId) throw new Error("No active user");

        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("sub_profiles")
          .insert({
            user_id:     userId,
            name,
            avatar_id:   avatarId,
            color,
            is_kids:     isKids,
            require_pin: requirePin,
            pin:         requirePin ? pin : null,
            autoplay,
          })
          .select("id, name, avatar_id, color, is_kids, require_pin, pin, autoplay")
          .single();

        if (error || !data) throw new Error(error?.message ?? "Failed to create profile");

        const profile = rowToProfile(data as SubProfileRow);
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return profile;
      },

      updateProfile: async (id, { name, avatarId, color, isKids, requirePin, pin, autoplay }) => {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase
          .from("sub_profiles")
          .update({
            name,
            avatar_id:   avatarId,
            color,
            ...(isKids     !== undefined ? { is_kids:     isKids }                              : {}),
            ...(requirePin !== undefined ? { require_pin: requirePin }                          : {}),
            ...(requirePin !== undefined ? { pin: requirePin ? (pin ?? null) : null }           : {}),
            ...(autoplay   !== undefined ? { autoplay }                                         : {}),
          })
          .eq("id", id);

        if (error) throw new Error(error.message);

        set((s) => {
          const profiles = s.profiles.map((p) =>
            p.id === id ? { ...p, name, avatarId: avatarId, color,
              ...(isKids     !== undefined ? { isKids }                                 : {}),
              ...(requirePin !== undefined ? { requirePin }                             : {}),
              ...(requirePin !== undefined ? { pin: requirePin ? (pin ?? "") : "" }     : {}),
              ...(autoplay   !== undefined ? { autoplay }                               : {}),
            } : p,
          );
          const activeProfile = s.activeProfile?.id === id
            ? { ...s.activeProfile, name, ...(isKids !== undefined ? { isKids } : {}) }
            : s.activeProfile;
          return { profiles, activeProfile };
        });
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
