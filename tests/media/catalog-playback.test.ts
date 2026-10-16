import test from 'node:test';
import assert from 'node:assert/strict';
import { toPlaybackReference } from '@/lib/media/catalog-playback';

test('7.1 catalog reference distinguishes managed media/R2/Stream and preserves legacy title identity without provider calls', () => {
  for (const kind of ['media', 'stream', 'r2_hls']) {
    assert.deepEqual(toPlaybackReference('local-title', kind), { titleSlug: 'local-title', mode: 'managed' });
  }
  for (const kind of ['legacy', undefined, null]) {
    assert.deepEqual(toPlaybackReference('old-title', kind), { titleSlug: 'old-title', mode: 'legacy' });
  }
});
