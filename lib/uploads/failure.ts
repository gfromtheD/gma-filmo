/**
 * Resumen seguro de una excepción para los registros del servidor (Vercel y ejecutor del VPS).
 * Sin dependencias de Next: lo usan tanto las rutas de la API como el ejecutor.
 * Recorta el mensaje y oculta cadenas largas que podrían ser claves o tokens.
 */
const LOG_MESSAGE_MAX = 300;

export function describeFailure(e: unknown): { name: string; code?: string; message: string } {
  const err = e as { name?: unknown; code?: unknown; message?: unknown } | null;
  const raw = typeof err?.message === 'string' ? err.message : String(e);
  const message = raw.replace(/[A-Za-z0-9+/_=-]{32,}/g, '[redacted]').slice(0, LOG_MESSAGE_MAX);
  return { name: typeof err?.name === 'string' ? err.name : typeof e, ...(typeof err?.code === 'string' ? { code: err.code } : {}), message };
}
