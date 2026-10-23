/** Margen por desfase de relojes entre R2 y el ejecutor. */
export const SIGNED_URL_SKEW_MS = 5 * 60 * 1000;

/**
 * Cuándo caduca una URL firmada de R2, leída de la propia URL (X-Amz-Date + X-Amz-Expires). Es el dato exacto: el `expiresAt`
 * guardado junto a la URL es el de la sesión (24 h), no el de la firma (máx. 1 h).
 */
export function signedUrlExpiry(signedUrl: unknown): number | null {
  if (typeof signedUrl !== "string") return null;
  let params: URLSearchParams;
  try { params = new URL(signedUrl).searchParams; } catch { return null; }
  const date = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(params.get("X-Amz-Date") ?? "");
  const seconds = Number(params.get("X-Amz-Expires"));
  if (!date || !Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const [, y, mo, d, h, mi, s] = date;
  const signedAt = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Number.isFinite(signedAt) ? signedAt + seconds * 1000 : null;
}

/**
 * Hasta cuándo hay que esperar antes de dar por borrado un archivo auxiliar (imagen, subtítulos) de R2. El borrado deja una marca
 * en la clave, pero una URL de subida que aún valga podría volver a crear el archivo: se espera a que caduque ESA URL. Una imagen
 * subida hace más de una hora queda confirmada al instante. Sin una URL legible se mantiene el plazo de la sesión (el más conservador).
 */
export function auxiliaryDeletionDeadline(sessionExpiresAt: string, signedUrl: unknown, now: number): number {
  const sessionDeadline = Math.max(now, Date.parse(sessionExpiresAt));
  const urlExpiry = signedUrlExpiry(signedUrl);
  if (urlExpiry === null) return sessionDeadline;
  return Math.min(sessionDeadline, urlExpiry + SIGNED_URL_SKEW_MS);
}
