import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalRequestHash } from '../../lib/media/idempotency';
import { MediaError } from '../../lib/media/errors';

test('canonical request hashes ignore object insertion order and preserve array order', () => {
  const first = { role: 'main', source: { bytes: 12, sha256: 'a'.repeat(64) }, slots: ['main', 'subtitle:es'] };
  const reordered = { slots: ['main', 'subtitle:es'], source: { sha256: 'a'.repeat(64), bytes: 12 }, role: 'main' };
  const otherOrder = { slots: ['subtitle:es', 'main'], source: { bytes: 12, sha256: 'a'.repeat(64) }, role: 'main' };

  assert.equal(canonicalRequestHash(first), canonicalRequestHash(reordered));
  assert.notEqual(canonicalRequestHash(first), canonicalRequestHash(otherOrder));
  assert.match(canonicalRequestHash(first), /^[a-f0-9]{64}$/);
});

test('reserve callers may omit only their root revision field', () => {
  const first = { revision: 2, draftId: 'draft-a', metadata: { revision: 1 } };
  const replay = { revision: 9, draftId: 'draft-a', metadata: { revision: 1 } };
  const changedMetadata = { revision: 9, draftId: 'draft-a', metadata: { revision: 2 } };

  const options = { omitTopLevel: ['revision'] };
  assert.equal(canonicalRequestHash(first, options), canonicalRequestHash(replay, options));
  assert.notEqual(canonicalRequestHash(first, options), canonicalRequestHash(changedMetadata, options));
  assert.notEqual(canonicalRequestHash(first), canonicalRequestHash(replay));
});

test('canonical request hashing rejects non-JSON, sparse, cyclic and excessive values', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const sparse: unknown[] = [];
  sparse[1] = 'hole';

  for (const invalid of [
    { value: undefined },
    { value: Number.NaN },
    { value: Number.POSITIVE_INFINITY },
    { value: BigInt(1) },
    { value: new Date('2026-10-07T00:00:00.000Z') },
    circular,
    { value: sparse },
  ]) {
    assert.throws(() => canonicalRequestHash(invalid), (error: unknown) =>
      error instanceof MediaError && error.code === 'UPLOAD_INVALID_INPUT',
    );
  }
});

test('canonical hashing preserves a JSON __proto__ field without mutating the hash object', () => {
  const withProtoKey = JSON.parse('{"__proto__":{"role":"extras"},"role":"main"}') as unknown;
  const withoutProtoKey = { role: 'main' };
  assert.notEqual(canonicalRequestHash(withProtoKey), canonicalRequestHash(withoutProtoKey));
});
