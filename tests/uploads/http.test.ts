import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeFailure, respond } from '../../lib/uploads/http';

test('respond logs the original exception and still answers UPLOAD_UNAVAILABLE', async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const secret = 'AKIA' + 'x'.repeat(40);
    const response = await respond(async () => { throw Object.assign(new Error(`AccessDenied key ${secret}`), { name: 'S3ServiceException', code: 'AccessDenied' }); });
    assert.equal(response.status, 503);
    assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'UPLOAD_UNAVAILABLE');
    assert.equal(logged.length, 1);
    const text = JSON.stringify(logged[0]);
    assert.match(text, /S3ServiceException/);
    assert.match(text, /AccessDenied/);
    assert.doesNotMatch(text, /xxxxxxxxxx/);
  } finally { console.error = original; }
});

test('respond does not log expected client errors', async () => {
  const original = console.error;
  let calls = 0;
  console.error = () => { calls += 1; };
  try {
    const { UploadError } = await import('../../lib/uploads/repository');
    const response = await respond(async () => { throw new UploadError('UPLOAD_INVALID_INPUT', 400); });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally { console.error = original; }
});

test('describeFailure copes with non-Error values', () => {
  assert.equal(describeFailure('boom').message, 'boom');
  assert.equal(describeFailure(null).message, 'null');
});
