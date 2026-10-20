/**
 * Cómo se muestra al autor de un comentario o una valoración: el @usuario de la cuenta, con la foto o el icono
 * y el color del perfil con el que escribió (el principal de la cuenta o uno secundario del selector de perfiles). Lógica pura; la usan las
 * APIs de comentarios y valoraciones y no depende de la red.
 */

import { avatarContentFromId, avatarEndpointUrl, pickAvatar, type AvatarContent } from "@/lib/profiles/avatar";
import { formatHandle } from "@/lib/profiles/username";

export interface AccountProfile {
  /** @usuario de la cuenta (sin la arroba): el único nombre que ven los demás. El nombre personal es privado. */
  readonly username: string | null;
  /** Foto de la cuenta de Google (inicio de sesión). */
  readonly avatar_url: string | null;
  readonly avatar_color: string | null;
  /** Avatar elegido por el usuario para su perfil principal (misma convención que `sub_profiles.avatar_id`). */
  readonly avatar_id: string | null;
}

/** Perfil secundario del selector de perfiles (`sub_profiles`). */
export interface SubProfile {
  readonly name: string;
  /** Icono del catálogo, ruta propia («/profiles/…»), URL https o imagen incrustada («data:image/…»). */
  readonly avatar_id: string;
  /** Identificador de color («purple») o color hexadecimal. */
  readonly color: string;
}

export interface AuthorDisplay {
  /** «@usuario» de la cuenta, también cuando se escribe con un perfil secundario. */
  readonly displayName: string;
  /** Foto: https, ruta propia o dirección corta de una imagen subida. `null` si es un icono o no hay foto. */
  readonly avatarUrl: string | null;
  /** Icono del catálogo cuando el perfil elige uno en vez de una foto. */
  readonly avatarIconId: string | null;
  /** Identificador de color («purple») o color hexadecimal; el cliente lo convierte con `COLOR_VALUES`. */
  readonly avatarColor: string | null;
}

/** Clave estable de un autor: cuenta + perfil (`""` = perfil principal). */
export function authorKey(userId: string, profileId: string | null | undefined): string {
  return `${userId}|${profileId ?? ""}`;
}

function toDisplayParts(
  content: AvatarContent,
  userId: string,
  profileId: string,
): Pick<AuthorDisplay, "avatarUrl" | "avatarIconId"> {
  if (content.kind === "icon") return { avatarUrl: null, avatarIconId: content.iconId };
  if (content.kind === "image") {
    // Las imágenes subidas (incrustadas) no viajan dentro de las listas: se sirven por una dirección corta.
    const url = content.src.startsWith("data:") ? avatarEndpointUrl(userId, profileId, content.src) : content.src;
    return { avatarUrl: url, avatarIconId: null };
  }
  return { avatarUrl: null, avatarIconId: null };
}

export function resolveAuthor(input: {
  readonly userId: string;
  /** `""` = perfil principal de la cuenta. */
  readonly profileId: string;
  readonly account: AccountProfile | null;
  readonly sub: SubProfile | null;
  /** Foto del perfil de creador de la cuenta (solo aplica al perfil principal). */
  readonly creatorPhoto: string | null;
  readonly fallbackName?: string;
}): AuthorDisplay {
  const { userId, profileId, account, sub, creatorPhoto, fallbackName = "Usuario" } = input;
  const displayName = account?.username ? formatHandle(account.username) : fallbackName;

  if (sub) {
    return {
      displayName,
      ...toDisplayParts(avatarContentFromId(sub.avatar_id) ?? { kind: "initial" }, userId, profileId),
      avatarColor: sub.color || null,
    };
  }

  const content = pickAvatar({ creatorPhoto, chosen: account?.avatar_id, providerPhoto: account?.avatar_url });
  return {
    displayName,
    ...toDisplayParts(content, userId, ""),
    avatarColor: account?.avatar_color ?? null,
  };
}
