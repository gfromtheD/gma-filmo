import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Ed25519MediaCapabilityIssuer } from '@/lib/media/capabilities';
import { createMediaGateway } from '@/lib/media/gateway/server';
import { createPeerTubeDelivery } from '@/lib/media/gateway/peertube-delivery';
import { PeerTubeClient } from '@/lib/media/providers/peertube-client';

const BASE = 'https://pt.example.test';
const VIDEO = randomUUID(), ASSET = randomUUID(), SESSION = randomUUID();
const MASTER = `${BASE}/static/streaming-playlists/hls/private/${VIDEO}/abc-master.m3u8`;


test('la pasarela reescribe el HLS privado de PeerTube y no expone el token de archivo', async () => {
  const keys = generateKeyPairSync('ed25519');
  const cap = new Ed25519MediaCapabilityIssuer(keys.privateKey, 'k1').issue({ sessionId: SESSION, assetId: ASSET, generation: 1, scope: 'playback', method: 'GET',
    namespace: `asset/${ASSET}/1/`, expectedBytes: 1000, ttlSeconds: 300 }).token;
  const upstreamCalls: string[] = [];
  const fakeFetch = (async (input: URL | string) => {
    const url = new URL(String(input)); upstreamCalls.push(url.toString());
    if (url.pathname.endsWith('abc-master.m3u8')) return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720\nabc-720.m3u8\n', { status: 200 });
    if (url.pathname.endsWith('abc-720.m3u8')) return new Response('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:4\n#EXT-X-MAP:URI="abc-720-fragmented.mp4",BYTERANGE="100@0"\n#EXTINF:4,\n#EXT-X-BYTERANGE:900@100\nabc-720-fragmented.mp4\n#EXT-X-ENDLIST\n', { status: 200 });
    if (url.pathname.endsWith('.mp4')) return new Response(new Uint8Array(10), { status: 206, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-9/1000' } });
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const client = new PeerTubeClient({ baseUrl: BASE, username: 'u', password: 'p', channelId: 2, fetch: fakeFetch });
  Object.assign(client, {
    getVideo: async () => ({ uuid: VIDEO, duration: 4, stateId: 1, streamingPlaylists: [{ playlistUrl: MASTER }] }),
    getPrivateFileToken: async () => ({ token: 'SECRETO-DE-ARCHIVO', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
  });
  const repository = {
    assetSession: async () => ({ id: SESSION }),
    peerTubeAccess: async (asset: string, generation: number) => {
      if (asset !== ASSET || generation !== 1) throw new Error('UPLOAD_NOT_FOUND');
      return { provider_ref: VIDEO, expected_input_bytes: 1000 };
    },
  };
  const publicKeys = { k1: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  const server = createMediaGateway({ repository: repository as never, storage: {} as never, publicKeys, origins: ['https://gma.test'] },
    createPeerTubeDelivery({ repository, client, publicKeys, fetchImpl: fakeFetch }));
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  try {
    const master = await fetch(`http://127.0.0.1:${port}/playback/${ASSET}/1/master.m3u8?cap=${encodeURIComponent(cap)}`);
    assert.equal(master.status, 200);
    const masterText = await master.text();
    assert.match(masterText, new RegExp(`/playback/${ASSET}/1/abc-720\\.m3u8\\?cap=`));
    assert.doesNotMatch(masterText, /SECRETO|pt\.example\.test/);

    const variant = await fetch(`http://127.0.0.1:${port}/playback/${ASSET}/1/abc-720.m3u8?cap=${encodeURIComponent(cap)}`);
    const variantText = await variant.text();
    assert.match(variantText, /abc-720-fragmented\.mp4\?cap=/);
    assert.doesNotMatch(variantText, /SECRETO/);

    const segment = await fetch(`http://127.0.0.1:${port}/playback/${ASSET}/1/abc-720-fragmented.mp4?cap=${encodeURIComponent(cap)}`, { headers: { Range: 'bytes=0-9' } });
    assert.equal(segment.status, 206);
    assert.equal(segment.headers.get('content-range'), 'bytes 0-9/1000');
    assert.ok(upstreamCalls.every(u => u.includes('videoFileToken=SECRETO-DE-ARCHIVO')), 'el token solo viaja hacia PeerTube');

    const forged = await fetch(`http://127.0.0.1:${port}/playback/${ASSET}/1/master.m3u8?cap=forjado.forjado.forjado`);
    assert.notEqual(forged.status, 200);
    const escape = await fetch(`http://127.0.0.1:${port}/playback/${ASSET}/1/..%2F..%2Fetc?cap=${encodeURIComponent(cap)}`);
    assert.notEqual(escape.status, 200);
  } finally { await new Promise<void>(r => server.close(() => r())); }
});
