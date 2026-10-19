/**
 * Modelo único del avatar de un perfil (cuenta principal o perfil secundario del selector).
 * Lógica pura, sin red ni React: la usan el servidor (APIs de comentarios y valoraciones, endpoint de
 * imágenes) y el cliente (todos los sitios donde se dibuja el redondel del perfil).
 *
 * Convención del identificador de avatar (`avatar_id`, el mismo en `profiles` y `sub_profiles`):
 *  - un icono del catálogo («cat»),
 *  - una ruta propia («/profiles/profile_01.jpg»),
 *  - una URL https,
 *  - o una imagen subida e incrustada («data:image/webp;base64,…»), ya reducida por el cliente.
 */

import { isValidIconId } from "@/lib/data/profile-avatars";

export type AvatarContent =
  | { readonly kind: "image"; readonly src: string }
  | { readonly kind: "icon"; readonly iconId: string }
  | { readonly kind: "initial" };

/** Tipos de imagen incrustada admitidos. SVG queda fuera a propósito: puede llevar scripts. */
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

/** Tamaño máximo de una imagen incrustada ya decodificada (las subidas se reducen a ~256 px). */
export const MAX_AVATAR_BYTES = 262_144;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Foto de perfil «externa» (creador o cuenta de Google): solo https. */
function httpsPhoto(value: string | null | undefined): AvatarContent | null {
  return value && isHttpsUrl(value) ? { kind: "image", src: value } : null;
}

/**
 * Identificador de avatar → contenido. `null` si está vacío, es peligroso (esquemas no permitidos,
 * rutas relativas al protocolo, SVG incrustado…) o es un icono que no está en el catálogo (p. ej. el antiguo
 * «estrella»): nunca se convierte en foto ni en icono, y el perfil muestra su inicial.
 */
export function avatarContentFromId(avatarId: string | null | undefined): AvatarContent | null {
  const id = avatarId?.trim() ?? "";
  if (id === "") return null;
  if (id.startsWith("/")) return id.startsWith("//") ? null : { kind: "image", src: id };
  if (id.startsWith("data:")) return DATA_IMAGE.test(id) ? { kind: "image", src: id } : null;
  if (id.includes(":")) return isHttpsUrl(id) ? { kind: "image", src: id } : null;
  return isValidIconId(id) ? { kind: "icon", iconId: id } : null;
}

/**
 * Avatar de un perfil principal. Prioridad: foto de creador → el elegido en el selector de perfiles →
 * foto de la cuenta de Google → inicial sobre el color del perfil. Elegir «sin avatar» (`""`) fuerza la inicial.
 */
export function pickAvatar(sources: {
  readonly creatorPhoto?: string | null;
  readonly chosen?: string | null;
  readonly providerPhoto?: string | null;
}): AvatarContent {
  const creator = httpsPhoto(sources.creatorPhoto);
  if (creator) return creator;
  // «» = eligió expresamente no tener avatar (inicial); nulo/ausente = nunca eligió (se usa la foto de la cuenta).
  if (sources.chosen === "") return { kind: "initial" };
  return avatarContentFromId(sources.chosen) ?? httpsPhoto(sources.providerPhoto) ?? { kind: "initial" };
}

export interface DecodedImage {
  readonly mime: string;
  readonly bytes: Uint8Array;
}

/** Imagen incrustada → tipo y bytes. `null` si no es un tipo permitido, no es base64 o es demasiado grande. */
export function decodeDataImage(dataUri: string | null | undefined): DecodedImage | null {
  const match = dataUri ? DATA_IMAGE.exec(dataUri) : null;
  if (!match) return null;
  const subtype = match[1] === "jpg" ? "jpeg" : match[1]!;
  const bytes = Uint8Array.from(Buffer.from(match[2]!, "base64"));
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return null;
  return { mime: `image/${subtype}`, bytes };
}

/** Huella corta y estable (FNV-1a de 32 bits en base 36) para cambiar la dirección cuando cambia la imagen. */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Dirección pública de una imagen incrustada. Las listas (comentarios, valoraciones) llevan esta
 * dirección corta en vez de la imagen entera; `v` cambia con el contenido, así que la caché del
 * navegador puede ser permanente.
 */
export function avatarEndpointUrl(userId: string, profileId: string, dataUri: string): string {
  return `/api/avatar?u=${encodeURIComponent(userId)}&p=${encodeURIComponent(profileId)}&v=${shortHash(dataUri)}`;
}
