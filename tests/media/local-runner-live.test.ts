/** Explicitly destructive only to the runner-owned LOCAL fixture; never uses a linked project. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { assertManagedEnvironment, assertWorkspace, LOCAL_PROJECT_ID, runLocalAction } from '../../scripts/media/local-stack';
import { uploadMutationEnvelopeSchema } from '../../lib/media/contracts';
import { draftDTOSchema } from '../../lib/media/dto';

const WEB = 'http://127.0.0.1:4318';
const GATEWAY = 'http://127.0.0.1:4319';
const API = 'http://127.0.0.1:54341';
const origins = new Set([WEB, GATEWAY, API]);
const seedSchema = z.object({ projectId: z.literal(LOCAL_PROJECT_ID), legacyBytes: z.number().int().positive(),
  users: z.array(z.object({ id: z.string().uuid() }).passthrough()).length(3) }).passthrough();
const draftSchema = z.object({ draft: draftDTOSchema }).passthrough();

test('5.6/5.8 owned runner: reset, restart durable partial upload, fail/retry/cancel and reset again', { timeout: 360_000 }, async t => {
  if (process.env.MEDIA_LOCAL_RUNNER_ACCEPTANCE !== 'true') throw new Error('MEDIA_LOCAL_RUNNER_ACCEPTANCE_REQUIRED');
  const repo = await realpath(process.cwd());
  const workspace = path.join(repo, 'work/media-local');
  const script = path.join(repo, 'scripts/media/local-stack.ts');
  await assertWorkspace(repo, workspace);
  await assertManagedEnvironment(repo);
  const ownerSchema = z.object({ projectId: z.literal(LOCAL_PROJECT_ID), fixtureId: z.string().uuid() }).passthrough();
  const owner = ownerSchema.parse(JSON.parse(await readFile(path.join(workspace, 'fixture-owner.json'), 'utf8')) as unknown);
  const preserved = ['work/media-local/credentials.json', 'work/media-local/keys/private.pem', 'work/media-local/keys/public.pem', 'supabase/migrations/20261007_r2_capacity.sql'];
  const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
  const hashes = await Promise.all(preserved.map(async name => digest(await readFile(path.join(repo, name)))));
  async function env(): Promise<Record<string, string>> {
    await assertManagedEnvironment(repo);
    const file = path.join(repo, '.env.media.local');
    assert.equal((await lstat(file)).mode & 0o777, 0o600);
    const result: Record<string, string> = {};
    for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const at = line.indexOf('=');
      if (at < 1 || !/^[A-Z][A-Z0-9_]*$/.test(line.slice(0, at))) throw new Error('MEDIA_LOCAL_ENV_INVALID');
      const value: unknown = JSON.parse(line.slice(at + 1));
      if (typeof value !== 'string') throw new Error('MEDIA_LOCAL_ENV_INVALID');
      result[line.slice(0, at)] = value;
    }
    assert.equal(result.SUPABASE_URL, API); assert.equal(result.MEDIA_GATEWAY_URL, GATEWAY);
    assert.equal(result.PEERTUBE_PROVIDER_ENABLED, 'false');
    return result;
  }
  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    if (!origins.has(new URL(url).origin)) throw new Error('MEDIA_LOCAL_URL_REQUIRED');
    return fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  }
  async function json(url: string, statuses: readonly number[], init: RequestInit = {}): Promise<unknown> {
    const response = await request(url, init);
    if (!statuses.includes(response.status)) throw new Error(`MEDIA_LOCAL_ACCEPTANCE_HTTP_${response.status}:${new URL(url).pathname}`);
    if (response.status === 204) return null;
    return response.json() as Promise<unknown>;
  }
  async function seed() { return seedSchema.parse(JSON.parse(await readFile(path.join(workspace, 'seed.json'), 'utf8')) as unknown); }
  async function invariant() {
    const currentOwner = ownerSchema.parse(JSON.parse(await readFile(path.join(workspace, 'fixture-owner.json'), 'utf8')) as unknown);
    assert.equal(currentOwner.fixtureId, owner.fixtureId);
    for (let i = 0; i < preserved.length; i++) assert.equal(digest(await readFile(path.join(repo, preserved[i]!))), hashes[i], 'reset/restart must preserve credentials, keys and source migration');
  }
  async function rest(environment: Record<string, string>, relative: string, init: RequestInit = {}, statuses = [200]): Promise<unknown> {
    const key = environment.SUPABASE_SERVICE_ROLE_KEY!;
    return json(`${API}/rest/v1/${relative}`, statuses, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers } });
  }
  async function cleanBaseline(environment: Record<string, string>) {
    const seeded = await seed();
    assert.deepEqual(await readdir(path.join(workspace, 'storage')), [], 'reset must remove fixture spool and processed files');
    for (const table of ['gma_upload_sessions', 'gma_media_assets', 'gma_upload_jobs'])
      assert.deepEqual(await rest(environment, `${table}?select=id`), [], 'reset must not leave invisible engine records/jobs');
    const quota = z.array(z.object({ account_key: z.string(), used_bytes: z.number().int(), reserved_bytes: z.number().int() }).passthrough())
      .parse(await rest(environment, 'gma_upload_quota?select=*&order=account_key'));
    const global = quota.find(row => row.account_key === 'global');
    assert.equal(global?.used_bytes, seeded.legacyBytes); assert.equal(global?.reserved_bytes, 0);
    const policy = z.array(z.object({ legacy_inventory_verified: z.literal(true) })).length(1).parse(await rest(environment, 'gma_upload_policy?select=legacy_inventory_verified'));
    assert.equal(policy[0]?.legacy_inventory_verified, true);
    assert.ok(quota.every(row => row.reserved_bytes === 0));
    assert.equal((await request(`${GATEWAY}/health`)).status, 200);
    assert.equal((await request(`${API}/auth/v1/health`)).status, 200);
    assert.equal((await request(WEB)).status, 200);
  }
  let environment: Record<string, string>;
  await t.test('reset/start rebuilds only owned fixture with real Auth and no neutral leftovers', async () => {
    await runLocalAction(repo, script, 'reset');
    await runLocalAction(repo, script, 'start');
    environment = await env(); await cleanBaseline(environment); await invariant();
  });
  if (!environment!) throw new Error('MEDIA_LOCAL_RESET_FAILED');
  await t.test('partial HTTP upload survives full runner restart; deterministic failure retries once and cancel releases once', async () => {
    const beforeSeed = await seed();
    async function signIn() { return z.object({ access_token: z.string() }).passthrough().parse(await json(`${API}/auth/v1/token?grant_type=password`, [200], {
      method: 'POST', headers: { apikey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gma.creator-a@example.invalid', password: environment.MEDIA_LOCAL_TEST_PASSWORD }),
    })); }
    let login = await signIn();
    async function command(relative: string, method = 'GET', body?: unknown, statuses = [200]) {
      return json(`${WEB}${relative}`, statuses, { method, headers: { Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    const draft = draftSchema.parse(await command('/api/upload-drafts', 'POST', { purpose: 'title' }, [201])).draft;
    const video = await readFile(path.join(repo, 'tests/media/fixtures/hls/legacy.mp4'));
    const sha256 = digest(video), split = Math.floor(video.length / 2);
    let current = uploadMutationEnvelopeSchema.parse(await command('/api/uploads', 'POST', { draft_id: draft.id, revision: draft.revision,
      role: 'main', bytes: video.length, sha256, file_name: 'restart.mp4', content_type: 'video/mp4', idempotency_key: randomUUID() }, [201]));
    if (current.transfer?.protocol !== 'uploadx') throw new Error('MEDIA_LOCAL_UPLOADX_REQUIRED');
    const first = await request(current.transfer.url, { method: 'PUT', headers: { ...current.transfer.headers, 'Content-Range': `bytes 0-${split - 1}/${video.length}` }, body: video.subarray(0, split) });
    assert.equal(first.status, 308); assert.equal(first.headers.get('range'), `bytes=0-${split - 1}`);
    const id = current.session.sessionId, assetId = current.asset.mediaId;
    await runLocalAction(repo, script, 'stop');
    await assert.rejects(request(`${GATEWAY}/health`));
    await runLocalAction(repo, script, 'start');
    environment = await env(); assert.deepEqual(await seed(), beforeSeed); await invariant();
    login = await signIn();
    current = uploadMutationEnvelopeSchema.parse(await command(`/api/uploads/${id}`));
    assert.equal(current.session.receivedBytes, split); assert.equal(current.asset.mediaId, assetId);
    current = uploadMutationEnvelopeSchema.parse(await command(`/api/uploads/${id}/resume`, 'POST', { revision: current.session.revision, sha256, bytes: video.length }));
    if (current.transfer?.protocol !== 'uploadx') throw new Error('MEDIA_LOCAL_UPLOADX_REQUIRED');
    assert.equal(current.transfer.offset, split);
    const last = await request(current.transfer.url, { method: 'PUT', headers: { ...current.transfer.headers, 'Content-Range': `bytes ${split}-${video.length - 1}/${video.length}` }, body: video.subarray(split) });
    assert.equal(last.status, 200);
    assert.equal(digest(await readFile(path.join(workspace, 'storage', id, `g${current.session.transferGeneration}`, 'original.bin'))), sha256);
    // A private local fixture scenario is fault injection, never a client API parameter or mocked response.
    const privateRow = z.array(z.object({ private_state: z.record(z.string(), z.unknown()) })).length(1)
      .parse(await rest(environment, `gma_media_provider_private?select=private_state&session_id=eq.${id}`))[0]!;
    await rest(environment, `gma_media_provider_private?session_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ private_state: { ...privateRow.private_state, mockScenario: 'processing-fails-once' } }) }, [204]);
    await command(`/api/uploads/${id}/complete`, 'POST', { generation: current.session.transferGeneration }, [200, 202]);
    async function wait(wanted: 'failed' | 'ready' | 'deleted') {
      const until = Date.now() + 45_000;
      while (Date.now() < until) {
        const value = uploadMutationEnvelopeSchema.parse(await command(`/api/uploads/${id}`));
        if (value.asset.status === wanted) return value;
        await new Promise<void>(resolve => setTimeout(resolve, 250));
      }
      throw new Error(`MEDIA_LOCAL_ACCEPTANCE_TIMEOUT_${wanted}`);
    }
    current = await wait('failed');
    const retry = { revision: current.session.revision, asset_revision: current.asset.revision, idempotency_key: randomUUID() };
    const once = await command(`/api/uploads/${id}/retry`, 'POST', retry);
    assert.deepEqual(await command(`/api/uploads/${id}/retry`, 'POST', retry), once);
    current = await wait('ready'); assert.equal(current.asset.mediaId, assetId); assert.equal(current.session.sessionId, id);
    await command(`/api/upload-drafts/${draft.id}`, 'DELETE');
    await wait('deleted');
    await assert.rejects(lstat(path.join(workspace, 'storage', id, `g${current.session.transferGeneration}`, 'original.bin')), { code: 'ENOENT' });
    await assert.rejects(lstat(path.join(workspace, 'storage/assets', assetId)), { code: 'ENOENT' });
    const ledger = z.array(z.object({ account_key: z.string(), event: z.string() })).parse(await rest(environment, `gma_upload_ledger?select=account_key,event&session_id=eq.${id}`));
    const accounts = new Set(ledger.map(row => row.account_key)); assert.equal(accounts.size, 3);
    for (const account of accounts) for (const event of ['reserve', 'confirm', 'release'])
      assert.equal(ledger.filter(row => row.account_key === account && row.event === event).length, 1);
  });
  await t.test('second reset/start removes fixture sessions/storage and retains stable keys/migrations', async () => {
    await runLocalAction(repo, script, 'reset'); await runLocalAction(repo, script, 'start');
    environment = await env(); await cleanBaseline(environment); await invariant();
  });
});
