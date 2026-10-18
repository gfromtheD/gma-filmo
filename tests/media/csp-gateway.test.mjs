import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const original = process.env.MEDIA_GATEWAY_URL;
async function policyFor(gatewayUrl) {
  if (gatewayUrl === undefined) delete process.env.MEDIA_GATEWAY_URL; else process.env.MEDIA_GATEWAY_URL = gatewayUrl;
  const url = pathToFileURL(path.resolve('next.config.mjs'));
  url.searchParams.set('fixture', `${Math.random()}`);
  const rules = await (await import(url.href)).default.headers();
  const policy = rules[0].headers.find(item => item.key === 'Content-Security-Policy').value;
  const directive = name => policy.split('; ').find(part => part.startsWith(`${name} `)) ?? '';
  return { connect: directive('connect-src'), media: directive('media-src') };
}
test.after(() => { if (original === undefined) delete process.env.MEDIA_GATEWAY_URL; else process.env.MEDIA_GATEWAY_URL = original; });

test('an https gateway opens only its origin in connect-src and media-src', async () => {
  const { connect, media } = await policyFor('https://gateway.example.test/some/path?x=1');
  assert.ok(connect.split(' ').includes('https://gateway.example.test'));
  assert.ok(media.split(' ').includes('https://gateway.example.test'));
  assert.ok(!connect.includes('/some/path'));
});

test('a non-https, credentialed, malformed or absent gateway leaves the policy closed', async () => {
  for (const value of ['http://gateway.example.test', 'https://user:pass@gateway.example.test', 'not a url', '', undefined]) {
    const { connect, media } = await policyFor(value);
    assert.ok(!connect.includes('gateway.example.test') && !media.includes('gateway.example.test'), `closed for ${String(value)}`);
  }
});
