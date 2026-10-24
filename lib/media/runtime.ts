import {getMediaCapabilityIssuer} from './capabilities';
import path from 'node:path';
import { getMediaConfig } from './config';
import { MediaProviderRegistry } from './registry';
import type { MediaCapabilityIssuer } from './provider';
import { MediaRepository } from './repository';
import { MockMediaProvider } from './providers/mock';
import { MockMediaStorage } from './mock-storage';
import { R2MediaProvider } from './providers/r2';
import { StreamMediaProvider } from './providers/stream';
import { PeerTubeMediaProvider } from './providers/peertube';
import { PeerTubeClient } from './providers/peertube-client';
import { R2VideoProvider } from '@/lib/uploads/r2-video';
import { AuxiliaryProvider } from '@/lib/uploads/auxiliary';
import { StreamProvider } from '@/lib/uploads/stream';
import { getStreamConfig, getUploadConfig, requiredEnv } from '@/lib/uploads/config';
import { MediaError } from './errors';
import { mediaProofSchema } from './contracts';
import type { UploadReceipt } from '@/types/media-engine';

export function getMockStorage(): MockMediaStorage {
  if (!getMediaConfig().mockEnabled) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
  return new MockMediaStorage(path.resolve(requiredEnv('MEDIA_MOCK_STORAGE_DIR')));
}
export function createMediaRegistry(repository: MediaRepository, issuer?: MediaCapabilityIssuer): MediaProviderRegistry {
  const signer=issuer??{issue: (input: import('./provider').MediaCapabilityInput)=>getMediaCapabilityIssuer().issue(input)};
  return new MediaProviderRegistry({
    // Con pasarela, imágenes y subtítulos suben por ella: las IP de R2 se bloquean en España durante los partidos de LaLiga.
    r2: () => { const config = getUploadConfig(); const gatewayUrl = process.env.MEDIA_GATEWAY_URL;
      return new R2MediaProvider(new R2VideoProvider(config.bucket), new AuxiliaryProvider(config.bucket), gatewayUrl ? { gatewayUrl, issuer: signer } : undefined); },
    stream: () => new StreamMediaProvider(new StreamProvider(getStreamConfig())),
    mock: () => new MockMediaProvider(getMockStorage(), repository, requiredEnv('MEDIA_GATEWAY_URL'), signer),
    peertube: () => {
      if (!getMediaConfig().peerTubeEnabled) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
      return new PeerTubeMediaProvider(new PeerTubeClient({ baseUrl: requiredEnv('PEERTUBE_BASE_URL'), username: requiredEnv('PEERTUBE_USERNAME'),
        password: requiredEnv('PEERTUBE_PASSWORD'), channelId: Number(requiredEnv('PEERTUBE_CHANNEL_ID')) }), requiredEnv('MEDIA_GATEWAY_URL'), signer, {
        async get(context) {
          const state = await repository.optionalPrivateState(context.session.id);
          const receipt = state.receipt ?? state.provisional_receipt;
          if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || !('proof' in receipt) || !mediaProofSchema.safeParse(receipt.proof).success) return null;
          return receipt as unknown as UploadReceipt;
        },
      });
    },
  });
}
