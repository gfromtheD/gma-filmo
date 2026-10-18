import assert from 'node:assert/strict';
import test from 'node:test';
import { isManagedPlayback, legacySourceFor, playbackEndpointFor } from '@/lib/media/player-adapter';
import { PlaybackService } from '@/lib/media/playback-service';
import type { MediaItem } from '@/types/catalog';

const R2 = 'https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/videos/yasha.mp4';
const item = (patch: Partial<MediaItem>) => ({ id: 'yasha', numericId: 1, title: 'Yasha', r2VideoUrl: R2, ...patch }) as unknown as MediaItem;

test('los títulos históricos no piden el resolvedor autorizado y se reproducen como hoy', () => {
  const legacy = item({ playbackRef: { titleSlug: 'yasha', mode: 'legacy' } as never, playbackKind: 'legacy' });
  assert.equal(isManagedPlayback(legacy), false);
  assert.equal(playbackEndpointFor(legacy), null);
  const source = legacySourceFor(legacy);
  assert.equal(source?.kind, 'mp4');
  assert.equal(source && 'url' in source ? source.url : null, R2);
});

test('los títulos del motor usan el resolvedor autorizado y nunca una URL del navegador', () => {
  const managed = item({ playbackRef: { titleSlug: 'yasha', mode: 'managed' } as never, playbackKind: 'media' });
  assert.equal(playbackEndpointFor(managed), '/api/titles/yasha/playback');
  assert.equal(legacySourceFor(managed), null);
});

function service(row: Record<string, unknown> | null) {
  const repo = { async title() { if (!row) throw Object.assign(new Error('UPLOAD_NOT_FOUND'), { code: 'UPLOAD_NOT_FOUND' }); return row; } };
  return new PlaybackService(repo as never, {} as never);
}

test('motor apagado: la reproducción histórica se resuelve sin tablas gma_* y respeta la visibilidad', async () => {
  const published = await service({ id: 1, slug: 'yasha', status: 'published', r2_video_url: R2 }).resolveLegacyOnly('yasha', null);
  assert.equal(published.kind, 'mp4');
  await assert.rejects(service({ id: 2, slug: 'oculta', status: 'unpublished', creator_user_id: '11111111-1111-4111-8111-111111111111', r2_video_url: R2 }).resolveLegacyOnly('oculta', null));
  await assert.rejects(service({ id: 3, slug: 'gestionada', status: 'published', playback_kind: 'media' }).resolveLegacyOnly('gestionada', null), /MEDIA_PLAYBACK_UNSUPPORTED|proveedor|reproduc/i);
});
