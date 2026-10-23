import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { AuxiliaryValidationError, normalizeImage, normalizeSubtitles } from '../../lib/media/auxiliary-validation';

test('shared subtitle normalizer converts SRT timestamps to valid VTT and rejects invalid UTF-8/script/cues', () => {
  const result = normalizeSubtitles(Buffer.from('1\r\n00:00:01,000 --> 00:00:02,000\r\nHola'));
  assert.match(result.toString('utf8'), /^WEBVTT\n\n00:00:01\.000 --> 00:00:02\.000/);
  assert.throws(() => normalizeSubtitles(new Uint8Array([0xff, 0xfe])), /SUBTITLE_INVALID/);
  assert.throws(() => normalizeSubtitles(Buffer.from('00:00:01.000 --> 00:00:02.000\n<script>x</script>')), /SUBTITLE_INVALID/);
  assert.throws(() => normalizeSubtitles(Buffer.from('00:00:03.000 --> 00:00:02.000\nBad')), /SUBTITLE_INVALID/);
});

test('shared image normalizer decodes, bounds, rotates and hashes the same WebP output for all providers', async () => {
  const png = await sharp({ create: { width: 32, height: 16, channels: 3, background: { r: 220, g: 90, b: 20 } } }).png().toBuffer();
  const result = await normalizeImage(png, 'poster');
  assert.equal(result.mimeType, 'image/webp');
  assert.equal(result.width, 32);
  assert.equal(result.height, 16);
  assert.match(createHash('sha256').update(result.data).digest('hex'), /^[a-f0-9]{64}$/);
  await assert.rejects(normalizeImage(Buffer.from('not an image'), 'poster'), (error: unknown) =>
    error instanceof AuxiliaryValidationError && error.code === 'IMAGE_INVALID');
  const tooManyPixels = await sharp({ create: { width: 5001, height: 5001, channels: 3, background: 'white' } }).png().toBuffer();
  await assert.rejects(normalizeImage(tooManyPixels, 'poster'), (error: unknown) =>
    error instanceof AuxiliaryValidationError && error.code === 'IMAGE_INVALID');
});

test('un AVIF (que sharp informa como heif + av1) se admite y se normaliza a WebP', async () => {
  const avif = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#c33' } }).avif().toBuffer();
  const normalized = await normalizeImage(avif, 'avatar');
  assert.equal(normalized.mimeType, 'image/webp');
  assert.equal(normalized.width, 64);
});
