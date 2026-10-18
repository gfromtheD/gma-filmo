import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localFixtureImage } from '../../infrastructure/media-local/image-loader.ts';

const required = {
  UPLOAD_ENVIRONMENT: 'local', UPLOAD_ISOLATION_ACK: 'true', MEDIA_LOCAL_PROJECT_ID: 'gma-filmo-media-local',
  MEDIA_LOCAL_ISOLATED: 'true', UPLOAD_ENGINE_V2: 'true', NEXT_PUBLIC_UPLOAD_ENGINE_V2: 'true', MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_AUXILIARY_PROVIDER: 'mock', MEDIA_MOCK_ENABLED: 'true',
  PEERTUBE_PROVIDER_ENABLED: 'false', STREAM_PROVIDER_ENABLED: 'false', SUPABASE_URL: 'http://127.0.0.1:54341',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54341', MEDIA_GATEWAY_URL: 'http://127.0.0.1:4319',
};
const keys = Object.keys(required);
const original = new Map([...keys, 'NEXT_PUBLIC_R2_PUBLIC_URL'].map(key => [key, process.env[key]]));
async function configured(overrides = {}) {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, required, overrides);
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL = ''; // verify the historical fallback stays available in a clean local env
  const url = pathToFileURL(path.resolve('next.config.mjs'));
  url.searchParams.set('fixture', `${Math.random()}`);
  const loaded = await import(url.href);
  const config = loaded.default;
  const rules = await config.headers();
  const policy = rules[0].headers.find(item => item.key === 'Content-Security-Policy')?.value;
  return { policy, patterns: config.images.remotePatterns, loader: config.images.loader, loaderFile: config.images.loaderFile };
}
function hasLoopback(policy) {
  return policy.includes('http://127.0.0.1:4319') && policy.includes('http://127.0.0.1:54341')
    && policy.includes('ws://127.0.0.1:54341');
}

test('local CSP opens only exact gateway and Supabase origins when every isolated Mock flag agrees', async () => {
  try {
    const { policy, patterns, loader, loaderFile } = await configured();
    assert.ok(policy && hasLoopback(policy));
    assert.match(policy, /videodelivery\.net/);
    assert.match(policy, /www\.youtube\.com/);
    assert.match(policy, /pub-580903d2b97f4b4e8810af8c9432d80a\.r2\.dev/);
    assert.equal(patterns.length, 1, 'isolated optimizer permits only the local poster, never R2 server fetches');
    assert.equal(loader, 'custom'); assert.equal(loaderFile, './infrastructure/media-local/image-loader.ts');
    assert.ok(patterns.some(item => item.protocol === 'http' && item.hostname === '127.0.0.1' && item.port === '4319' && item.pathname === '/fixtures/legacy.poster.webp'));
    assert.ok(!patterns.some(item => item.protocol === 'http' && item.hostname === 'localhost'));
  } finally {
    for (const [key, value] of original) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('any missing or mismatched isolation flag removes every loopback source and image pattern', async () => {
  try {
    for (const key of keys) {
      const { policy, patterns, loader, loaderFile } = await configured({ [key]: key === 'UPLOAD_ENVIRONMENT' ? 'production' : '' });
      assert.ok(policy && !hasLoopback(policy), `CSP must stay closed when ${key} is absent`);
      assert.ok(!patterns.some(item => item.protocol === 'http' && item.hostname === '127.0.0.1'));
      assert.ok(patterns.some(item => item.protocol === 'https' && item.hostname === 'pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev'), 'historical production image hosts remain configured');
      assert.equal(loader, undefined); assert.equal(loaderFile, undefined);
    }
  } finally {
    for (const [key, value] of original) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('isolated decorative image loader preserves local art and maps every external source to the fixture', () => {
  assert.equal(localFixtureImage({ src: '/images/logo.webp', width: 64 }), '/images/logo.webp');
  for (const src of ['https://provider.example/poster.jpg', '//provider.example/poster.jpg', 'data:image/png;base64,invalid'])
    assert.equal(localFixtureImage({ src, width: 64 }), 'http://127.0.0.1:4319/fixtures/legacy.poster.webp');
});
