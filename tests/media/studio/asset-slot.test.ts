import assert from 'node:assert/strict';
import test from 'node:test';
import { studioAssetSlot } from '@/components/features/studio/studio-asset-slot';

test('subtitles are restored by language while other auxiliary roles retain one stable slot', () => {
  assert.equal(studioAssetSlot('subtitles', 'es'), 'subtitles:es');
  assert.equal(studioAssetSlot('subtitles', 'en'), 'subtitles:en');
  assert.notEqual(studioAssetSlot('subtitles', 'es'), studioAssetSlot('subtitles', 'en'));
  assert.equal(studioAssetSlot('poster_h', null), 'poster_h');
});
