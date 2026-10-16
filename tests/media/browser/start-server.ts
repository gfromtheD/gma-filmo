/** Ephemeral local-only Player fixture: real gateway + SQL + signed HLS, never deployed. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gatewayHarness } from '../gateway-fixture';
import { createGatewayDelivery } from '../../../lib/media/gateway/delivery';
import { OWNER } from '../database';

async function main() {
  const h = await gatewayHarness(undefined, { origins: ['http://127.0.0.1:3219'] }, deps => createGatewayDelivery(deps, path.resolve('tests/media/fixtures/hls')));
  await h.ingest(); await h.service.complete(OWNER, h.id, 1); await h.service.tick(1); await h.service.tick(1, true);
  const asset = (await h.service.context(h.id)).asset;
  const prefix = '/api/media/player-test-fixture';
  let scenario = '', selectedKind = 'hls', sourceReads = 0, mediaReads = 0;
  const server = createServer((req, res) => { void (async () => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const json = (value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/control') { scenario = url.searchParams.get('scenario') ?? ''; selectedKind = url.searchParams.get('kind') ?? 'hls'; sourceReads = 0; mediaReads = 0; json({ ok: true }); return; }
    if (url.pathname === '/metrics') { json({ sourceReads, mediaReads, gatewayOrigin: h.origin }); return; }
    if (url.pathname === '/source') {
      sourceReads++;
      if (scenario === 'initial404' || scenario === 'withdraw' && sourceReads > 1) { json({ error: 'unavailable' }, 404); return; }
      if (scenario === 'resolver503' && sourceReads > 1) { json({ error: 'temporary' }, 503); return; }
      const grant = h.issuer.issue({ sessionId: h.id, assetId: asset.id, generation: 1, scope: 'playback', method: 'GET',
        namespace: `asset/${asset.id}/1/`, expectedBytes: h.bytes.length, ttlSeconds: 300 });
      await h.repo.registerGatewayGrant(OWNER, asset.id, 1, h.input.draft_id, null, createHash('sha256').update(grant.token).digest('hex'), new Date(grant.expiresAt).toISOString());
      const common = { version: 1, mediaId: asset.id, titleSlug: 'media-player-fixture', titleId: 1, revision: sourceReads,
        expiresAt: ['renew', 'withdraw', 'resolver503'].includes(scenario) && sourceReads === 1 ? Date.now() + 63000 : grant.expiresAt,
        refreshUrl: `${prefix}/source`, posterUrl: `${prefix}/fixtures/poster.webp`, thumbnails: null,
        subtitles: ['es', 'en'].map(language => ({ id: language, language, label: language === 'es' ? 'Español' : 'English',
          url: `${prefix}/fixtures/subtitles.${language}.vtt`, default: false, format: 'vtt' })) };
      const kind = url.searchParams.get('kind') ?? selectedKind;
      json(kind === 'youtube' ? { ...common, mediaId: null, expiresAt: null, kind, videoId: 'abcdefghijk' }
        : kind === 'mp4' ? { ...common, mediaId: null, expiresAt: null, kind, mimeType: 'video/mp4', url: `${prefix}/fixtures/legacy.mp4` }
        : { ...common, kind: 'hls', mimeType: 'application/vnd.apple.mpegurl', p2p: 'none', fallback: null,
          url: `${prefix}/playback/${asset.id}/1/master.m3u8?cap=${encodeURIComponent(grant.token)}` }); return;
    }
    if (!/^\/(playback|fixtures)\//.test(url.pathname)) { json({}, 404); return; }
    mediaReads++;
    if (url.pathname.endsWith('master.m3u8') && (scenario === 'network503' || scenario === 'media401' && sourceReads === 1)) {
      json({ error: 'injected local gateway fault' }, scenario === 'media401' ? 401 : 503); return;
    }
    const headers = new Headers(); for (const key of ['range', 'origin', 'access-control-request-method', 'access-control-request-headers']) {
      const value = req.headers[key]; if (typeof value === 'string') headers.set(key, value);
    }
    const upstream = await fetch(h.origin + url.pathname + url.search, { method: req.method, headers });
    res.statusCode = upstream.status;
    for (const [key, value] of upstream.headers) if (!['transfer-encoding', 'connection', 'content-length', 'content-encoding'].includes(key)) res.setHeader(key, value);
    let bytes = Buffer.from(await upstream.arrayBuffer());
    if (url.pathname.endsWith('.m3u8') && upstream.ok) bytes = Buffer.from(bytes.toString().replaceAll('/playback/', prefix + '/playback/'));
    res.setHeader('Content-Length', req.method === 'HEAD' ? upstream.headers.get('content-length') ?? '0' : String(bytes.length)); res.end(bytes);
  })().catch(() => { res.statusCode = 500; res.end('Local player fixture failed'); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No local address');
  const directories = ['app/creadores/media-player-fixture', 'app/api/media/player-test-fixture/[...path]', 'app/api/titles/media-player-fixture/playback'];
  for (const directory of directories) await mkdir(directory, { recursive: false }).catch(async error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') { await mkdir(path.dirname(directory), { recursive: true }); await mkdir(directory); }
    else throw error;
  });
  await writeFile(directories[0] + '/page.tsx', `import {Suspense} from 'react';\nimport Fixture from '@/tests/media/browser/fixture';\nexport default function PlayerFixture(){return <Suspense fallback={<p>Preparando Player local…</p>}><Fixture /></Suspense>;}\n`);
  await writeFile(directories[1] + '/route.ts', `// Local generated fixture only.\nexport const dynamic='force-dynamic';\nasync function proxy(req:Request,{params}:{params:{path:string[]}}){const url=new URL(req.url);const upstream=await fetch('http://127.0.0.1:${address.port}/'+params.path.map(encodeURIComponent).join('/')+url.search,{method:req.method,headers:{...(req.headers.get('range')?{range:req.headers.get('range')!}:{}),...(req.headers.get('origin')?{origin:req.headers.get('origin')!}:{})},cache:'no-store'});return new Response(req.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:upstream.headers});}\nexport {proxy as GET,proxy as HEAD};\n`);
  await writeFile(directories[2] + '/route.ts', `// Local generated fixture only.\nexport const dynamic='force-dynamic';export async function GET(){const upstream=await fetch('http://127.0.0.1:${address.port}/source',{cache:'no-store'});return new Response(upstream.body,{status:upstream.status,headers:upstream.headers});}\n`);
  const runtime:NodeJS.ProcessEnv={...process.env,NODE_ENV:'production',NEXT_DIST_DIR:'.next-player'};
  let child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env: runtime });
  let closing = false;
  const close = async () => { if (closing) return; closing = true; child.kill('SIGTERM'); server.closeAllConnections(); server.close(); await h.close();
    for (const directory of directories) await rm(directory, { recursive: true, force: true });
    await rm('.next-player/types/app/creadores/media-player-fixture', { recursive: true, force: true });
    await rm('.next-player/types/app/api/media/player-test-fixture', { recursive: true, force: true });
    await rm('.next-player/types/app/api/titles/media-player-fixture', { recursive: true, force: true });
  };
  process.on('SIGTERM', () => { void close().then(() => process.exit(0)); });
  process.on('SIGINT', () => { void close().then(() => process.exit(0)); });
  child.once('exit', code => {
    if(closing || code!==0){void close().then(()=>process.exit(code??1));return;}
    child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3219'],{stdio:'inherit',env:runtime});
    child.once('exit',code=>{void close().then(()=>process.exit(code??0));});
  });
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Fixture failed'); process.exitCode = 1; });
