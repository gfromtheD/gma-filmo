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
    // La foto de creador (creator_profiles.avatar_url) gana sobre el avatar
    // de espectador guardado en local — solo hay una píldora para la cuenta.
    const creatorAvatarUrl = supabase.creatorAvatarUrl;
    return {
      displayName:    supabase.displayName,
      avatarColor:    supabase.avatarColor,
      avatarIconId:   creatorAvatarUrl ? "" : supabase.avatarIconId,
      avatarImageUrl: creatorAvatarUrl || supabase.avatarImageUrl,
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
