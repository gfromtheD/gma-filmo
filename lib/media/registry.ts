import type { MediaProviderKey } from '@/types/media-engine';
import type { MediaProvider } from './provider';
import { getMediaConfig, mediaProviderForPersistedValue } from './config';

export type MediaProviderFactory = () => MediaProvider;
export type MediaProviderFactories = Readonly<Record<MediaProviderKey, MediaProviderFactory>>;

/** Instantiates a provider only when a persisted asset/session needs it. */
export class MediaProviderRegistry {
  private readonly instances = new Map<MediaProviderKey, MediaProvider>();

  constructor(
    private readonly factories: MediaProviderFactories,
    private readonly defaultProvider: () => MediaProviderKey = () => getMediaConfig().defaultVideoProvider,
  ) {}

  defaultForNewReservation(): MediaProviderKey { return this.defaultProvider(); }

  get(persistedProvider: string): MediaProvider {
    const key = mediaProviderForPersistedValue(persistedProvider);
    const existing = this.instances.get(key);
    if (existing) return existing;
    const provider = this.factories[key]();
    if (provider.key !== key) throw new Error('MEDIA_PROVIDER_FACTORY_MISMATCH');
    this.instances.set(key, provider);
    return provider;
  }
}
