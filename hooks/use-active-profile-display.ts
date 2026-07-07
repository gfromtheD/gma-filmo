"use client";

import { useUserProfile } from "@/hooks/use-user-profile";
import { useProfileStore } from "@/store/use-profile-store";
import { COLOR_VALUES, type AvatarColor } from "@/lib/data/profile-avatars";

export interface ActiveProfileDisplay {
  displayName:    string;
  avatarColor:    string;
  avatarIconId:   string;
  avatarImageUrl: string;
  isSubProfile:   boolean;
}

export function useActiveProfileDisplay(): ActiveProfileDisplay {
  const supabase     = useUserProfile();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const profiles      = useProfileStore((s) => s.profiles);

  const isSubProfile = !!activeProfile && activeProfile.id !== "__supabase__";
  const subProfile   = isSubProfile
    ? (profiles.find((p) => p.id === activeProfile!.id) ?? null)
    : null;

  if (!subProfile) {
    // useUserProfile() ya resuelve la prioridad foto-de-creador vs avatar de
    // espectador — ver UserProfileProvider.
    return {
      displayName:    supabase.displayName,
      avatarColor:    supabase.avatarColor,
      avatarIconId:   supabase.avatarIconId,
      avatarImageUrl: supabase.avatarImageUrl,
      isSubProfile:   false,
    };
  }

  const colorHex  = COLOR_VALUES[subProfile.color as AvatarColor] ?? "#22B16B";
  const isImage   = subProfile.avatarId.startsWith("/") || subProfile.avatarId.startsWith("data:");
  return {
    displayName:    subProfile.name,
    avatarColor:    colorHex,
    avatarIconId:   isImage ? "" : subProfile.avatarId,
    avatarImageUrl: isImage ? subProfile.avatarId : "",
    isSubProfile:   true,
  };
}
