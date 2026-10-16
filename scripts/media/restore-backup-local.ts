/** V.1: restore only the explicitly authorized saved synthetic backup into a NEW local cluster. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Pool, types } from 'pg';
import { localEnvironment } from './local-tools';
import { serviceRepository } from '../../tests/media/service-fixture';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { MockMediaProvider } from '../../lib/media/providers/mock';
import { MediaProviderRegistry } from '../../lib/media/registry';
import { Ed25519MediaCapabilityIssuer } from '../../lib/media/capabilities';
import { createMediaGateway } from '../../lib/media/gateway/server';
import { createGatewayDelivery } from '../../lib/media/gateway/delivery';
import { PlaybackService } from '../../lib/media/playback-service';
import { engineGate } from '../../lib/uploads/http';
import { legacyMediaWritesGate } from '../../lib/media/legacy-writes';

const execute = promisify(execFile);
const sourceRelative = 'work/media-rollback/copy-ZmniPV';
const names = ['v1_source', 'v1_saved_rollback', 'v1_roundtrip'] as const;
const protectedPorts = new Set([4318, 4319, 54341, 54342, 54343, 54344, 54345, 54346]);
export function assertRestorePort(value: number): void {
  if (!Number.isInteger(value) || value < 1024 || value > 65535 || protectedPorts.has(value)) throw new Error('V1_ISOLATED_PORT_REQUIRED');
}
export function assertRestoreDatabase(value: string): void {
  if (!names.some(name => name === value)) throw new Error('V1_ISOLATED_DATABASE_REQUIRED');
}
async function newPort(): Promise<number> {
  for (;;) {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (!address || typeof address === 'string') throw new Error('V1_LOOPBACK_REQUIRED');
    if (!protectedPorts.has(address.port)) { assertRestorePort(address.port); return address.port; }
  }
}
/** Hashes content and access modes; rejects symlinks rather than following runtime paths. */
export async function treeManifest(root: string): Promise<Record<string, { sha256: string; bytes: number; mode: number }>> {
  const result: Record<string, { sha256: string; bytes: number; mode: number }> = {};
  async function visit(relative: string): Promise<void> {
    const full = path.join(root, relative), stat = await lstat(full);
    if (stat.isSymbolicLink()) throw new Error('V1_BACKUP_SYMLINK_FORBIDDEN');
    if (stat.isDirectory()) { for (const name of (await readdir(full)).sort()) await visit(path.join(relative, name)); }
    else if (stat.isFile()) {
      const bytes = await readFile(full); result[relative] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mode: stat.mode & 0o777 };
    } else throw new Error('V1_BACKUP_SPECIAL_FILE_FORBIDDEN');
  }
  await visit(''); return result;
}
async function dataFingerprint(db: Pool): Promise<Record<string, { rows: number; sha256: string }>> {
  const tables = await db.query<{ schema: string; name: string }>(`SELECT schemaname AS schema,tablename AS name FROM pg_tables
    WHERE schemaname IN ('public','auth') ORDER BY schemaname,tablename`);
  const result: Record<string, { rows: number; sha256: string }> = {};
  for (const table of tables.rows) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table.schema) || !/^[a-z_][a-z0-9_]*$/.test(table.name)) throw new Error('V1_TABLE_NAME_INVALID');
    const rows = await db.query<{ row: unknown }>(`SELECT to_jsonb(t) AS row FROM "${table.schema}"."${table.name}" t ORDER BY to_jsonb(t)::text`);
    result[`${table.schema}.${table.name}`] = { rows: rows.rowCount ?? 0, sha256: createHash('sha256').update(JSON.stringify(rows.rows)).digest('hex') };
  }
  return result;
}
async function securityFingerprint(db: Pool): Promise<unknown> {
  const policies = await db.query(`SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname IN ('public','auth') ORDER BY schemaname,tablename,policyname`);
  const tables = await db.query(`SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','auth') AND c.relkind='r' ORDER BY n.nspname,c.relname`);
  const functions = await db.query(`SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef,p.proconfig,p.proacl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth') ORDER BY n.nspname,p.proname,args`);
  return { policies: policies.rows, tables: tables.rows, functions: functions.rows };
}
export async function restoreSavedBackupLocal() {
  if (process.env.MEDIA_RESTORE_BACKUP_AUTHORIZED !== 'true') throw new Error('V1_RESTORE_EXPLICIT_AUTHORIZATION_REQUIRED');
  const startedAt = Date.now(), root = await realpath(process.cwd()), source = path.join(root, sourceRelative);
  for (const part of ['work', 'work/media-rollback', sourceRelative, 'work/vps-preflight']) {
    if ((await lstat(path.join(root, part))).isSymbolicLink()) throw new Error('V1_BACKUP_SYMLINK_FORBIDDEN');
  }
  if (((await lstat(source)).mode & 0o777) !== 0o700) throw new Error('V1_PRIVATE_BACKUP_REQUIRED');
  const previous = JSON.parse(await readFile(path.join(source, 'report.json'), 'utf8')) as Record<string, unknown>;
  if (previous.copy !== sourceRelative || previous.isolated !== true || previous.originalUnchanged !== true || previous.securityRestored !== true) throw new Error('V1_BACKUP_PROVENANCE_REQUIRED');
  const bin = process.env.PG_BIN_DIR;
  if (!bin || !path.isAbsolute(bin)) throw new Error('V1_LOCAL_PG_BIN_REQUIRED');
  const environment = await localEnvironment(); // Reject linked/remote configuration BEFORE creating a cluster.
  const live = new Pool({ connectionString: environment.SUPABASE_DB_URL, options: '-c default_transaction_read_only=on -c timezone=UTC', max: 1, connectionTimeoutMillis: 5000 });
  try {
    const liveBefore = await dataFingerprint(live), liveSecurity = await securityFingerprint(live);
    const liveFilesBefore = await treeManifest(path.join(root, 'work/media-local/storage'));
    const liveKeysBefore = await treeManifest(path.join(root, 'work/media-local/keys'));
    const liveEnvBefore = createHash('sha256').update(await readFile('.env.media.local')).digest('hex');
    const sourceBefore = await treeManifest(source);
    const roles = await live.query<{ rolname: string; rolbypassrls: boolean }>("SELECT rolname,rolbypassrls FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname");
    const parent = path.join(root, 'work/vps-preflight/restores'); await mkdir(parent, { recursive: true, mode: 0o700 });
    if ((await lstat(parent)).isSymbolicLink()) throw new Error('V1_ISOLATED_TARGET_REQUIRED');
    const target = await mkdtemp(path.join(parent, 'saved-backup-')); await chmod(target, 0o700);
    const cluster = path.join(target, 'postgres'), pgPort = await newPort(), password = randomBytes(32).toString('hex');
    await writeFile(path.join(target, 'pg-password'), password, { mode: 0o600 });
    const childEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C', NODE_ENV: 'test', PGPASSWORD: password };
    const run = async (name: string, args: string[], timeout = 120_000) => {
      try { return await execute(path.join(bin, name), args, { env: childEnv, timeout, maxBuffer: 16 * 1024 ** 2 }); }
      catch { throw new Error(`V1_ISOLATED_${name.toUpperCase()}_FAILED`); } // Never log dump data/URLs/passwords.
    };
    const connection = (database: string) => new Pool({ host: '127.0.0.1', port: pgPort, user: 'v1_restore_owner', password, database, max: 1, options: '-c timezone=UTC' });
    let started = false;
    const previousInt8 = types.getTypeParser(20, 'text');
    types.setTypeParser(20, value => { const n = Number(value); if (!Number.isSafeInteger(n)) throw new Error('V1_INTEGER_UNSAFE'); return n; });
    const oldEnvironment = { ...process.env };
    try {
      const version = (await run('pg_restore', ['--version'])).stdout.trim();
      const toc = (await run('pg_restore', ['--list', path.join(source, 'source.dump')])).stdout;
      if (!toc.includes('Dumped from database version: 17.11') || !version.includes('17.')) throw new Error('V1_BACKUP_PG_VERSION_MISMATCH');
      await writeFile(path.join(target, 'source-manifest.json'), JSON.stringify(sourceBefore, null, 2), { mode: 0o600 });
      await cp(path.join(source, 'source-storage'), path.join(target, 'source-storage'), { recursive: true, errorOnExist: true });
      await cp(path.join(source, 'restored-storage'), path.join(target, 'restored-storage'), { recursive: true, errorOnExist: true });
      await cp(path.join(source, 'keys'), path.join(target, 'keys'), { recursive: true, errorOnExist: true });
      assert.deepEqual(await treeManifest(path.join(target, 'source-storage')), await treeManifest(path.join(source, 'source-storage')));
      assert.deepEqual(await treeManifest(path.join(target, 'restored-storage')), await treeManifest(path.join(source, 'restored-storage')));
      assert.deepEqual(await treeManifest(path.join(target, 'keys')), await treeManifest(path.join(source, 'keys')));
      await run('initdb', ['-D', cluster, '-U', 'v1_restore_owner', '--auth=scram-sha-256', '--pwfile', path.join(target, 'pg-password'), '--no-locale', '-E', 'UTF8']);
      await run('pg_ctl', ['-D', cluster, '-l', path.join(target, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort} -c unix_socket_directories=''`, '-w', 'start']); started = true;
      const admin = connection('postgres');
      try {
        for (const role of roles.rows) {
          if (!/^[a-z_][a-z0-9_]*$/.test(role.rolname)) throw new Error('V1_ROLE_INVALID');
          if (role.rolname !== 'v1_restore_owner') await admin.query(`CREATE ROLE "${role.rolname}" NOLOGIN${role.rolbypassrls ? ' BYPASSRLS' : ''}`);
        }
        for (const name of names) { assertRestoreDatabase(name); await admin.query(`CREATE DATABASE ${name}`); }
      } finally { await admin.end(); }
      const restore = async (database: string, dump: string) => {
        assertRestorePort(pgPort); assertRestoreDatabase(database);
        const db = connection(database); try { await db.query('DROP SCHEMA public'); } finally { await db.end(); }
        await run('pg_restore', ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'v1_restore_owner', '-d', database, '--no-owner', '--exit-on-error', dump]);
      };
      await restore('v1_source', path.join(source, 'source.dump'));
      await restore('v1_saved_rollback', path.join(source, 'rollback.dump'));
      const sourceDb = connection('v1_source'), savedDb = connection('v1_saved_rollback');
      try {
        const sourceData = await dataFingerprint(sourceDb), savedData = await dataFingerprint(savedDb), savedSecurity = await securityFingerprint(savedDb);
        assert.deepEqual(await securityFingerprint(sourceDb), savedSecurity, 'security metadata differs between saved snapshots');
        // Explicit permission checks; global roles/passwords are not included in pg_dump and are recreated NOLOGIN.
        const perms = await savedDb.query<{ role: string; insert: boolean; update: boolean; delete: boolean; execute: boolean }>(`SELECT role,
          has_table_privilege(role,'public.peliculas','INSERT') AS insert,has_table_privilege(role,'public.peliculas','UPDATE') AS update,
          has_table_privilege(role,'public.peliculas','DELETE') AS delete,has_function_privilege(role,'public.gma_media_command(uuid,text,jsonb)','EXECUTE') AS execute
          FROM unnest(ARRAY['anon','authenticated','service_role']) role ORDER BY role`);
        for (const row of perms.rows) {
          if (row.role === 'service_role') assert.equal(row.execute, true);
          else { assert.equal(row.insert, false); assert.equal(row.update, false); assert.equal(row.delete, false); assert.equal(row.execute, false); }
        }
        const auth = await savedDb.query<{ id: string }>("SELECT id FROM auth.users WHERE email IN ('gma.creator-a@example.invalid','gma.creator-b@example.invalid') ORDER BY email");
        assert.equal(auth.rows.length, 2, 'both synthetic owners must survive');
        assert.deepEqual(sourceData['auth.users'], savedData['auth.users']); assert.deepEqual(sourceData['auth.identities'], savedData['auth.identities']);
        const counts = Object.fromEntries(Object.entries(savedData).map(([name, value]) => [name, value.rows]));
        await run('pg_dump', ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'v1_restore_owner', '-d', 'v1_saved_rollback', '-Fc', '--no-owner', '-n', 'public', '-n', 'auth', '-f', path.join(target, 'roundtrip.dump')]);
        await chmod(path.join(target, 'roundtrip.dump'), 0o600); await restore('v1_roundtrip', path.join(target, 'roundtrip.dump'));
        const roundtrip = connection('v1_roundtrip');
        try { assert.deepEqual(await dataFingerprint(roundtrip), savedData); assert.deepEqual(await securityFingerprint(roundtrip), savedSecurity); } finally { await roundtrip.end(); }
        const candidates = await savedDb.query<{ id: string; owner_id: string }>(`SELECT a.id,a.owner_id FROM gma_media_assets a
          JOIN gma_draft_media m ON m.asset_id=a.id JOIN gma_upload_drafts d ON d.id=m.draft_id
          WHERE a.provider='mock' AND a.role='main' AND a.state='ready' AND d.state='draft' ORDER BY a.created_at DESC`);
        assert.ok(candidates.rows.length > 0, 'saved snapshot must have a READY preview');
        const ready = candidates.rows[0]!;
        Object.assign(process.env, { UPLOAD_ENVIRONMENT: 'local', UPLOAD_ENGINE_V2: 'true', LEGACY_MEDIA_WRITES_ENABLED: 'false', MEDIA_MOCK_ENABLED: 'true',
          MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_AUXILIARY_PROVIDER: 'mock', SUPABASE_URL: 'http://127.0.0.1:54341', PEERTUBE_PROVIDER_ENABLED: 'false', UPLOADS_PAUSED: 'true' });
        assert.throws(() => engineGate(true), /UPLOAD_ADMISSION_PAUSED/); engineGate(false);
        assert.throws(() => legacyMediaWritesGate(), /LEGACY_UPLOAD_DISABLED/);
        const repo = serviceRepository(savedDb), storage = new MockMediaStorage(path.join(target, 'restored-storage'));
        const privateKey = createPrivateKey(await readFile(path.join(target, 'keys/private.pem'))), publicKey = createPublicKey(privateKey);
        const issuer = new Ed25519MediaCapabilityIssuer(privateKey, 'v1-restore');
        const deps = { repository: repo, storage, publicKeys: { 'v1-restore': publicKey }, origins: ['http://127.0.0.1:4318'] };
        const gateway = createMediaGateway(deps, createGatewayDelivery(deps, path.resolve('tests/media/fixtures/hls')));
        await new Promise<void>(resolve => gateway.listen(0, '127.0.0.1', resolve));
        try {
          const address = gateway.address(); if (!address || typeof address === 'string') throw new Error('V1_LOOPBACK_REQUIRED'); assertRestorePort(address.port);
          const provider = new MockMediaProvider(storage, repo, `http://127.0.0.1:${address.port}`, issuer);
          const forbidden = () => { throw new Error('V1_REMOTE_PROVIDER_FORBIDDEN'); };
          const registry = new MediaProviderRegistry({ mock: () => provider, r2: forbidden, stream: forbidden, peertube: forbidden }, () => 'mock');
          const playback = new PlaybackService(repo, registry);
          await assert.rejects(playback.resolvePreview(ready.id, auth.rows.find(user => user.id !== ready.owner_id)!.id));
          const source = await playback.resolvePreview(ready.id, ready.owner_id); assert.equal(source.kind, 'hls');
          if (source.kind !== 'hls') throw new Error('V1_HLS_REQUIRED');
          assert.equal((await fetch(source.url, { redirect: 'error' })).status, 200);
          const unsigned = new URL(source.url); unsigned.search = ''; assert.equal((await fetch(unsigned)).status, 401);
          const decode = await execute(process.env.FFMPEG_PATH ?? '/opt/homebrew/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'http,tcp,crypto', '-i', source.url, '-t', '2', '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], { timeout: 30_000, maxBuffer: 1024 ** 2 }).catch(() => { throw new Error('V1_PRIVATE_HLS_DECODE_FAILED'); });
          assert.equal(decode.stderr, ''); // Never expose the signed URL in error diagnostics.
          const session = await repo.assetSession(ready.id);
          const context = await playback.service.context(session.id, ready.owner_id);
          await playback.service.draftMutation(ready.owner_id, 'abandon', { draft_id: context.session.draft_id });
          await playback.service.remove(await playback.service.context(session.id));
          assert.equal((await playback.service.context(session.id)).asset.state, 'deleted');
          assert.ok([401, 403, 404, 410].includes((await fetch(source.url, { redirect: 'error' })).status), 'cancelled copied asset must deny playback');
        } finally { gateway.closeAllConnections(); await new Promise<void>(resolve => gateway.close(() => resolve())); }
        assert.deepEqual(await dataFingerprint(live), liveBefore, 'live fixture data changed'); assert.deepEqual(await securityFingerprint(live), liveSecurity);
        assert.deepEqual(await treeManifest(path.join(root, 'work/media-local/storage')), liveFilesBefore);
        assert.deepEqual(await treeManifest(path.join(root, 'work/media-local/keys')), liveKeysBefore);
        assert.equal(createHash('sha256').update(await readFile('.env.media.local')).digest('hex'), liveEnvBefore);
        assert.deepEqual(await treeManifest(path.join(root, sourceRelative)), sourceBefore, 'saved backup changed');
        const report = { isolated: true, source: sourceRelative, target: path.relative(root, target), postgresVersion: version, postgresPort: pgPort,
          originalFixtureUnchanged: true, backupSourceUnchanged: true, schemasRestored: ['public', 'auth'], tables: counts,
          allTableFingerprintsRoundtripMatch: true, securityRoundtripMatch: true, titleWritesClosed: true, ownershipEnforced: true,
          admissionPaused: true, cancelAllowedWhilePaused: true, legacyWritesClosed: true, privateHlsHttp: true, realVideoAndAudioDecode: true,
          storageAndKeysCopiedExactly: true, technicalRolesNoLogin: true, authHttpServerStarted: false,
          elapsedMs: Date.now() - startedAt, servicesStoppedAfterTest: false };
        await writeFile(path.join(target, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
        return { ...report, servicesStoppedAfterTest: true };
      } finally { await sourceDb.end(); await savedDb.end(); }
    } finally {
      if (started) await run('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', 'stop']);
      types.setTypeParser(20, previousInt8);
      for (const key of Object.keys(process.env)) if (!(key in oldEnvironment)) delete process.env[key];
      Object.assign(process.env, oldEnvironment);
      const reportPath = path.join(target, 'report.json');
      try { const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>; report.servicesStoppedAfterTest = true;
        await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); } catch { /* Failed attempts preserve private artifacts for diagnosis. */ }
    }
  } finally { await live.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) { console.error('V1_RESTORE_ARGUMENTS_FORBIDDEN'); process.exitCode = 1; }
  else void restoreSavedBackupLocal().then(result => console.log(JSON.stringify({ ...result, servicesStoppedAfterTest: true }))).catch((error: unknown) => {
    console.error(error instanceof Error && /^V1_[A-Z_]+$/.test(error.message) ? error.message : 'V1_RESTORE_VERIFICATION_FAILED'); process.exitCode = 1;
  });
}
