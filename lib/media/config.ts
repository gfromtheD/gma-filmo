import { z } from 'zod';
import type { MediaProviderKey } from '@/types/media-engine';

const providerSchema = z.enum(['r2', 'stream', 'mock', 'peertube']);
const envBoolean = (value: string | undefined) => value === 'true';

function loopback(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch { return false; }
}

export interface MediaConfig {
  environment: 'local' | 'staging' | 'production';
  defaultVideoProvider: MediaProviderKey;
  auxiliaryProvider: 'r2' | 'mock';
  mockEnabled: boolean;
  gatewayUrl: string | null;
  peerTubeEnabled: boolean;
}

export function getMediaConfig(env: Record<string, string | undefined> = process.env): MediaConfig {
  const environment = z.enum(['local', 'staging', 'production']).parse(env.UPLOAD_ENVIRONMENT ?? 'local');
  const selected = env.MEDIA_VIDEO_PROVIDER ?? env.VIDEO_PROVIDER ?? 'r2';
  const defaultVideoProvider = providerSchema.parse(selected);
  const auxiliaryProvider = z.enum(['r2', 'mock']).parse(env.MEDIA_AUXILIARY_PROVIDER ?? 'r2');
  const mockEnabled = envBoolean(env.MEDIA_MOCK_ENABLED);
  const peerTubeEnabled = envBoolean(env.PEERTUBE_PROVIDER_ENABLED);
  const gatewayUrl = env.MEDIA_GATEWAY_URL?.trim() || null;

  if (mockEnabled && (environment !== 'local' || !loopback(env.SUPABASE_URL ?? ''))) {
    throw new Error('MEDIA_MOCK_LOCAL_ONLY');
  }
  if (defaultVideoProvider === 'mock' && !mockEnabled) throw new Error('MEDIA_MOCK_DISABLED');
  if (defaultVideoProvider === 'stream' && env.STREAM_PROVIDER_ENABLED !== 'true') throw new Error('UPLOAD_STREAM_DISABLED');
  if (defaultVideoProvider === 'peertube' && !peerTubeEnabled) throw new Error('PEERTUBE_PROVIDER_DISABLED');
  if (gatewayUrl) {
    const parsed = new URL(gatewayUrl);
    const isLocal = loopback(gatewayUrl);
    if ((environment === 'local' && !isLocal) || (environment !== 'local' && parsed.protocol !== 'https:')) {
      throw new Error('MEDIA_GATEWAY_ORIGIN_INVALID');
    }
  }
  return { environment, defaultVideoProvider, auxiliaryProvider, mockEnabled, gatewayUrl, peerTubeEnabled };
}

export function mediaProviderForPersistedValue(value: string): MediaProviderKey {
  return providerSchema.parse(value);
}
