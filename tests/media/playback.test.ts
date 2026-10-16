import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playbackSourceSchema } from '../../lib/media/contracts';
import type { PlaybackSource } from '../../types/playback';
import { legacyClientSource, PlaybackRecovery } from '../../lib/media/playback-client';
import type { MediaItem } from '../../types/catalog';

const validSource: PlaybackSource = {
  version: 1,
  kind: 'hls',
  mediaId: '11111111-1111-4111-8111-111111111111',
  titleSlug: 'sample-film',
  titleId: 42,
  revision: 3,
  url: 'https://media.example/hls/master.m3u8?cap=short-lived',
  mimeType: 'application/vnd.apple.mpegurl',
  p2p: 'none',
  fallback: null,
  expiresAt: Date.now() + 60_000,
  refreshUrl: '/api/titles/sample-film/playback',
  subtitles: [{
    id: 'subtitle-es',
    language: 'es',
    label: 'Español',
    url: '/api/media/11111111-1111-4111-8111-111111111111/subtitle?cap=short-lived',
    default: true,
    format: 'vtt',
  }],
  posterUrl: '/api/media/11111111-1111-4111-8111-111111111111?cap=short-lived',
  thumbnails: {
    vttUrl: '/api/media/11111111-1111-4111-8111-111111111111/thumbnails.vtt',
    imageUrl: 'https://media.example/thumbnails.webp?cap=short-lived',
    tileWidth: 320,
    tileHeight: 180,
  },
};

function playbackIdentity() {
  return {
    version: validSource.version,
    mediaId: validSource.mediaId,
    titleSlug: validSource.titleSlug,
    titleId: validSource.titleId,
    revision: validSource.revision,
    expiresAt: validSource.expiresAt,
    refreshUrl: validSource.refreshUrl,
    subtitles: validSource.subtitles,
    posterUrl: validSource.posterUrl,
    thumbnails: validSource.thumbnails,
  };
}

test('PlaybackSource v1 parses a complete title HLS source and draft preview', () => {
  assert.deepEqual(playbackSourceSchema.parse(validSource), validSource);

  const preview: PlaybackSource = {
    ...validSource,
    mediaId: '22222222-2222-4222-8222-222222222222',
    titleSlug: null,
    titleId: null,
    refreshUrl: '/api/media/22222222-2222-4222-8222-222222222222/playback',
  };
  assert.equal(playbackSourceSchema.parse(preview).titleId, null);
  assert.equal(playbackSourceSchema.parse(preview).titleSlug, null);
});

test('playback rejects unsupported engines, mixed title identity and unsafe URLs', () => {
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, p2p: 'enabled' }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, titleId: null }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, url: 'javascript:alert(1)' }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, url: 'http://media.example/master.m3u8' }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, url: 'https://user:password@media.example/a.m3u8' }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, refreshUrl: '//attacker.example/steal' }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...validSource, subtitles: [{ ...validSource.subtitles[0], url: '/api/../private' }] }).success, false);
});

test('legacy MP4 and YouTube sources share the DTO without exposing provider metadata', () => {
  const mp4: PlaybackSource = {
    ...playbackIdentity(),
    kind: 'mp4',
    url: 'https://legacy.example/film.mp4',
    mimeType: 'video/mp4',
    subtitles: [],
    thumbnails: null,
  };
  assert.equal(playbackSourceSchema.parse(mp4).kind, 'mp4');

  const youtube: PlaybackSource = {
    ...playbackIdentity(),
    kind: 'youtube',
    videoId: 'abcdefghijk',
    subtitles: [],
    thumbnails: null,
  };
  assert.equal(playbackSourceSchema.parse(youtube).kind, 'youtube');
  assert.equal(playbackSourceSchema.safeParse({ ...youtube, videoId: 'short' }).success, false);
  assert.equal(playbackSourceSchema.safeParse({ ...mp4, providerToken: 'must-not-leak' }).success, false);
});

test('legacy client compatibility is limited to public R2 and local responsive fixtures', () => {
  const item: MediaItem = { kind: 'movie', id: 'legacy', numericId: 10, title: 'Legacy', year: 2020, rating: 'TP', categories: [], synopsis: '',
    runtime: '10m', r2VideoUrl: 'https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/old.mp4', style: { tone: ['#000', '#111'], accent: '#fff', motif: 'ring' } };
  assert.equal(legacyClientSource(item)?.kind, 'mp4');
  assert.equal(legacyClientSource({ ...item, r2VideoUrl: 'https://attacker.invalid/old.mp4' }), null);
  assert.equal(legacyClientSource({ ...item, r2VideoUrl: 'http://127.0.0.1:3219/__responsive-video.mp4' })?.kind, 'mp4');
});

test('bounded playback recovery allows three network retries, one refresh and never recovers after 404', () => {
  const retry = new PlaybackRecovery();
  assert.deepEqual([retry.decide('network'), retry.decide('network'), retry.decide('network')],
    [{ kind: 'network', delay: 1000 }, { kind: 'network', delay: 2000 }, { kind: 'network', delay: 4000 }]);
  assert.deepEqual(retry.decide('network'), { kind: 'stop' });
  const auth = new PlaybackRecovery();
  assert.deepEqual(auth.decide('network', 403), { kind: 'refresh' });
  assert.deepEqual(auth.decide('network', 403), { kind: 'stop' });
  assert.deepEqual(new PlaybackRecovery().decide('network', 404), { kind: 'stop' });
});
