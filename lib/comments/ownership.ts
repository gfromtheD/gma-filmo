/**
 * Propiedad de los comentarios cuando una cuenta tiene varios perfiles: cada perfil gestiona solo lo suyo.
 * `profile_id` vacío o ausente = perfil principal de la cuenta (así están los comentarios antiguos).
 */

interface CommentOwner {
  readonly user_id: string;
  readonly profile_id?: string | null;
}

/** ¿Lo escribió el perfil activo de esta cuenta? Decide «Tú», «Editar» y «Eliminar» en pantalla. */
export function isOwnComment(comment: CommentOwner, viewerUserId: string | null, viewerProfileId: string): boolean {
  if (!viewerUserId || comment.user_id !== viewerUserId) return false;
  return (comment.profile_id ?? "") === viewerProfileId;
}

/** Misma comprobación en el servidor, con lo guardado en la base de datos. */
export function ownsStoredComment(stored: CommentOwner, userId: string, profileId: string): boolean {
  return isOwnComment(stored, userId, profileId);
}

/** Perfil activo que declara el cliente en el cuerpo de la petición (vacío = perfil principal). */
export function requestProfileId(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>).profileId;
  return typeof value === "string" && value.length <= 64 ? value : "";
}

interface LikeOwner {
  readonly user_id: string;
  readonly profile_id?: string | null;
}

/** ¿Este perfil de esta cuenta ya dio «De acuerdo»? Cada perfil de una cuenta cuenta por separado. */
export function hasLiked(likes: readonly LikeOwner[], userId: string | null, profileId: string): boolean {
  if (!userId) return false;
  return likes.some((like) => like.user_id === userId && (like.profile_id ?? "") === profileId);
}
