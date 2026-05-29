"use client";

import {
  createContext, useContext, useState, useEffect, useCallback,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth, useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import {
  useProfileSettings,
  type ProfileSettings,
  DEFAULT_SETTINGS,
} from "@/hooks/use-profile-settings";
import { useProfileStore } from "@/store/use-profile-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  displayName: string;
  email:       string | null;
  memberSince: Date | null;
  avatarColor: string;
}

interface UserProfileContextValue extends UserProfile, ProfileSettings {
  userId:            string | null;
  isLoaded:          boolean;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatarColor: (color: string) => Promise<void>;
  updateSettings:    (patch: Partial<ProfileSettings>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE = ["#22B16B", "#3B82F6", "#8B5CF6", "#F97316", "#F43F5E", "#F59E0B"];

export function deriveAvatarColor(email: string): string {
  const seed = email.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return PALETTE[seed % PALETTE.length]!;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UserProfileContext = createContext<UserProfileContextValue>({
  displayName:       "",
  email:             null,
  memberSince:       null,
  avatarColor:       "#22B16B",
  userId:            null,
  isLoaded:          false,
  ...DEFAULT_SETTINGS,
  updateDisplayName: async () => {},
  updateAvatarColor: async () => {},
  updateSettings:    () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const userId = useSupabaseUserId();
  const checkOwner = useProfileStore((s) => s.checkOwner);

  // Only check owner once auth state is resolved — calling with null during
  // initial load would wipe profiles before we know who the actual user is.
  useEffect(() => {
    if (isLoading) return;
    void checkOwner(userId);
  }, [userId, isLoading, checkOwner]);

  const [profile, setProfile] = useState<UserProfile>({
    displayName: "",
    email:       null,
    memberSince: null,
    avatarColor: "#22B16B",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Extended settings from localStorage (icon, image, kids, PIN, autoplay)
  const { settings, updateSettings } = useProfileSettings(userId);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const [{ data: { user } }, { data: profileRow }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("display_name, avatar_color")
          .eq("id", userId!)
          .maybeSingle(),
      ]);

      if (!user) return;

      const emailLocal   = (user.email ?? "").split("@")[0] ?? "";
      const defaultColor = deriveAvatarColor(user.email ?? "");

      if (!profileRow) {
        await supabase.from("profiles").upsert({
          id:           userId!,
          display_name: emailLocal,
          avatar_color: defaultColor,
        });
      }

      const savedName  = profileRow?.display_name?.trim() ?? "";
      const savedColor = profileRow?.avatar_color?.trim() ?? "";

      setProfile({
        displayName: savedName && savedName !== "Espectador" ? savedName : emailLocal,
        email:       user.email ?? null,
        memberSince: user.created_at ? new Date(user.created_at) : null,
        avatarColor: savedColor || defaultColor,
      });
      setIsLoaded(true);
    }

    void load();
  }, [userId]);

  const updateDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!userId || !trimmed) return;
    setProfile((prev) => ({ ...prev, displayName: trimmed }));
    await getSupabaseBrowserClient()
      .from("profiles")
      .upsert({ id: userId, display_name: trimmed });
  }, [userId]);

  const updateAvatarColor = useCallback(async (color: string) => {
    if (!userId) return;
    setProfile((prev) => ({ ...prev, avatarColor: color }));
    await getSupabaseBrowserClient()
      .from("profiles")
      .update({ avatar_color: color })
      .eq("id", userId);
  }, [userId]);

  return (
    <UserProfileContext.Provider
      value={{
        ...profile,
        ...settings,
        userId,
        isLoaded,
        updateDisplayName,
        updateAvatarColor,
        updateSettings,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserProfile() {
  return useContext(UserProfileContext);
}
