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
import { avatarContentFromId, pickAvatar } from "@/lib/profiles/avatar";
import { resizeToAvatarDataUrl } from "@/lib/profiles/image-resize";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  displayName:      string;
  email:            string | null;
  memberSince:      Date | null;
  avatarColor:      string;
  // Foto subida en el perfil de creador (creator_profiles.avatar_url). Cuando
  // existe, gana sobre el avatar de espectador para la píldora del navbar —
  // ver useActiveProfileDisplay.
  creatorAvatarUrl: string;
  // Foto de la cuenta de Google (profiles.avatar_url): último recurso antes de la inicial.
  providerPhotoUrl: string;
  // Avatar elegido para el perfil principal (profiles.avatar_id): icono, ruta o imagen reducida.
  // null = nunca eligió; "" = eligió expresamente no tener avatar (inicial).
  chosenAvatarId:   string | null;
}

interface UserProfileContextValue extends UserProfile, ProfileSettings {
  userId:               string | null;
  isLoaded:             boolean;
  updateDisplayName:    (name: string) => Promise<void>;
  updateAvatarColor:    (color: string) => Promise<void>;
  updateSettings:       (patch: Partial<ProfileSettings>) => void;
  refreshCreatorAvatar: () => Promise<void>;
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
  creatorAvatarUrl:  "",
  providerPhotoUrl:  "",
  chosenAvatarId:    null,
  userId:            null,
  isLoaded:          false,
  ...DEFAULT_SETTINGS,
  updateDisplayName:    async () => {},
  updateAvatarColor:    async () => {},
  updateSettings:       () => {},
  refreshCreatorAvatar: async () => {},
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
    displayName:      "",
    email:            null,
    memberSince:      null,
    avatarColor:      "#22B16B",
    creatorAvatarUrl: "",
    providerPhotoUrl: "",
    chosenAvatarId:   null,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Extended settings from localStorage (icon, image, kids, PIN, autoplay)
  const { settings, updateSettings } = useProfileSettings(userId);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const [{ data: { user } }, { data: profileRow }, { data: creatorRow }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("display_name, avatar_color, avatar_url, avatar_id")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("creator_profiles")
          .select("avatar_url")
          .eq("user_id", userId!)
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
        displayName:      savedName && savedName !== "Espectador" ? savedName : emailLocal,
        email:            user.email ?? null,
        memberSince:      user.created_at ? new Date(user.created_at) : null,
        avatarColor:      savedColor || defaultColor,
        creatorAvatarUrl: creatorRow?.avatar_url ?? "",
        providerPhotoUrl: profileRow?.avatar_url ?? "",
        chosenAvatarId:   profileRow?.avatar_id ?? null,
      });
      setIsLoaded(true);
    }

    void load();
  }, [userId]);

  // Recarga solo la foto de creador — se llama justo tras guardarla en el
  // wizard, para que la píldora la muestre sin esperar a un remount completo.
  const refreshCreatorAvatar = useCallback(async () => {
    if (!userId) return;
    const { data } = await getSupabaseBrowserClient()
      .from("creator_profiles")
      .select("avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile((prev) => ({ ...prev, creatorAvatarUrl: data?.avatar_url ?? "" }));
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

  // El avatar del perfil principal vive en la base de datos (profiles.avatar_id), no solo en el navegador:
  // así lo ven los demás (comentarios, valoraciones…) y es el mismo en todos tus dispositivos.
  const saveChosenAvatar = useCallback(async (avatarId: string | null) => {
    if (!userId) return;
    setProfile((prev) => ({ ...prev, chosenAvatarId: avatarId }));
    await getSupabaseBrowserClient().from("profiles").update({ avatar_id: avatarId }).eq("id", userId);
  }, [userId]);

  const updateSettingsAndAvatar = useCallback((patch: Partial<ProfileSettings>) => {
    updateSettings(patch);
    if ("avatarIconId" in patch || "avatarImageUrl" in patch) {
      const next = { avatarIconId: settings.avatarIconId, avatarImageUrl: settings.avatarImageUrl, ...patch };
      // Sin foto ni icono = eligió la inicial ("" explícito).
      void saveChosenAvatar(next.avatarImageUrl || next.avatarIconId || "");
    }
  }, [updateSettings, saveChosenAvatar, settings.avatarIconId, settings.avatarImageUrl]);

  // Migración única: si el avatar solo existía en este navegador (localStorage), se sube a la base de datos
  // (reducido si es una imagen grande) para que lo vean todos.
  useEffect(() => {
    if (!isLoaded || !userId || profile.chosenAvatarId !== null) return;
    const legacy = settings.avatarImageUrl || settings.avatarIconId;
    if (!legacy || !avatarContentFromId(legacy)) return;
    let cancelled = false;
    void (async () => {
      let avatarId = legacy;
      if (legacy.startsWith("data:")) {
        try { avatarId = await resizeToAvatarDataUrl(legacy); } catch { return; }
      }
      if (!cancelled) await saveChosenAvatar(avatarId);
    })();
    return () => { cancelled = true; };
  }, [isLoaded, userId, profile.chosenAvatarId, settings.avatarImageUrl, settings.avatarIconId, saveChosenAvatar]);

  // Un solo criterio para todo el sitio: foto de creador → avatar elegido → foto de la cuenta → inicial.
  const avatar = pickAvatar({
    creatorPhoto: profile.creatorAvatarUrl || null,
    chosen: profile.chosenAvatarId ?? (settings.avatarImageUrl || settings.avatarIconId || null),
    providerPhoto: profile.providerPhotoUrl || null,
  });

  return (
    <UserProfileContext.Provider
      value={{
        ...profile,
        ...settings,
        // Mismo criterio que ve el resto de usuarios (ver pickAvatar): cualquier consumidor de
        // useUserProfile() (píldora, selector de perfiles, ajustes…) recibe ya el valor correcto.
        avatarImageUrl: avatar.kind === "image" ? avatar.src : "",
        avatarIconId:   avatar.kind === "icon" ? avatar.iconId : "",
        userId,
        isLoaded,
        updateDisplayName,
        updateAvatarColor,
        updateSettings: updateSettingsAndAvatar,
        refreshCreatorAvatar,
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
