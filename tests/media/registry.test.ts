import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MediaProvider } from '../../lib/media/provider';
import { getMediaConfig } from '../../lib/media/config';
import { MediaProviderRegistry, type MediaProviderFactories } from '../../lib/media/registry';

function provider(key: MediaProvider['key']): MediaProvider {
  return { key } as MediaProvider;
}

test('registry is lazy and resolves a persisted R2 asset after new reservations switch to Mock', () => {
  const constructed: string[] = [];
  const factories: MediaProviderFactories = {
    r2: () => { constructed.push('r2'); return provider('r2'); },
    stream: () => { constructed.push('stream'); return provider('stream'); },
    mock: () => { constructed.push('mock'); return provider('mock'); },
    peertube: () => { constructed.push('peertube'); return provider('peertube'); },
  };
  const registry = new MediaProviderRegistry(factories, () => 'mock');
  assert.deepEqual(constructed, []);
  assert.equal(registry.defaultForNewReservation(), 'mock');
  assert.equal(registry.get('r2').key, 'r2');
  assert.equal(registry.get('r2').key, 'r2');
  assert.deepEqual(constructed, ['r2']);
});

test('Mock local config needs no Cloudflare/Stream/PeerTube credentials and rejects remote or production mode', () => {
  const config = getMediaConfig({
    UPLOAD_ENVIRONMENT: 'local', SUPABASE_URL: 'http://127.0.0.1:54341',
    MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_AUXILIARY_PROVIDER: 'mock', MEDIA_MOCK_ENABLED: 'true',
    MEDIA_GATEWAY_URL: 'http://127.0.0.1:4319',
  });
  assert.equal(config.defaultVideoProvider, 'mock');
  assert.equal(config.auxiliaryProvider, 'mock');
  assert.throws(() => getMediaConfig({
    UPLOAD_ENVIRONMENT: 'production', SUPABASE_URL: 'https://db.example.test',
    MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_MOCK_ENABLED: 'true',
  }), /MEDIA_MOCK_LOCAL_ONLY/);
});

test('legacy VIDEO_PROVIDER remains a reservation fallback and Stream admission gate remains enforced', () => {
  assert.equal(getMediaConfig({ UPLOAD_ENVIRONMENT: 'local', VIDEO_PROVIDER: 'r2' }).defaultVideoProvider, 'r2');
  assert.throws(() => getMediaConfig({ UPLOAD_ENVIRONMENT: 'local', VIDEO_PROVIDER: 'stream' }), /UPLOAD_STREAM_DISABLED/);
});
