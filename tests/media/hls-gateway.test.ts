import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { parseMediaHls, MAX_HLS_BYTES, MAX_HLS_REFERENCES } from '../../lib/media/hls-parser';
import { createGatewayDelivery, parseByteRange } from '../../lib/media/gateway/delivery';
import { rewritePeerTubeManifest, rewriteGatewayHls } from '../../lib/media/gateway/hls';
import { PeerTubeClient } from '../../lib/media/providers/peertube-client';
import { PeerTubeMediaProvider } from '../../lib/media/providers/peertube';
import { TitleService } from '../../lib/media/title-service';
import { gatewayHarness } from './gateway-fixture';
import { OWNER, OTHER } from './database';

const fixtureRoot = path.resolve('tests/media/fixtures/hls');
const fixture = (name: string) => readFile(path.join(fixtureRoot, name));
async function readyGateway() {
  const h = await gatewayHarness(undefined, {}, deps => createGatewayDelivery(deps, fixtureRoot));
  await h.ingest(); await h.service.complete(OWNER, h.id, 1); await h.service.tick(1); await h.service.tick(1, true);
  const state = await h.service.context(h.id); const assetId = state.asset.id;
  const issue = async (scope: 'playback' | 'auxiliary' = 'playback', owner: string | null = OWNER, draftId: string | null = h.input.draft_id, slug: string | null = null) => {
    const grant = h.issuer.issue({ sessionId: h.id, assetId, generation: 1, scope, method: 'GET', namespace: `asset/${assetId}/1/`, expectedBytes: h.bytes.length, ttlSeconds: 300 });
    await h.repo.registerGatewayGrant(owner, assetId, 1, draftId, slug, createHash('sha256').update(grant.token).digest('hex'), new Date(grant.expiresAt).toISOString());
    return grant.token;
  };
  const token = await issue();
  return { ...h, assetId, token, issue, urlFor(relative: string, selected = token) { return `${h.origin}/playback/${assetId}/1/${relative}?cap=${encodeURIComponent(selected)}`; } };
}

test('5.3 separate HLS parser rewrites URI lines and quoted MAP, MEDIA and I-FRAME attributes', () => {
  const manifest = '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="es",NAME="Español, ES",URI="subs/es.m3u8"\n'
    + '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=1000,URI="iframes.m3u8"\n#EXT-X-STREAM-INF:CODECS="avc1.42c01f,mp4a.40.2"\nv0/index.m3u8\n';
  const parsed = parseMediaHls(manifest, 'master.m3u8');
  assert.deepEqual(parsed.references, ['subs/es.m3u8', 'iframes.m3u8', 'v0/index.m3u8']);
  const rewritten = parsed.rewrite(relative => `/gma/${relative}?cap=short`);
  assert.match(rewritten, /URI="\/gma\/subs\/es.m3u8\?cap=short"/); assert.match(rewritten, /NAME="Español, ES"/);
  assert.match(rewritten, /CODECS="avc1.42c01f,mp4a.40.2"/);
  const variant = parseMediaHls('#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXT-X-MAP:URI="init.mp4",BYTERANGE="100@0"\n#EXTINF:4,\nsegment.m4s\n', 'v0/index.m3u8');
  assert.deepEqual(variant.references, ['v0/init.mp4', 'v0/segment.m4s']);
  assert.match(variant.rewrite(relative => `/${relative}?cap=x`), /URI="\/v0\/init.mp4\?cap=x"/);
});

test('5.3 HLS parser rejects traversal, external/data/query URIs, unknown URI tags, encryption and unbounded manifests', () => {
  for (const uri of ['../secret.m4s', './segment.m4s', '/etc/passwd', 'https://evil.example/a.m4s', '//evil/a', 'data:x', 'a.m4s?redirect=x', 'a.m4s#x', '%2e%2e/a', 'a\\b', 'a//b']) {
    assert.throws(() => parseMediaHls(`#EXTM3U\n${uri}\n`, 'master.m3u8'), uri);
    assert.throws(() => parseMediaHls(`#EXTM3U\n#EXT-X-MAP:URI="${uri}"\n`, 'master.m3u8'), uri);
  }
  for (const line of ['#EXT-X-KEY:METHOD=AES-128,URI="secret.key"', '#EXT-X-KEY:METHOD=NONE,URI="secret.key"',
    '#EXT-X-MAP:URI=init.mp4', '#EXT-X-MAP:URI="a",URI="b"', '#EXT-X-MAP:URI="unclosed', '#EXT-X-MAP:BYTERANGE="1@0"',
    '#EXT-X-SESSION-DATA:DATA-ID="x",URI="secret"', '#EXT-X-SESSION-KEY:METHOD=NONE', '#EXT-X-CONTENT-STEERING:SERVER-URI="https://evil.example"']) {
    assert.throws(() => parseMediaHls(`#EXTM3U\n${line}\n`, 'master.m3u8'), line);
  }
  assert.throws(() => parseMediaHls('not hls', 'master.m3u8'));
  assert.throws(() => parseMediaHls(`#EXTM3U\n${'x'.repeat(MAX_HLS_BYTES)}`, 'master.m3u8'));
  assert.throws(() => parseMediaHls(`#EXTM3U\n${'segment.m4s\n'.repeat(MAX_HLS_REFERENCES + 1)}`, 'master.m3u8'));
  assert.throws(() => parseMediaHls('#EXTM3U\na/b/c/d/e/segment.m4s\n', 'master.m3u8'));
});

test('5.3 PeerTube parser and adapter hook preserve only one origin/static namespace and never export upstream URLs', () => {
  const client = new PeerTubeClient({ baseUrl: 'https://peertube.test', username: 'local-double', password: 'fixture', channelId: 73,
    fetch: async () => { throw new Error('No network is allowed for this parser test'); } });
  const root = 'https://peertube.test/static/streaming-playlists/hls/video/master.m3u8';
  const prefix = '/playback/44444444-4444-4444-8444-444444444444/1/';
  const manifest = Buffer.from('#EXTM3U\n#EXT-X-MAP:URI="https://peertube.test/static/streaming-playlists/hls/video/init.mp4"\nsegment.m4s\n');
  const result = rewritePeerTubeManifest(manifest, root, client, prefix, 'gma-cap').toString();
  assert.match(result, /URI="\/playback\/.*\/init.mp4\?cap=gma-cap"/); assert.ok(!result.includes('peertube.test'));
  const provider = new PeerTubeMediaProvider(client, 'http://127.0.0.1:4319', { issue: () => ({ token: 'double', expiresAt: Date.now() }) }, { get: async () => null });
  assert.equal(provider.rewriteHlsManifest(manifest, root, '44444444-4444-4444-8444-444444444444', 1, 'gma-cap').toString(), result);
  for (const uri of ['https://evil.test/a', 'https://peertube.test/static/streaming-playlists/hls/other/a.m4s', 'segment.m4s?token=upstream', '../a.m4s', '%2e%2e/a.m4s', '//peertube.test/static/streaming-playlists/hls/video/a']) {
    assert.throws(() => rewritePeerTubeManifest(Buffer.from(`#EXTM3U\n${uri}\n`), root, client, prefix, 'cap'), uri);
  }
});

test('5.3 HLS snapshot bounds actual playlist graph depth, cycles and aggregate references', async () => {
  const assetId = '44444444-4444-4444-8444-444444444444';
  const encode = (references: string[]) => Buffer.from(`#EXTM3U\n${references.join('\n')}\n`);
  const chain: Record<string, Buffer> = {
    'a.m3u8': encode(['b.m3u8']), 'b.m3u8': encode(['c.m3u8']), 'c.m3u8': encode(['d.m3u8']),
    'd.m3u8': encode(['segment.m4s']),
  };
  const load = async (name: string) => chain[name] ?? null;
  assert.match((await rewriteGatewayHls(encode(['a.m3u8']), 'master.m3u8', assetId, 1, 'cap', load)).toString(), /a.m3u8\?cap=cap/);
  chain['d.m3u8'] = encode(['e.m3u8']); chain['e.m3u8'] = encode(['segment.m4s']);
  await assert.rejects(rewriteGatewayHls(encode(['a.m3u8']), 'master.m3u8', assetId, 1, 'cap', load));
  chain['a.m3u8'] = encode(['master.m3u8']);
  await assert.rejects(rewriteGatewayHls(encode(['a.m3u8']), 'master.m3u8', assetId, 1, 'cap', load));
  const root = encode(['a.m3u8', 'b.m3u8']);
  chain['a.m3u8'] = encode(Array.from({ length: 5000 }, () => 'segment.m4s'));
  chain['b.m3u8'] = encode(Array.from({ length: 5000 }, () => 'segment.m4s'));
  await assert.rejects(rewriteGatewayHls(root, 'master.m3u8', assetId, 1, 'cap', load));
  chain['a.m3u8'] = encode(['b.m3u8']); chain['b.m3u8'] = encode(['c.m3u8']);
  chain['c.m3u8'] = encode(['d.m3u8']); chain['d.m3u8'] = encode(['e.m3u8']); chain['e.m3u8'] = encode(['segment.m4s']);
  await assert.rejects(rewriteGatewayHls(encode(['c.m3u8', 'a.m3u8']), 'master.m3u8', assetId, 1, 'cap', load), 'cached shallow traversal must still reject a deeper path');
  const manyPlaylists = Array.from({ length: 11 }, (_, index) => `leaf-${index}.m3u8`);
  for (const name of manyPlaylists) chain[name] = Buffer.from(`#EXTM3U\n#${'x'.repeat(980_000)}\n`);
  await assert.rejects(rewriteGatewayHls(encode(manyPlaylists), 'master.m3u8', assetId, 1, 'cap', load), 'aggregate playlist bytes are bounded to 10 MiB');
});

test('5.3 single byte ranges support suffix/open ranges and reject multi-ranges or unsatisfiable bounds', () => {
  assert.equal(parseByteRange(undefined, 100), null);
  assert.deepEqual(parseByteRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseByteRange('bytes=95-', 100), { start: 95, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-5', 100), { start: 95, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-200', 100), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange('bytes=0-200', 100), { start: 0, end: 99 });
  for (const value of ['bytes=100-', 'bytes=10-9', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'items=0-1', 'bytes=999999999999999999-']) assert.deepEqual(parseByteRange(value, 100), { unsatisfiable: true });
});

test('5.3 real private HTTP HLS rewrites every master/MAP/segment URI with capability and serves indexed outputs only', async () => {
  const h = await readyGateway(); try {
    const response = await fetch(h.urlFor('master.m3u8')); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const master = await response.text(); const variants = master.split('\n').filter(line => line && !line.startsWith('#'));
    assert.equal(variants.length, 2); assert.ok(variants.every(line => line.startsWith(`/playback/${h.assetId}/1/`) && line.endsWith(`?cap=${h.token}`)));
    const variant = await fetch(new URL(variants[0]!, h.origin)); assert.equal(variant.status, 200); const content = await variant.text();
    const map = /URI="([^"]+)"/.exec(content)?.[1]; assert.ok(map);
    const init = await fetch(new URL(map, h.origin)); assert.equal(init.status, 200);
    assert.deepEqual(Buffer.from(await init.arrayBuffer()), await fixture('v0/init_0.mp4'));
    for (const line of content.split('\n').filter(line => line && !line.startsWith('#'))) {
      const segment = await fetch(new URL(line, h.origin)); assert.equal(segment.status, 200); assert.equal(segment.headers.get('content-type'), 'video/iso.segment');
    }
    const head = await fetch(h.urlFor('v0/init_0.mp4'), { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal(Number(head.headers.get('content-length')), (await fixture('v0/init_0.mp4')).length);
    assert.equal((await fetch(`${h.origin}/playback/${h.assetId}/1/master.m3u8`)).status, 401);
    assert.equal((await fetch(h.urlFor('original.bin'))).status, 401);
    assert.equal((await fetch(h.urlFor('master.m3u8').replace('/1/', '/2/'))).status, 401);
    assert.equal((await fetch(`${h.urlFor('master.m3u8')}&redirect=https://evil.example`)).status, 401);
    assert.equal((await fetch(h.urlFor('master.m3u8', `${h.token.slice(0, -8)}tampered`))).status, 401);
    await assert.rejects(h.repo.registerGatewayGrant(OTHER, h.assetId, 1, h.input.draft_id, null, 'f'.repeat(64), new Date(Date.now() + 100_000).toISOString()));
  } finally { await h.close(); }
});

test('5.3 HTTP fixtures deliver MP4 Range/HEAD, two VTT and WebP aliases with exact CORS', async () => {
  const h = await readyGateway(); try {
    const bytes = await fixture('legacy.mp4'); const url = `${h.origin}/fixtures/legacy.mp4`;
    const range = await fetch(url, { headers: { Range: 'bytes=10-19', Origin: 'http://127.0.0.1:4318' } });
    assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 10-19/${bytes.length}`);
    assert.equal(range.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4318'); assert.equal(range.headers.get('vary'), 'Origin');
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(10, 20));
    const suffix = await fetch(url, { headers: { Range: 'bytes=-10' } }); assert.equal(suffix.status, 206);
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), bytes.subarray(-10));
    const open = await fetch(url, { headers: { Range: `bytes=${bytes.length - 10}-` } }); assert.equal(open.status, 206);
    assert.deepEqual(Buffer.from(await open.arrayBuffer()), bytes.subarray(-10));
    const head = await fetch(url, { method: 'HEAD', headers: { Range: 'bytes=0-9' } }); assert.equal(head.status, 206);
    assert.equal(head.headers.get('content-length'), '10'); assert.equal((await head.arrayBuffer()).byteLength, 0);
    const invalid = await fetch(url, { headers: { Range: `bytes=${bytes.length}-` } }); assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('content-range'), `bytes */${bytes.length}`);
    assert.equal((await fetch(url, { headers: { Range: 'bytes=0-1,4-5' } })).status, 416);
    for (const [alias, file, type] of [['legacy.es.vtt', 'subtitles.es.vtt', 'text/vtt; charset=utf-8'], ['legacy.en.vtt', 'subtitles.en.vtt', 'text/vtt; charset=utf-8'], ['legacy.poster.webp', 'poster.webp', 'image/webp'], ['poster.webp', 'poster.webp', 'image/webp']]) {
      const response = await fetch(`${h.origin}/fixtures/${alias}`); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), type);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fixture(file!));
    }
    const subtitle = await fetch(h.urlFor('subtitles.es.vtt')); assert.equal(subtitle.status, 200); assert.match(await subtitle.text(), /00:00:01.000 --> 00:00:04.000/);
    assert.equal((await fetch(`${h.origin}/fixtures/master.m3u8`)).status, 404);
    assert.equal((await fetch(`${h.origin}/fixtures/__proto__`)).status, 404);
    assert.equal((await fetch(url, { headers: { Origin: 'https://evil.example' } })).status, 403);
    const options = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:4318', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Range' } });
    assert.equal(options.status, 204); assert.ok(options.headers.get('access-control-allow-headers')?.includes('Range'));
    assert.equal((await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:4318', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'X-Unsafe' } })).status, 403);
  } finally { await h.close(); }
});

test('5.3 public grants revoke on withdrawal while a separately authorized owner grant remains private', async () => {
  const h = await readyGateway(); try {
    const state = await h.service.envelope(OWNER, h.id);
    await h.repo.uploadCommand(OWNER, 'update_draft', { draft_id: h.input.draft_id, revision: state.draftRevision, metadata: { title: 'Gateway private movie' } });
    const draft = await h.repo.draft(OWNER, h.input.draft_id); const titles = new TitleService(h.repo);
    const published = await titles.publish(OWNER, { draft_id: draft.id, revision: draft.revision, main_media_id: h.assetId });
    assert.equal((await fetch(h.urlFor('master.m3u8'))).status, 401, 'the old draft grant does not become public');
    const publicToken = await h.issue('playback', null, null, published.title.slug);
    assert.equal((await fetch(h.urlFor('master.m3u8', publicToken))).status, 200);
    await titles.lifecycle(OWNER, published.title.slug, 'unpublish', { revision: published.title.mediaRevision, idempotency_key: randomUUID() });
    assert.equal((await fetch(h.urlFor('master.m3u8', publicToken))).status, 401, 'a public capability cannot become an owner preview');
    const ownerToken = await h.issue('playback', OWNER, null, published.title.slug);
    assert.equal((await fetch(h.urlFor('master.m3u8', ownerToken))).status, 200);
    await assert.rejects(h.issue('playback', OTHER, null, published.title.slug));
    await h.db.query('UPDATE gma_media_gateway_grants SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1', [createHash('sha256').update(ownerToken).digest('hex')]);
    assert.equal((await fetch(h.urlFor('master.m3u8', ownerToken))).status, 401);
  } finally { await h.close(); }
});

test('5.3 filesystem delivery refuses a symlink escaping the asset namespace and changed indexed size', async () => {
  const h = await readyGateway(); try {
    const file = h.storage.assetPath(h.assetId, 1, 'v0/init_0.mp4'); await unlink(file); await symlink(path.join(fixtureRoot, 'v0/init_0.mp4'), file);
    assert.equal((await fetch(h.urlFor('v0/init_0.mp4'))).status, 404);
    await h.db.query('UPDATE gma_media_outputs SET size_bytes=size_bytes+1 WHERE asset_id=$1 AND relative=$2', [h.assetId, 'v1/init_1.mp4']);
    assert.equal((await fetch(h.urlFor('v1/init_1.mp4'))).status, 422);
  } finally { await h.close(); }
});

test('5.3 auxiliary asset uses an auxiliary capability and serves normalized private VTT', async () => {
  const h = await readyGateway(); try {
    const source = await fixture('subtitles.es.vtt'); const draft = await h.repo.draft(OWNER, h.input.draft_id);
    const reserved = await h.repo.reserve(OWNER, { draft_id: draft.id, revision: draft.revision, role: 'subtitles', language: 'es', bytes: source.length,
      sha256: createHash('sha256').update(source).digest('hex'), content_type: 'text/vtt', file_name: 'source.vtt', idempotency_key: randomUUID(),
      request_hash: 'a'.repeat(64), video_provider: 'mock', auxiliary_provider: 'mock' });
    const id = reserved.session.id; await h.service.provision(id, OWNER); const claim = await h.repo.claimTransfer(OWNER, id, 1, 'aux-test');
    await h.provider.writeChunk(await h.service.context(id), { startByte: 0, endByte: source.length - 1, sha256: createHash('sha256').update(source).digest('hex'), bytes: source });
    await h.repo.releaseTransfer(OWNER, id, 1, 'aux-test', claim.fence); await h.service.complete(OWNER, id, 1); await h.service.tick(1);
    const context = await h.service.context(id); assert.equal(context.asset.state, 'ready');
    const grant = h.issuer.issue({ sessionId: id, assetId: context.asset.id, generation: 1, scope: 'auxiliary', method: 'GET', namespace: `asset/${context.asset.id}/1/`, expectedBytes: source.length, ttlSeconds: 300 });
    await h.repo.registerGatewayGrant(OWNER, context.asset.id, 1, draft.id, null, createHash('sha256').update(grant.token).digest('hex'), new Date(grant.expiresAt).toISOString());
    const url = `${h.origin}/playback/${context.asset.id}/1/subtitles.vtt?cap=${grant.token}`;
    const response = await fetch(url); assert.equal(response.status, 200); assert.match(await response.text(), /^WEBVTT/);
    assert.equal((await fetch(`${h.origin}/playback/${context.asset.id}/1/subtitles.vtt?cap=${h.token}`)).status, 401);
  } finally { await h.close(); }
});

test('5.3 private real HLS fixture decodes through HTTP with FFmpeg, including fMP4 MAP and audio', async () => {
  const h = await readyGateway(); try {
    const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
    const result = await promisify(execFile)(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'http,tcp,crypto', '-i', h.urlFor('master.m3u8'), '-t', '2', '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], { timeout: 30_000, maxBuffer: 1024 * 1024 }).catch(() => { throw new Error('MEDIA_FIXTURE_PRIVATE_HTTP_DECODE_FAILED'); });
    assert.equal(result.stderr, '');
  } finally { await h.close(); }
});
