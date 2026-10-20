import assert from 'node:assert/strict';
import test from 'node:test';
import { describeFailure } from '../../lib/uploads/failure';
import { describeFailure as fromHttp } from '../../lib/uploads/http';

test('describeFailure keeps name, code and a trimmed message', () => {
  const error = Object.assign(new Error('R2 said no'), { code: 'AccessDenied' });
  assert.deepEqual(describeFailure(error), { name: 'Error', code: 'AccessDenied', message: 'R2 said no' });
});

test('describeFailure hides long key-like strings and caps the length', () => {
  const secret = 'A'.repeat(40);
  const out = describeFailure(new Error(`token ${secret} and ${'x '.repeat(400)}`));
  assert.ok(!out.message.includes(secret));
  assert.ok(out.message.includes('[redacted]'));
  assert.ok(out.message.length <= 300);
});

test('describeFailure copes with non-Error values', () => {
  assert.equal(describeFailure('boom').message, 'boom');
  assert.equal(describeFailure(null).message, 'null');
});

test('the API helper still exports the same function (no behaviour change for respond())', () => {
  assert.equal(fromHttp, describeFailure);
});
