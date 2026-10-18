import assert from 'node:assert/strict';
import test from 'node:test';
import { receivedBytesFromRange } from '../../lib/media/providers/peertube-client';

test('receivedBytesFromRange treats an absent Range as nothing received', () => {
  assert.equal(receivedBytesFromRange(null), 0);
});

test('receivedBytesFromRange treats PeerTube "bytes=0--1" (fresh lease) as nothing received', () => {
  assert.equal(receivedBytesFromRange('bytes=0--1'), 0);
});

test('receivedBytesFromRange converts an inclusive end to a byte count', () => {
  assert.equal(receivedBytesFromRange('bytes=0-0'), 1);
  assert.equal(receivedBytesFromRange('bytes=0-7'), 8);
});

test('receivedBytesFromRange rejects malformed or non-zero-based ranges', () => {
  for (const bad of ['bytes=1-7', 'bytes=0-', 'bytes=0--2', 'items=0-7', '']) assert.equal(receivedBytesFromRange(bad), null);
});
