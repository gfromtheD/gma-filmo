import assert from 'node:assert/strict';
import test from 'node:test';
import { videoExtension } from '../../lib/media/providers/peertube';

test('videoExtension maps the declared content type to an extension PeerTube accepts', () => {
  assert.equal(videoExtension('video/mp4'), '.mp4');
  assert.equal(videoExtension('video/quicktime'), '.mov');
  assert.equal(videoExtension('video/x-matroska'), '.mkv');
  assert.equal(videoExtension('Video/WebM; codecs=vp9'), '.webm');
});

test('videoExtension falls back to .mp4 for unknown content types', () => {
  assert.equal(videoExtension('application/octet-stream'), '.mp4');
});
