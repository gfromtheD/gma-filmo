import type { IncomingMessage } from 'node:http';
import { MediaError } from '../errors';
import { readChunk } from './spool';

/** Lo que tarda como mucho R2 en aceptar una imagen (≤ 12 MB) desde el VPS. */
const R2_PUT_TIMEOUT_MS = 30_000;
const R2_HOST = /\.r2\.cloudflarestorage\.com$/;

/**
 * Imágenes y subtítulos del proveedor R2 pasan por la pasarela: los operadores españoles bloquean las IP de Cloudflare (R2)
 * durante los partidos de LaLiga y el navegador no podría subirlos. La pasarela (Hetzner, no bloqueada) comprueba los bytes
 * contra el SHA-256 declarado y los deja en R2 con la URL firmada de la sesión. Después el servidor los verifica igual que antes.
 */
export async function relayAuxiliaryToR2(request: IncomingMessage,
  session: { expected_input_bytes: number; content_type: string; source_sha256: string },
  privateState: Record<string, unknown>, put: typeof fetch = fetch): Promise<void> {
  const url = privateState.uploadUrl;
  if (typeof url !== 'string') throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
  const target = new URL(url);
  if (target.protocol !== 'https:' || !R2_HOST.test(target.hostname)) throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
  const body = await readChunk(request, session.expected_input_bytes);
  if (body.sha256 !== session.source_sha256) throw new MediaError('UPLOAD_SOURCE_MISMATCH');
  const response = await put(target, { method: 'PUT', body: new Uint8Array(body.bytes), headers: { 'Content-Type': session.content_type },
    signal: AbortSignal.timeout(R2_PUT_TIMEOUT_MS) }).catch(() => null);
  if (!response?.ok) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
}
