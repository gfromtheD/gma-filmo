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
import { normalizeUsername, usernameProblem, usernameSaveError, type UsernameSaveError } from "@/lib/profiles/username";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  // Nombre personal: privado, solo lo ve su dueño.
  displayName:      string;
  // @usuario (sin la arroba): público y único; es el nombre que ven los demás. "" hasta que carga.
  username:         string;
  // Último cambio elegido del @; null = sigue el provisional (el primer cambio es libre).
  usernameChangedAt: Date | null;
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
  /** Guarda un @ nuevo. Devuelve null si se guardó o el motivo por el que no. */
  updateUsername:       (username: string) => Promise<UsernameSaveError | null>;
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
  username:          "",
  usernameChangedAt: null,
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
  updateUsername:       async () => "unknown",
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
    username:         "",
    usernameChangedAt: null,
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
      const [{ data: { user } }, { data: profileRow, error: profileError }, { data: creatorRow }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("display_name, avatar_color, avatar_url, avatar_id, username, username_changed_at")
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

      // Solo si de verdad no hay fila: si la consulta falla, crearla pisaría el nombre guardado.
      // La base de datos le da un @ provisional al crearla.
      let createdUsername = "";
      if (!profileRow && !profileError) {
        const { data: created } = await supabase.from("profiles").upsert({
          id:           userId!,
          display_name: emailLocal,
          avatar_color: defaultColor,
        }).select("username").maybeSingle();
        createdUsername = created?.username ?? "";
      }

      const savedName  = profileRow?.display_name?.trim() ?? "";
      const savedColor = profileRow?.avatar_color?.trim() ?? "";

      setProfile({
        displayName:      savedName && savedName !== "Espectador" ? savedName : emailLocal,
        username:         profileRow?.username ?? createdUsername,
        usernameChangedAt: profileRow?.username_changed_at ? new Date(profileRow.username_changed_at) : null,
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

  // La base de datos comprueba que esté libre y el plazo de 30 días; aquí solo se adelanta el formato.
  const updateUsername = useCallback(async (input: string): Promise<UsernameSaveError | null> => {
    if (!userId) return "unknown";
    const next = normalizeUsername(input);
    const problem = usernameProblem(next);
    if (problem) return problem;
    const { data, error } = await getSupabaseBrowserClient()
      .from("profiles")
      .update({ username: next })
      .eq("id", userId)
      .select("username, username_changed_at")
      .single();
    if (error || !data) return usernameSaveError(error);
    setProfile((prev) => ({
      ...prev,
      username: data.username,
      usernameChangedAt: data.username_changed_at ? new Date(data.username_changed_at) : null,
    }));
    return null;
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
        updateUsername,
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
