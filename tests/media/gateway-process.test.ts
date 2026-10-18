import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, types } from 'pg';
import { baselineSql, OWNER } from '../uploads/database';
import { mediaMigrations } from './database';
import { serviceRepository } from './service-fixture';
import { MediaService } from '../../lib/media/service';
import { MediaProviderRegistry } from '../../lib/media/registry';
import { MockMediaProvider } from '../../lib/media/providers/mock';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { mockJobProcessor } from '../../lib/media/jobs';
import { Ed25519MediaCapabilityIssuer } from '../../lib/media/capabilities';
import { PlaybackService } from '../../lib/media/playback-service';
import { TitleService } from '../../lib/media/title-service';

function isolatedConnection(): string {
  const value = process.env.MEDIA_TEST_DATABASE_URL;
  if (!value || process.env.MEDIA_TEST_DATABASE_ISOLATED !== 'true') throw new Error('MEDIA_GATEWAY_PROCESS_ISOLATION_REQUIRED');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1'
    || url.pathname !== '/gma_media_gateway_test') throw new Error('MEDIA_GATEWAY_PROCESS_LOCAL_ONLY');
  return value;
}
async function waitUntil(predicate: () => Promise<boolean>, timeout = 5000): Promise<void> {
  const deadline = Date.now() + timeout;
  do { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)); } while (Date.now() < deadline);
  throw new Error('MEDIA_GATEWAY_PROCESS_WAIT_TIMEOUT');
}
async function stop(child: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('MEDIA_GATEWAY_PROCESS_STOP_TIMEOUT')); }, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill(signal);
  });
}
async function committedBoundary(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MEDIA_GATEWAY_PROCESS_COMMIT_TIMEOUT')), 5000);
    const listener = (message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const value = message as Record<string, unknown>;
      if (value.type !== 'chunk-committed' || value.pid !== child.pid) return;
      clearTimeout(timer); child.off('message', listener); resolve();
    };
    child.on('message', listener);
  });
}
async function start(workspace: string, connection: string, crashAfterCommit = false): Promise<{ child: ChildProcess; origin: string }> {
  const helper = process.env.MEDIA_GATEWAY_PROCESS_HELPER ?? path.resolve('tests/media/helpers/gateway-process.ts');
  const child = fork(helper, [], { cwd: process.cwd(), execPath: process.execPath, execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: {
      NODE_ENV: 'test', PATH: process.env.PATH, UPLOAD_ENVIRONMENT: 'local', MEDIA_MOCK_ENABLED: 'true', MEDIA_VIDEO_PROVIDER: 'mock',
      MEDIA_AUXILIARY_PROVIDER: 'mock', PEERTUBE_PROVIDER_ENABLED: 'false', STREAM_PROVIDER_ENABLED: 'false',
      SUPABASE_URL: 'http://127.0.0.1:54341', MEDIA_GATEWAY_URL: 'http://127.0.0.1:4319',
      MEDIA_MOCK_STORAGE_DIR: path.join(workspace, 'storage'), MEDIA_TEST_DATABASE_ISOLATED: 'true',
      MEDIA_GATEWAY_PROCESS_TEST: 'true', MEDIA_GATEWAY_PROCESS_WORKSPACE: workspace, MEDIA_TEST_DATABASE_URL: connection,
      MEDIA_GATEWAY_PROCESS_CRASH_AFTER_COMMIT: crashAfterCommit ? 'true' : 'false',
    } });
  let diagnostic = '';
  child.stdout?.on('data', () => undefined);
  child.stderr?.on('data', (bytes: Buffer) => { diagnostic = `${diagnostic}${bytes.toString()}`.slice(-1000); });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`MEDIA_GATEWAY_PROCESS_READY_TIMEOUT ${diagnostic}`)), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(`MEDIA_GATEWAY_PROCESS_EARLY_EXIT ${diagnostic}`)); });
      child.on('message', (message: unknown) => {
        if (!message || typeof message !== 'object') return;
        const value = message as Record<string, unknown>;
        if (value.type !== 'ready') return;
        if (value.pid !== child.pid || typeof value.port !== 'number' || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535) {
          clearTimeout(timer); reject(new Error('MEDIA_GATEWAY_PROCESS_READY_INVALID')); return;
        }
        clearTimeout(timer); resolve(value.port);
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${origin}/health`)).status, 200);
    return { child, origin };
  } catch (error) { await stop(child, 'SIGKILL').catch(() => undefined); throw error; }
}

test('5.8 native PostgreSQL + OS SIGKILL/restart: durable resume, lost final response, SHA/receipt, publish/HLS and delete', { timeout: 45000 }, async () => {
  const connection = isolatedConnection();
  // Only this disposable test process changes pg's int8 parser, never application runtime.
  types.setTypeParser(20, value => { const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error('MEDIA_TEST_INTEGER_UNSAFE'); return parsed; });
  const pool = new Pool({ connectionString: connection, max: 4 });
  const scratch = await realpath(path.resolve('work/media-phase5'));
  const workspace = await mkdtemp(path.join(scratch, 'gateway-process-'));
  if (!(await realpath(workspace)).startsWith(`${scratch}${path.sep}`)) throw new Error('MEDIA_GATEWAY_PROCESS_WORKSPACE_INVALID');
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries({ UPLOAD_ENVIRONMENT: 'local', MEDIA_MOCK_ENABLED: 'true',
    MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_AUXILIARY_PROVIDER: 'mock', SUPABASE_URL: 'http://127.0.0.1:54341',
    PEERTUBE_PROVIDER_ENABLED: 'false', STREAM_PROVIDER_ENABLED: 'false' })) {
    previous.set(name, process.env[name]); process.env[name] = value;
  }
  const children: ChildProcess[] = [];
  try {
    // Auth is a unit-PG fixture here, not Supabase Auth or an E2E authentication claim.
    const authFixture = baselineSql.replace('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;', () => `DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;`);
    await pool.query(authFixture);
    for (const file of ['supabase/migrations/20261005_upload_engine_v2.sql', 'supabase/migrations/20261006_upload_engine_r2_first.sql',
      'supabase/migrations/20261007_r2_capacity.sql', 'supabase/migrations/202610080001_media_provider_neutral.sql', ...mediaMigrations]) {
      await pool.query(await readFile(file, 'utf8'));
    }
    await pool.query('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    const keys = generateKeyPairSync('ed25519');
    await writeFile(path.join(workspace, 'public.pem'), keys.publicKey.export({ format: 'pem', type: 'spki' }), { mode: 0o600 });
    const issuer = new Ed25519MediaCapabilityIssuer(keys.privateKey, 'process');
    const repo = serviceRepository(pool);
    const storage = new MockMediaStorage(path.join(workspace, 'storage'));
    const initial = await start(workspace, connection, true); children.push(initial.child);
    let running = initial;
    let provider = new MockMediaProvider(storage, repo, running.origin, issuer);
    const registry = new MediaProviderRegistry({ mock: () => provider,
      r2: () => { throw new Error('R2_NOT_EXPECTED'); }, stream: () => { throw new Error('STREAM_NOT_EXPECTED'); },
      peertube: () => { throw new Error('PEERTUBE_NOT_EXPECTED'); } }, () => 'mock');
    const service = new MediaService(repo, registry, { now: () => Date.now() },
      { get: () => mockJobProcessor(storage, { now: () => Date.now(), async wait() {} }) });
    const draft = await repo.uploadCommand(OWNER, 'create_draft', { purpose: 'title' }) as { id: string; revision: number };
    const bytes = await readFile('tests/media/fixtures/hls/legacy.mp4');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const reserved = await service.reserve(OWNER, { draft_id: draft.id, revision: draft.revision, role: 'main', bytes: bytes.length,
      sha256: digest, file_name: 'local.mp4', content_type: 'video/mp4', idempotency_key: randomUUID() });
    const id = reserved.result.session.sessionId;
    const context = await service.context(id);
    const grant = issuer.issue({ sessionId: id, assetId: context.asset.id, generation: 1, scope: 'upload', method: 'PUT',
      namespace: `transfer/${id}/1/`, expectedBytes: bytes.length, ttlSeconds: 900 });
    const headers = { Authorization: `Bearer ${grant.token}`, Origin: 'http://127.0.0.1:4318' };
    const upload = (body: Buffer, startByte: number) => fetch(`${running.origin}/transfer/${id}`, { method: 'PUT',
      headers: { ...headers, 'Content-Range': `bytes ${startByte}-${startByte + body.length - 1}/${bytes.length}` }, body: new Uint8Array(body) });
    const query = () => fetch(`${running.origin}/transfer/${id}`, { method: 'PUT',
      headers: { ...headers, 'Content-Range': `bytes */${bytes.length}`, 'Content-Length': '0' } });
    const split = Math.floor(bytes.length / 2);
    const committed = committedBoundary(running.child);
    const firstRequest = upload(bytes.subarray(0, split), 0).then(() => null, (error: unknown) => error);
    await committed;
    const persisted = await repo.session(id);
    const staged = await readdir(path.join(workspace, 'storage', id, 'g1'));
    assert.equal(staged.some(file => file.startsWith('.pending-')), true);
    assert.equal(staged.some(file => file.startsWith('chunk-')), false);
    assert.equal((await repo.transferChunks(id, 1)).length, 1);
    const firstPid = running.child.pid;
    await stop(running.child, 'SIGKILL');
    assert.equal(running.child.signalCode, 'SIGKILL');
    assert.ok(await firstRequest instanceof Error);
    // Deterministic SQL-clock advance in this disposable test DB; no proof/offset/state is fabricated.
    await pool.query("UPDATE gma_upload_sessions SET transfer_lease_until=now()-interval '1 second' WHERE id=$1", [id]);
    running = await start(workspace, connection); children.push(running.child);
    assert.notEqual(running.child.pid, firstPid);
    const resumed = await query(); assert.equal(resumed.status, 308); assert.equal(resumed.headers.get('range'), `bytes=0-${split - 1}`);
    assert.equal((await repo.transferChunks(id, 1)).length, 1);
    assert.ok((await repo.session(id)).transfer_fence > persisted.transfer_fence);
    const recoveredFiles = await readdir(path.join(workspace, 'storage', id, 'g1'));
    assert.equal(recoveredFiles.some(file => file.startsWith('chunk-')), true);
    assert.equal(recoveredFiles.some(file => file.startsWith('.pending-')), false);
    await assert.rejects(repo.gatewayState(OWNER, id, 1, persisted.transfer_lease_owner!, persisted.transfer_fence,
      { finalization_pending: true }), /UPLOAD_LEASE_LOST/);
    const beforeFinal = await service.context(id);
    await repo.command(OWNER, 'bind_upload', { session_id: id, transfer_generation: 1, upload_id: beforeFinal.privateState.uploadId!,
      provider_media_id: null, private_state: { mockScenario: 'upload-response-lost' } });
    await assert.rejects(upload(bytes.subarray(split), split));
    await waitUntil(async () => Boolean((await repo.privateState(id)).provisional_receipt) && (await repo.session(id)).transfer_lease_owner === null);
    const receiptBeforeCrash = (await repo.privateState(id)).provisional_receipt;
    const secondPid = running.child.pid;
    await stop(running.child, 'SIGKILL'); running = await start(workspace, connection); children.push(running.child);
    assert.notEqual(running.child.pid, secondPid);
    const complete = await query(); assert.equal(complete.status, 200); assert.equal(complete.headers.get('range'), `bytes=0-${bytes.length - 1}`);
    assert.deepEqual((await repo.privateState(id)).provisional_receipt, receiptBeforeCrash);
    assert.equal((await repo.transferChunks(id, 1)).length, 2);
    const original = await storage.complete(id, context.asset.id, 1, bytes.length, digest);
    assert.equal(original.sha256, digest); assert.equal(original.size, bytes.length);
    assert.equal(createHash('sha256').update(await readFile(original.filePath)).digest('hex'), digest);
    assert.equal((await pool.query<{ count: number }>('SELECT count(*) AS count FROM gma_upload_sessions')).rows[0]?.count, 1);
    await waitUntil(async () => (await repo.session(id)).transfer_lease_owner === null);
    await service.complete(OWNER, id, 1); await service.tick(10, true);
    assert.equal((await service.context(id)).asset.state, 'ready');
    const current = await service.envelope(OWNER, id);
    await repo.uploadCommand(OWNER, 'update_draft', { draft_id: draft.id, revision: current.draftRevision, metadata: { title: 'Process restart local' } });
    const publishDraft = await repo.draft(OWNER, draft.id);
    const titles = new TitleService(repo);
    const published = await titles.publish(OWNER, { draft_id: draft.id, revision: publishDraft.revision, main_media_id: context.asset.id });
    // The cached upload registry still points at the initial port; playback registry gets the restarted HTTP origin.
    provider = new MockMediaProvider(storage, repo, running.origin, issuer);
    const playbackRegistry = new MediaProviderRegistry({ mock: () => provider,
      r2: () => { throw new Error('R2_NOT_EXPECTED'); }, stream: () => { throw new Error('STREAM_NOT_EXPECTED'); },
      peertube: () => { throw new Error('PEERTUBE_NOT_EXPECTED'); } }, () => 'mock');
    const source = await new PlaybackService(repo, playbackRegistry).resolveTitle(published.title.slug, null);
    assert.equal(source.kind, 'hls'); if (source.kind !== 'hls') throw new Error('HLS_EXPECTED');
    const master = await fetch(source.url, { headers: { Origin: 'http://127.0.0.1:4318' } });
    assert.equal(master.status, 200); assert.equal(master.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4318');
    assert.equal(master.headers.get('cache-control'), 'private, no-store');
    const text = await master.text(); assert.match(text, /#EXTM3U/);
    const playlistLine = text.split('\n').find(line => line && !line.startsWith('#'))!;
    const playlist = await fetch(new URL(playlistLine, running.origin)); assert.equal(playlist.status, 200);
    const playlistText = await playlist.text();
    const segmentLine = playlistText.split('\n').find(line => line && !line.startsWith('#'))!;
    const segment = await fetch(new URL(segmentLine, running.origin), { headers: { Range: 'bytes=0-15' } });
    assert.equal(segment.status, 206); assert.equal((await segment.arrayBuffer()).byteLength, 16);
    const withdrawn = await titles.lifecycle(OWNER, published.title.slug, 'unpublish', { revision: published.title.mediaRevision, idempotency_key: randomUUID() });
    assert.equal((await fetch(source.url)).status, 401);
    const pending = await titles.lifecycle(OWNER, published.title.slug, 'delete', { revision: withdrawn.title.mediaRevision, idempotency_key: randomUUID() });
    assert.equal(pending.title.deletionState, 'pending');
    await service.remove(await service.context(id)); await repo.schedule();
    assert.equal((await titles.detail(OWNER, published.title.slug)).title.deletionState, 'done');
    assert.equal((await repo.session(id)).quota_released, true);
    const releases = await pool.query<{ count: number }>("SELECT count(*) AS count FROM gma_upload_ledger WHERE session_id=$1 AND event='release'", [id]);
    assert.equal(releases.rows[0]?.count, 3);
  } finally {
    await Promise.allSettled(children.map(child => stop(child, 'SIGKILL')));
    await pool.end();
    await rm(workspace, { recursive: true, force: true });
    for (const [name, value] of previous) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
