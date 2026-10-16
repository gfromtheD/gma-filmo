/** Acceptance against the running, owned Supabase/Next/gateway fixture; never starts or resets it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, lstat, readFile, realpath } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { z } from 'zod';
import { assertManagedEnvironment, assertWorkspace, LOCAL_PROJECT_ID } from '../../scripts/media/local-stack';
import { seedLocal } from '../../scripts/media/local-seed';
import { preflightMediaLocal } from '../../scripts/media/preflight';
import { draftDTOSchema } from '../../lib/media/dto';
import { playbackSourceSchema, uploadMutationEnvelopeSchema } from '../../lib/media/contracts';
type UploadMutationEnvelope = z.infer<typeof uploadMutationEnvelopeSchema>;

const WEB = 'http://127.0.0.1:4318';
const GATEWAY = 'http://127.0.0.1:4319';
const SUPABASE = 'http://127.0.0.1:54341';
const allowedOrigins = new Set([WEB, GATEWAY, SUPABASE]);
const draftResponse = z.object({ version: z.literal(1), draft: draftDTOSchema }).strict();
const titleResponse = z.object({ title: z.object({ id: z.number().int().positive(), slug: z.string(), status: z.string(),
  mediaRevision: z.number().int().nonnegative(), deletionState: z.enum(['none', 'pending', 'done']) }).passthrough() }).passthrough();
const loginResponse = z.object({ access_token: z.string().min(1), user: z.object({ id: z.string().uuid() }).passthrough() }).passthrough();
const prohibitedKeys = new Set(['private_state', 'privateState', 'provider_data', 'provider_ref', 'providerMediaId', 'uploadId',
  'object_key', 'multipart_upload_id', 'outputs', 'receipt', 'provisional_receipt', 'source_sha256', 'token_hash']);

function localUrl(value: string): URL {
  // Playback DTOs may contain same-origin proxy paths (for example subtitle-proxy).
  // Resolve those against GMA while still enforcing the exact local allowlist.
  const url = new URL(value, WEB);
  if (!allowedOrigins.has(url.origin) || url.username || url.password) throw new Error('MEDIA_LIVE_LOCAL_URL_REQUIRED');
  return url;
}
function noPrivateFields(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(noPrivateFields); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!prohibitedKeys.has(key), `private field denied: ${key}`);
    noPrivateFields(child);
  }
}
async function loadEnvironment(repository: string): Promise<Record<string, string>> {
  if (process.env.MEDIA_LOCAL_LIVE_ACCEPTANCE !== 'true') throw new Error('MEDIA_LOCAL_LIVE_ACCEPTANCE_REQUIRED');
  const workspace = path.join(repository, 'work/media-local');
  await assertWorkspace(repository, workspace);
  await assertManagedEnvironment(repository);
  const envFile = path.join(repository, '.env.media.local');
  assert.equal((await lstat(envFile)).mode & 0o777, 0o600, 'fixture environment must be private');
  const result: Record<string, string> = {};
  for (const line of (await readFile(envFile, 'utf8')).split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1 || !/^[A-Z][A-Z0-9_]*$/.test(line.slice(0, split))) throw new Error('MEDIA_LIVE_ENV_INVALID');
    const value: unknown = JSON.parse(line.slice(split + 1));
    if (typeof value !== 'string') throw new Error('MEDIA_LIVE_ENV_INVALID');
    result[line.slice(0, split)] = value;
  }
  await preflightMediaLocal(result, repository, false);
  const state: unknown = JSON.parse(await readFile(path.join(workspace, 'process-state.json'), 'utf8'));
  const parsed = z.object({ projectId: z.literal(LOCAL_PROJECT_ID), ready: z.literal(true), pid: z.number().int().positive() }).passthrough().parse(state);
  process.kill(parsed.pid, 0);
  return result;
}

/** A real HTTP forward proxy restricts browser egress. It never fabricates an API response. */
async function browserProxy() {
  const rejected: string[] = [];
  const blockedDecorative: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((incoming, outgoing) => {
    let target: URL;
    try { target = localUrl(incoming.url ?? ''); }
    catch { rejected.push('non-fixture HTTP origin'); outgoing.writeHead(403); outgoing.end(); return; }
    // An optimizer request is same-origin but can trigger server-side egress. Reject decorative remote
    // inputs at the transport boundary; no GMA/Supabase/media API result is mocked or intercepted.
    if (target.origin === WEB && target.pathname === '/_next/image') {
      let source: URL;
      try { source = new URL(target.searchParams.get('url') ?? '', WEB); }
      catch { blockedDecorative.push('invalid image optimizer input denied'); outgoing.writeHead(400); outgoing.end(); return; }
      if (source.origin !== WEB && !(source.origin === GATEWAY && source.pathname === '/fixtures/legacy.poster.webp' && !source.search)) {
        blockedDecorative.push('remote image optimizer input denied'); outgoing.writeHead(403); outgoing.end(); return;
      }
    }
    const upstream = httpRequest(target, { method: incoming.method, headers: { ...incoming.headers, host: target.host } }, response => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers); response.pipe(outgoing);
    });
    upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    incoming.pipe(upstream);
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('connect', (_incoming, socket) => { rejected.push('TLS egress denied'); socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); });
  // Next's development websocket stays in loopback and is not required for these fetch assertions.
  server.on('upgrade', (incoming, socket) => {
    try {
      const target = new URL(incoming.url ?? '', `http://${incoming.headers.host ?? ''}`);
      if (target.protocol === 'ws:') target.protocol = 'http:';
      localUrl(target.href);
    } catch { rejected.push('non-fixture websocket origin'); }
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('MEDIA_LIVE_PROXY_FAILED');
  return { url: `http://127.0.0.1:${address.port}`, rejected, blockedDecorative, async close() {
    for (const socket of sockets) socket.destroy();
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}
async function browserFetch(page: Page, url: string, input: { method?: string; headers?: Record<string, string>; body?: string; bytes?: number[] } = {}) {
  localUrl(url);
  return page.evaluate(async ({ destination, request }) => {
    const response = await fetch(destination, { method: request.method ?? 'GET', headers: request.headers,
      body: request.bytes ? new Uint8Array(request.bytes) : request.body, redirect: 'error' });
    return { status: response.status, text: await response.text(), range: response.headers.get('range'),
      contentRange: response.headers.get('content-range'), length: response.headers.get('content-length'),
      cache: response.headers.get('cache-control'), cors: response.headers.get('access-control-allow-origin') };
  }, { destination: url, request: input });
}

test('5.4–5.8 live fixture: real Auth/PostgREST, browser CSP, durable upload, publication/HLS and delete', { timeout: 180_000 }, async t => {
  const repository = await realpath(process.cwd());
  const env = await loadEnvironment(repository);
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = env.SUPABASE_SERVICE_ROLE_KEY!;
  const password = env.MEDIA_LOCAL_TEST_PASSWORD!;
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(localUrl(url), { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  }
  async function json(url: string, expected: readonly number[], init: RequestInit = {}): Promise<unknown> {
    const response = await send(url, init);
    if (!expected.includes(response.status)) {
      // Do not include response bodies or URLs: either may contain a signed capability or credentials.
      let code = 'UNCLASSIFIED';
      try {
        const problem: unknown = await response.json();
        const parsed = z.object({ error: z.object({ code: z.string().regex(/^[A-Z][A-Z_0-9]{1,80}$/) }).passthrough() }).passthrough().safeParse(problem);
        if (parsed.success) code = parsed.data.error.code;
      } catch { /* Retain a credential-free HTTP diagnostic. */ }
      throw new Error(`MEDIA_LIVE_HTTP_STATUS_${response.status}:${localUrl(url).pathname}:${code}`);
    }
    return response.json() as Promise<unknown>;
  }
  const rest = (relative: string, bearer = admin) => json(`${SUPABASE}/rest/v1/${relative}`, [200],
    { headers: { apikey: bearer === admin ? admin : anon, Authorization: `Bearer ${bearer}` } });
  async function api(relative: string, bearer: string | null, method = 'GET', body?: unknown, expected: readonly number[] = [200]) {
    const value = await json(`${WEB}${relative}`, expected, { method,
      headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    noPrivateFields(value);
    const serialized = JSON.stringify(value);
    for (const secret of [admin, password, env.UPLOAD_EXECUTOR_SECRET, env.MEDIA_CAPABILITY_PRIVATE_KEY])
      if (secret) assert.ok(!serialized.includes(secret), 'server credentials must never appear in a GMA DTO');
    if (bearer) assert.ok(!serialized.includes(bearer), 'Auth bearer must never appear in a GMA DTO');
    return value;
  }
  async function login(email: string) {
    return loginResponse.parse(await json(`${SUPABASE}/auth/v1/token?grant_type=password`, [200], {
      method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    }));
  }
  async function waitEnvelope(bearer: string, id: string, wanted: 'ready' | 'deleted', observed = new Set<string>()) {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const current = uploadMutationEnvelopeSchema.parse(await api(`/api/uploads/${id}`, bearer));
      observed.add(current.asset.status);
      if (current.asset.status === wanted) return current;
      if (['failed', 'rejected'].includes(current.asset.status) && wanted === 'ready') throw new Error('MEDIA_LIVE_PROCESSING_FAILED');
      await new Promise<void>(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`MEDIA_LIVE_EXECUTOR_TIMEOUT_${wanted}`);
  }
  await t.test('real Auth/PostgREST and every running service respond on fixture origins', async () => {
    assert.equal((await send(`${SUPABASE}/auth/v1/health`)).status, 200);
    assert.equal((await send(`${SUPABASE}/rest/v1/`, { headers: { apikey: anon } })).status, 200);
    assert.equal((await send(`${GATEWAY}/health`)).status, 200);
    assert.equal((await send(WEB)).status, 200);
    for (const token of [null, 'invalid-test-token']) {
      const unauthorized = await send(`${WEB}/api/upload-drafts`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: '{"purpose":"title"}' });
      assert.equal(unauthorized.status, 401, 'missing/invalid Bearer must be denied by route without redirect');
      assert.equal(unauthorized.headers.get('location'), null);
    }
    const marker = z.array(z.object({ project_id: z.literal(LOCAL_PROJECT_ID) })).parse(await rest('gma_media_local_fixture?select=project_id&id=eq.true'));
    assert.equal(marker.length, 1);
    // Validate the running fixture's source configuration before sending an external optimizer input.
    // A permissive configuration fails here without making that potentially remote-fetching request.
    const previous = new Map(Object.keys(env).map(key => [key, process.env[key]]));
    try {
      Object.assign(process.env, env);
      const loaded: unknown = await import(`${pathToFileURL(path.join(repository, 'next.config.mjs')).href}?live=${randomUUID()}`);
      const parsed = z.object({ default: z.object({ images: z.object({ loader: z.literal('custom'),
        loaderFile: z.literal('./infrastructure/media-local/image-loader.ts'), remotePatterns: z.array(z.object({
        protocol: z.literal('http'), hostname: z.literal('127.0.0.1'), port: z.literal('4319'), pathname: z.literal('/fixtures/legacy.poster.webp'), search: z.literal(''),
      }).strict()).length(1) }).passthrough() }).passthrough() }).passthrough().parse(loaded);
      assert.equal(parsed.default.images.remotePatterns.length, 1, 'isolated optimizer may fetch only fixture poster');
    } finally {
      for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
    const unsafeImage = new URL('/_next/image', WEB);
    unsafeImage.search = new URLSearchParams({ url: 'https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/phase5-do-not-fetch.png', w: '64', q: '75' }).toString();
    assert.equal((await send(unsafeImage.href)).status, 404, 'custom fixture loader must disable the optimizer before any provider request');
  });
  await t.test('Auth admin reseed twice preserves users, catalogue identity and quota', async () => {
    const before = await rest('gma_upload_quota?select=*&order=account_key');
    const options = { url: SUPABASE, projectId: LOCAL_PROJECT_ID, serviceRoleKey: admin, anonKey: anon, password,
      fetch: ((input: string | URL | Request, init?: RequestInit) => send(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, init)) as typeof fetch };
    const first = await seedLocal(options);
    const second = await seedLocal(options);
    assert.deepEqual(first, second, 'reseed must preserve UUIDs and numeric legacy title');
    assert.deepEqual(await rest('gma_upload_quota?select=*&order=account_key'), before, 'reseed must not replace quota counters');
    assert.equal(first.users.length, 3);
  });
  const creatorA = await login('gma.creator-a@example.invalid');
  const creatorB = await login('gma.creator-b@example.invalid');
  const viewer = await login('gma.viewer@example.invalid');
  const proxy = await browserProxy();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let createdDraft: string | null = null;
  let createdSlug: string | null = null;
  let completedDelete = false;
  try {
    let channel: 'chrome' | undefined;
    try { await access(chromium.executablePath()); }
    catch { await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'); channel = 'chrome'; }
    browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}),
      proxy: { server: proxy.url }, args: ['--proxy-bypass-list=<-loopback>', '--disable-background-networking', '--disable-component-update'] });
    const context = await browser.newContext();
    const pageEgress: string[] = [];
    context.on('request', request => {
      const destination = new URL(request.url());
      if (['about:', 'data:', 'blob:'].includes(destination.protocol)) return;
      if (destination.protocol === 'ws:') destination.protocol = 'http:';
      if (!allowedOrigins.has(destination.origin)) pageEgress.push(destination.origin);
    });
    await context.addInitScript(() => {
      const state = window as unknown as { __mediaCspViolations: string[] };
      state.__mediaCspViolations = [];
      document.addEventListener('securitypolicyviolation', event => state.__mediaCspViolations.push(event.effectiveDirective));
    });
    const page = await context.newPage();
    const root = await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.equal(root?.status(), 200, 'real GMA HTML must load');
    const csp = root?.headers()['content-security-policy'];
    assert.ok(csp?.includes(GATEWAY) && csp.includes(SUPABASE), 'local CSP must allow exact fixture origins');
    await t.test('Chromium signs in through real cross-origin Auth under GMA CSP', async () => {
      const result = await browserFetch(page, `${SUPABASE}/auth/v1/token?grant_type=password`, { method: 'POST',
        headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'gma.creator-a@example.invalid', password }) });
      assert.equal(result.status, 200);
      const loggedIn = loginResponse.parse(JSON.parse(result.text) as unknown);
      assert.equal(loggedIn.user.id, creatorA.user.id);
    });
    const video = await readFile(path.join(repository, 'tests/media/fixtures/hls/legacy.mp4'));
    const subtitle = await readFile(path.join(repository, 'tests/media/fixtures/hls/subtitles.es.vtt'));
    const digest = createHash('sha256').update(video).digest('hex');
    let main: UploadMutationEnvelope;
    let auxiliary: UploadMutationEnvelope;
    await t.test('real HTTP draft/reserve/idempotency, browser chunks, pause/resume, SHA and executor READY', async () => {
      const draft = draftResponse.parse(await api('/api/upload-drafts', creatorA.access_token, 'POST', { purpose: 'title' }, [201])).draft;
      createdDraft = draft.id;
      const named = draftResponse.parse(await api(`/api/upload-drafts/${draft.id}`, creatorA.access_token, 'PATCH',
        { revision: draft.revision, metadata: { title: `Phase5 live ${randomUUID()}`, synopsis: 'Isolated backend acceptance', language: 'es', genre: 'Drama' } })).draft;
      const body = { draft_id: draft.id, revision: named.revision, role: 'main', bytes: video.length, sha256: digest,
        file_name: 'local.mp4', content_type: 'video/mp4', idempotency_key: randomUUID() };
      main = uploadMutationEnvelopeSchema.parse(await api('/api/uploads', creatorA.access_token, 'POST', body, [201]));
      const replay = uploadMutationEnvelopeSchema.parse(await api('/api/uploads', creatorA.access_token, 'POST', body));
      assert.equal(replay.session.sessionId, main.session.sessionId);
      assert.equal(replay.asset.mediaId, main.asset.mediaId);
      assert.ok(main.transfer?.protocol === 'uploadx', 'main must use neutral resumable HTTP');
      const transfer = main.transfer;
      if (!transfer || transfer.protocol !== 'uploadx') throw new Error('MEDIA_LIVE_UPLOADX_REQUIRED');
      const split = Math.floor(video.length / 2);
      const first = await browserFetch(page, transfer.url, { method: 'PUT', headers: { ...transfer.headers,
        'Content-Range': `bytes 0-${split - 1}/${video.length}` }, bytes: [...video.subarray(0, split)] });
      assert.equal(first.status, 308); assert.equal(first.range, `bytes=0-${split - 1}`);
      main = uploadMutationEnvelopeSchema.parse(await api(`/api/uploads/${main.session.sessionId}`, creatorA.access_token));
      assert.equal(main.session.receivedBytes, split);
      main = uploadMutationEnvelopeSchema.parse(await api(`/api/uploads/${main.session.sessionId}/pause`, creatorA.access_token, 'POST', { revision: main.session.revision }));
      assert.equal(main.session.state, 'paused');
      main = uploadMutationEnvelopeSchema.parse(await api(`/api/uploads/${main.session.sessionId}/resume`, creatorA.access_token, 'POST',
        { revision: main.session.revision, sha256: digest, bytes: video.length }));
      const resumed = main.transfer;
      if (!resumed || resumed.protocol !== 'uploadx') throw new Error('MEDIA_LIVE_UPLOADX_REQUIRED');
      assert.equal(resumed.offset, split);
      const query = await browserFetch(page, resumed.url, { method: 'PUT', headers: { ...resumed.headers, 'Content-Range': `bytes */${video.length}` } });
      assert.equal(query.status, 308); assert.equal(query.range, `bytes=0-${split - 1}`);
      const final = await browserFetch(page, resumed.url, { method: 'PUT', headers: { ...resumed.headers,
        'Content-Range': `bytes ${split}-${video.length - 1}/${video.length}` }, bytes: [...video.subarray(split)] });
      assert.equal(final.status, 200); assert.equal(final.range, `bytes=0-${video.length - 1}`);
      const original = await readFile(path.join(repository, 'work/media-local/storage', main.session.sessionId, `g${main.session.transferGeneration}`, 'original.bin'));
      assert.equal(original.length, video.length);
      assert.equal(createHash('sha256').update(original).digest('hex'), digest, 'durable original SHA must match complete source');
      const completed = uploadMutationEnvelopeSchema.parse(await api(`/api/uploads/${main.session.sessionId}/complete`, creatorA.access_token, 'POST',
        { generation: main.session.transferGeneration }, [200, 202]));
      const observed = new Set([completed.asset.status]);
      main = await waitEnvelope(creatorA.access_token, main.session.sessionId, 'ready', observed);
      assert.ok(observed.has('processing'), 'executor must expose actual processing before READY');
      assert.equal(main.session.receivedBytes, video.length);
      assert.equal(main.asset.metadata.syntheticPlayback, true);
      const draftCurrent = draftResponse.parse(await api(`/api/upload-drafts/${draft.id}`, creatorA.access_token).then(value => {
        const detail = z.object({ version: z.literal(1), draft: draftDTOSchema }).passthrough().parse(value);
        return { version: detail.version, draft: detail.draft };
      })).draft;
      auxiliary = uploadMutationEnvelopeSchema.parse(await api('/api/uploads', creatorA.access_token, 'POST', {
        draft_id: draft.id, revision: draftCurrent.revision, role: 'subtitles', bytes: subtitle.length,
        sha256: createHash('sha256').update(subtitle).digest('hex'), file_name: 'subtitles.es.vtt', content_type: 'text/vtt', language: 'es', idempotency_key: randomUUID(),
      }, [201]));
      const auxTransfer = auxiliary.transfer;
      if (!auxTransfer || auxTransfer.protocol !== 'put') throw new Error('MEDIA_LIVE_AUX_PUT_REQUIRED');
      const aux = await browserFetch(page, auxTransfer.url, { method: 'PUT', headers: auxTransfer.headers, bytes: [...subtitle] });
      assert.equal(aux.status, 200);
      await api(`/api/uploads/${auxiliary.session.sessionId}/complete`, creatorA.access_token, 'POST', { generation: auxiliary.session.transferGeneration }, [200, 202]);
      auxiliary = await waitEnvelope(creatorA.access_token, auxiliary.session.sessionId, 'ready');
    });
    // Assertions above abort on failure; these definite-assignment checks keep later subtests strict.
    if (!main! || !auxiliary! || !createdDraft) throw new Error('MEDIA_LIVE_UPLOAD_SETUP_FAILED');
    const mainUpload = main!;
    const subtitleUpload = auxiliary!;
    await t.test('creator B cannot read/publish A media; private provider tables denied through real PostgREST', async () => {
      for (const relative of [`/api/uploads/${mainUpload.session.sessionId}`, `/api/upload-drafts/${createdDraft}`, `/api/media/${mainUpload.asset.mediaId}/playback`]) {
        const result = await send(`${WEB}${relative}`, { headers: { Authorization: `Bearer ${creatorB.access_token}` } });
        assert.equal(result.status, 404, 'foreign media must return 404');
      }
      const foreignPublish = await send(`${WEB}/api/titles`, { method: 'POST', headers: { Authorization: `Bearer ${creatorB.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_id: createdDraft, revision: mainUpload.draftRevision, main_media_id: mainUpload.asset.mediaId }) });
      assert.equal(foreignPublish.status, 404);
      for (const table of ['gma_media_provider_private', 'gma_media_command_results', 'gma_media_upload_chunks', 'gma_media_gateway_grants']) {
        const denied = await send(`${SUPABASE}/rest/v1/${table}?select=*`, { headers: { apikey: anon, Authorization: `Bearer ${creatorA.access_token}` } });
        assert.equal(denied.status, 403, 'authenticated browser must not read private media tables');
      }
      const bProfiles = await rest(`profiles?select=id&id=eq.${creatorA.user.id}`, creatorB.access_token);
      assert.deepEqual(bProfiles, []);
      // Direct catalogue writes must not bypass the neutral UUID/READY publication command. Mutation filters
      // use an impossible numeric ID and insert uses a test-only slug; no seeded or preexisting title is touched.
      for (const bearer of [creatorA.access_token, viewer.access_token]) {
        const slug = `phase5-denied-direct-${randomUUID()}`;
        const headers = { apikey: anon, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' };
        const inserted = await send(`${SUPABASE}/rest/v1/peliculas`, { method: 'POST', headers,
          body: JSON.stringify({ slug, title: 'Must not bypass media command', creator_user_id: creatorA.user.id, status: 'published' }) });
        if (inserted.ok) {
          // Remove only the forbidden row this exact negative test unexpectedly created; preserve all fixture data.
          const cleanup = await send(`${SUPABASE}/rest/v1/peliculas?slug=eq.${slug}`, { method: 'DELETE', headers: { apikey: admin, Authorization: `Bearer ${admin}` } });
          assert.ok(cleanup.ok, 'cleanup must remove only this forbidden test insertion');
        }
        assert.equal(inserted.status, 403, 'authenticated direct INSERT peliculas must be denied');
        for (const method of ['PATCH', 'DELETE']) {
          const denied = await send(`${SUPABASE}/rest/v1/peliculas?id=eq.-1`, { method, headers,
            ...(method === 'PATCH' ? { body: '{"status":"published"}' } : {}) });
          assert.equal(denied.status, 403, 'authenticated direct UPDATE/DELETE peliculas must be denied even without matching rows');
        }
      }
    });
    let published: z.infer<typeof titleResponse>['title'];
    let source: z.infer<typeof playbackSourceSchema>;
    await t.test('main UUID publish/catalogue, private HLS+VTT and browser Range/HEAD/CORS under real CSP', async () => {
      const detail = z.object({ draft: draftDTOSchema }).passthrough().parse(await api(`/api/upload-drafts/${createdDraft}`, creatorA.access_token));
      const body = { draft_id: createdDraft, revision: detail.draft.revision, main_media_id: mainUpload.asset.mediaId };
      published = titleResponse.parse(await api('/api/titles', creatorA.access_token, 'POST', body, [201])).title;
      createdSlug = published.slug;
      const replay = titleResponse.parse(await api('/api/titles', creatorA.access_token, 'POST', body, [201])).title;
      assert.equal(replay.id, published.id);
      const catalogue = z.array(z.object({ id: z.number(), slug: z.string() }).passthrough()).parse(await rest(`peliculas?select=id,slug&slug=eq.${encodeURIComponent(published.slug)}&status=eq.published`, viewer.access_token));
      assert.equal(catalogue.length, 1); assert.equal(catalogue[0]?.id, published.id);
      source = playbackSourceSchema.parse(await api(`/api/titles/${published.slug}/playback`, null));
      if (source.kind !== 'hls') throw new Error('MEDIA_LIVE_HLS_REQUIRED');
      assert.equal(source.mediaId, mainUpload.asset.mediaId);
      assert.equal(source.subtitles.length, 1); assert.equal(source.subtitles[0]?.id, subtitleUpload.asset.mediaId);
      const master = await browserFetch(page, source.url);
      assert.equal(master.status, 200); assert.equal(master.cache, 'private, no-store');
      // The CORS response header itself is not browser-readable unless explicitly exposed; a real successful
      // cross-origin browser fetch proves enforcement, while this HTTP check asserts its exact value.
      assert.equal((await send(source.url, { headers: { Origin: WEB } })).headers.get('access-control-allow-origin'), WEB);
      assert.ok(master.text.startsWith('#EXTM3U'));
      const childLine = master.text.split('\n').find(line => line && !line.startsWith('#'));
      assert.ok(childLine, 'master must reference a rendition');
      const renditionUrl = new URL(childLine!, source.url).href;
      assert.ok(localUrl(renditionUrl).searchParams.has('cap'), 'HLS reference must preserve signed capacity');
      const rendition = await browserFetch(page, renditionUrl);
      assert.equal(rendition.status, 200);
      const segmentLine = rendition.text.split('\n').find(line => line && !line.startsWith('#'));
      assert.ok(segmentLine, 'rendition must reference a real segment');
      const segmentUrl = new URL(segmentLine!, renditionUrl).href;
      const segment = await browserFetch(page, segmentUrl, { headers: { Range: 'bytes=0-15' } });
      assert.equal(segment.status, 206); assert.equal(segment.length, '16'); assert.ok(segment.contentRange?.startsWith('bytes 0-15/'));
      const head = await browserFetch(page, segmentUrl, { method: 'HEAD' });
      assert.equal(head.status, 200); assert.equal(head.text, '');
      assert.equal((await browserFetch(page, segmentUrl, { headers: { Range: 'bytes=999999999-' } })).status, 416);
      const vtt = await browserFetch(page, source.subtitles[0]!.url);
      assert.equal(vtt.status, 200); assert.ok(vtt.text.startsWith('WEBVTT'));
      const noCapability = new URL(source.url); noCapability.search = '';
      assert.equal((await send(noCapability.href)).status, 401);
      const hostile = await send(source.url, { headers: { Origin: 'https://not-a-gma-origin.invalid' } });
      assert.equal(hostile.status, 403); assert.equal(hostile.headers.get('access-control-allow-origin'), null);
      const preflight = await send(source.url, { method: 'OPTIONS', headers: { Origin: WEB, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Range' } });
      assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), WEB);
      const violations = await page.evaluate(() => (window as unknown as { __mediaCspViolations: string[] }).__mediaCspViolations);
      assert.deepEqual(violations, [], 'Auth/upload/HLS/VTT must not violate real GMA CSP');
      assert.deepEqual(pageEgress, [], 'GMA page requests must stay inside local fixture origins');
    });
    if (!published! || !source! || !createdSlug) throw new Error('MEDIA_LIVE_PUBLICATION_SETUP_FAILED');
    let currentTitle = published!;
    const initialSource = source!;
    await t.test('withdrawal is reversible; republish; durable delete revokes HLS and releases each quota account once', async () => {
      currentTitle = titleResponse.parse(await api(`/api/titles/${createdSlug}/unpublish`, creatorA.access_token, 'POST',
        { revision: currentTitle.mediaRevision, idempotency_key: randomUUID() })).title;
      assert.equal(currentTitle.status, 'unpublished');
      assert.equal((await send(`${WEB}/api/titles/${createdSlug}/playback`)).status, 404);
      if (initialSource.kind === 'youtube') throw new Error('MEDIA_LIVE_HLS_REQUIRED');
      assert.equal((await send(initialSource.url)).status, 401, 'withdrawal revokes already issued public grant');
      const retained = uploadMutationEnvelopeSchema.parse(await api(`/api/uploads/${mainUpload.session.sessionId}`, creatorA.access_token));
      assert.equal(retained.asset.status, 'ready');
      currentTitle = titleResponse.parse(await api(`/api/titles/${createdSlug}/republish`, creatorA.access_token, 'POST',
        { revision: currentTitle.mediaRevision, idempotency_key: randomUUID() })).title;
      assert.equal(currentTitle.status, 'published');
      const renewed = playbackSourceSchema.parse(await api(`/api/titles/${createdSlug}/playback`, null));
      if (renewed.kind !== 'hls') throw new Error('MEDIA_LIVE_HLS_REQUIRED');
      assert.equal((await send(renewed.url)).status, 200);
      const deletion = { revision: currentTitle.mediaRevision, idempotency_key: randomUUID() };
      const pending = titleResponse.parse(await api(`/api/titles/${createdSlug}`, creatorA.access_token, 'DELETE', deletion, [202])).title;
      assert.equal(pending.deletionState, 'pending');
      const replay = titleResponse.parse(await api(`/api/titles/${createdSlug}`, creatorA.access_token, 'DELETE', deletion, [202])).title;
      assert.equal(replay.id, pending.id);
      assert.equal((await send(`${WEB}/api/titles/${createdSlug}/playback`)).status, 404);
      assert.equal((await send(renewed.url)).status, 401);
      await waitEnvelope(creatorA.access_token, mainUpload.session.sessionId, 'deleted');
      await waitEnvelope(creatorA.access_token, subtitleUpload.session.sessionId, 'deleted');
      const done = titleResponse.parse(await api(`/api/titles/${createdSlug}`, creatorA.access_token)).title;
      assert.equal(done.deletionState, 'done');
      for (const sessionId of [mainUpload.session.sessionId, subtitleUpload.session.sessionId]) {
        const ledger = z.array(z.object({ account_key: z.string(), event: z.enum(['reserve', 'confirm', 'release']) })).parse(
          await rest(`gma_upload_ledger?select=account_key,event&session_id=eq.${sessionId}`));
        const accounts = new Set(ledger.map(row => row.account_key));
        assert.ok(accounts.size >= 3, 'global/owner/draft accounting must exist');
        for (const account of accounts) for (const event of ['reserve', 'confirm', 'release'])
          assert.equal(ledger.filter(row => row.account_key === account && row.event === event).length, 1, 'quota event exactly once per account');
      }
      completedDelete = true;
    });
    await t.test('historical local MP4/catalogue/profiles remain readable after neutral lifecycle', async () => {
      const legacy = playbackSourceSchema.parse(await api('/api/titles/media-local-legacy-mp4/playback', null));
      if (legacy.kind !== 'mp4') throw new Error('MEDIA_LIVE_LEGACY_MP4_REQUIRED');
      const ranged = await browserFetch(page, legacy.url, { headers: { Range: 'bytes=0-31' } });
      assert.equal(ranged.status, 206); assert.equal(ranged.length, '32');
      assert.ok(legacy.subtitles.length > 0);
      assert.equal((await browserFetch(page, legacy.subtitles[0]!.url)).status, 200);
      const profiles = z.array(z.object({ id: z.string() })).parse(await rest(`profiles?select=id&id=eq.${viewer.user.id}`, viewer.access_token));
      assert.equal(profiles.length, 1);
      assert.deepEqual(pageEgress, [], 'legacy page requests must stay inside local fixture origins');
      // Chromium may probe its own update/background services independently of page requests. The proxy
      // rejects all such destinations before forwarding; they are never contacted or used as test doubles.
      t.diagnostic(`Browser egress protection blocked ${proxy.rejected.length} non-fixture background requests; GMA page egress: 0.`);
    });
  } finally {
    // Cleanup only objects created by this test, preserving every preexisting draft/title and quota reservation.
    if (!completedDelete) {
      if (createdSlug) {
        try {
          const detail = titleResponse.parse(await api(`/api/titles/${createdSlug}`, creatorA.access_token));
          if (detail.title.deletionState === 'none') await api(`/api/titles/${createdSlug}`, creatorA.access_token, 'DELETE',
            { revision: detail.title.mediaRevision, idempotency_key: randomUUID() }, [202]);
        } catch { /* Preserve the primary failure; the real executor can finish pending cleanup. */ }
      } else if (createdDraft) {
        await api(`/api/upload-drafts/${createdDraft}`, creatorA.access_token, 'DELETE').catch(() => undefined);
      }
    }
    // Close the owned proxy first; idle browser transport must not hold test teardown open.
    await proxy.close();
    if(browser) {
      let deadline:ReturnType<typeof setTimeout>|undefined;
      try {await Promise.race([browser.close(),new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(new Error('MEDIA_LIVE_BROWSER_SHUTDOWN_TIMEOUT')),15000);})]);}
      finally {clearTimeout(deadline);}
    }
  }
});
