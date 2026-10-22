/** Una URL firmada de subida a R2 vale como mucho 1 h; se deja otra hora de margen por si se firmó justo antes de cancelar. */
export const SIGNED_URL_GRACE_MS = 60 * 60 * 1000;

/**
 * Hasta cuándo hay que esperar antes de dar por borrado un archivo auxiliar (imagen, subtítulos) de R2. El borrador deja una marca
 * en la clave para que nadie la resucite con una URL firmada que aún valga; el plazo que importa es el de ESA URL, no el de la
 * sesión de subida (24 h), que mantenía una obra «eliminando» un día entero aunque el archivo ya no existiera.
 * Sin dato fiable de la URL se mantiene el plazo de la sesión (el más conservador).
 */
export function auxiliaryDeletionDeadline(sessionExpiresAt: string, signedUrlExpiresAt: unknown, now: number): number {
  const sessionDeadline = Math.max(now, Date.parse(sessionExpiresAt));
  const urlExpiry = typeof signedUrlExpiresAt === "string" ? Date.parse(signedUrlExpiresAt) : Number.NaN;
  if (!Number.isFinite(urlExpiry)) return sessionDeadline;
  return Math.min(sessionDeadline, Math.max(now, urlExpiry) + SIGNED_URL_GRACE_MS);
}
