/**
 * Pasarela multimedia GMA en el VPS (producción): recibe las subidas reanudables del navegador y las reenvía a PeerTube,
 * y entrega el HLS de PeerTube autorizado por capacidades GMA. Escucha solo en 127.0.0.1; Nginx publica /transfer y /playback.
 *
 * Variables (en /etc/gma/media.env, 0600, nunca en Git):
 *  UPLOAD_ENVIRONMENT=production · UPLOAD_ENGINE_V2=true · MEDIA_VIDEO_PROVIDER=peertube · PEERTUBE_PROVIDER_ENABLED=true
 *  MEDIA_GATEWAY_URL (https) · MEDIA_GATEWAY_ORIGINS (orígenes web de GMA separados por comas)
 *  PEERTUBE_BASE_URL · PEERTUBE_USERNAME · PEERTUBE_PASSWORD · PEERTUBE_CHANNEL_ID
 *  MEDIA_CAPABILITY_PUBLIC_KEY_FILE · MEDIA_CAPABILITY_KEY_ID · MEDIA_SPOOL_DIR
 *  NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (repositorio del motor, solo servidor)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMediaGateway } from '../../lib/media/gateway/server';
import { createPeerTubeDelivery } from '../../lib/media/gateway/peertube-delivery';
import { MediaRepository } from '../../lib/media/repository';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { PeerTubeClient } from '../../lib/media/providers/peertube-client';
import { getMediaConfig } from '../../lib/media/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MEDIA_GATEWAY_ENV_REQUIRED:${name}`);
  return value;
}

async function main() {
  const config = getMediaConfig();
  if (config.environment === 'local' || config.defaultVideoProvider !== 'peertube' || !config.peerTubeEnabled || !config.gatewayUrl) {
    throw new Error('MEDIA_GATEWAY_PRODUCTION_CONFIG');
  }
  const origins = required('MEDIA_GATEWAY_ORIGINS').split(',').map(o => o.trim()).filter(Boolean);
  for (const origin of origins) { const u = new URL(origin); if (u.origin !== origin || (u.protocol !== 'https:' && u.hostname !== 'localhost')) throw new Error('MEDIA_GATEWAY_ORIGIN_INVALID'); }
  const kid = required('MEDIA_CAPABILITY_KEY_ID');
  const publicKeys = { [kid]: await readFile(required('MEDIA_CAPABILITY_PUBLIC_KEY_FILE'), 'utf8') };
  const peerTube = new PeerTubeClient({ baseUrl: required('PEERTUBE_BASE_URL'), username: required('PEERTUBE_USERNAME'),
    password: required('PEERTUBE_PASSWORD'), channelId: Number(required('PEERTUBE_CHANNEL_ID')) });
  await peerTube.validateInstance();
  const repository = new MediaRepository();
  const storage = new MockMediaStorage(path.resolve(required('MEDIA_SPOOL_DIR')));
  const deps = { repository, storage, publicKeys, origins, peerTube };
  const server = createMediaGateway(deps, createPeerTubeDelivery({ repository, client: peerTube, publicKeys }));
  server.requestTimeout = 120_000; server.headersTimeout = 15_000; server.maxHeadersCount = 40;
  server.listen(Number(process.env.MEDIA_GATEWAY_PORT ?? 4319), '127.0.0.1', () => console.log('MEDIA_GATEWAY_READY'));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
}

void main().catch((error: unknown) => {
  console.error('MEDIA_GATEWAY_START_FAILED', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
});
