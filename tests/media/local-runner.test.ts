import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, copyFile, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createServer } from 'node:net';
import { assertContainerLoopback, assertLocalProject, assertLocalUrl, assertLocalDockerEndpoint, assertWorkspace, assertPortsFree, isolatedEnvironment, localRuntime, LOCAL_MIGRATION_SOURCES, prepareLocal, runLocalAction, LOCAL_PROJECT_ID } from '../../scripts/media/local-stack';

test('Docker bindings accept IPv4/IPv6 loopback only and require IPv4 API/database reachability', () => {
  const fixture = (hosts: string[]) => [{ Name: '/supabase_kong_gma-filmo-media-local', NetworkSettings: { Ports: {
    '8000/tcp': hosts.map(HostIp => ({ HostIp, HostPort: '54341' })),
    '5432/tcp': hosts.map(HostIp => ({ HostIp, HostPort: '54342' })),
  } } }];
  assertContainerLoopback(fixture(['127.0.0.1', '::1']));
  for (const host of ['0.0.0.0', '::', '192.168.1.2', 'localhost']) {
    assert.throws(() => assertContainerLoopback(fixture(['127.0.0.1', host])), /LOOPBACK_REQUIRED/);
  }
  assert.throws(() => assertContainerLoopback(fixture(['::1'])), /API_DB_REQUIRED/);
});

test('runner accepts the active Docker Desktop Unix socket and rejects remote Docker endpoints', () => {
  assert.equal(assertLocalDockerEndpoint('desktop-linux', 'unix:///Users/test/.docker/run/docker.sock'), 'desktop-linux');
  for (const [name, endpoint] of [['default', 'ssh://host'], ['desktop-linux', 'tcp://host:2376'], ['bad/context', 'unix:///tmp/docker.sock']]) {
    assert.throws(() => assertLocalDockerEndpoint(name!, endpoint!), /MEDIA_LOCAL_DOCKER_SOCKET_REQUIRED/);
  }
});

test('runner rejects remote or alternate-port project URLs and IDs', () => {
  assert.equal(assertLocalUrl('http://127.0.0.1:54341', 54341, ['http:']).hostname, '127.0.0.1');
  for (const url of ['https://prod.supabase.co', 'http://localhost:54341', 'http://127.0.0.1:54321', 'http://127.0.0.1:54341/?project=remote', 'https://127.0.0.1:54341']) {
    assert.throws(() => assertLocalUrl(url, 54341, ['http:']));
  }
  assertLocalProject('project_id = "gma-filmo-media-local"\n');
  for (const config of ['project_id = "production"', 'project_id = "gma-filmo-media-local"\nproject_id = "other"', '# project_id = "gma-filmo-media-local"']) assert.throws(() => assertLocalProject(config));
});

test('runner discards inherited remote credentials and empties keys from historical .env files', () => {
  const inherited = { PATH: '/usr/bin', HOME: '/tmp/fixture', SUPABASE_URL: 'https://prod.supabase.co', R2_SECRET_ACCESS_KEY: 'secret', R2_PUBLIC_URL: 'https://remote.example', CLOUDFLARE_ACCOUNT_ID: 'secret', DOCKER_HOST: 'tcp://remote:2375', PEERTUBE_BASE_URL: 'https://remote.example', PEERTUBE_CLIENT_SECRET: 'secret', PEERTUBE_PASSWORD: 'secret', STREAM_PROVIDER_ENABLED: 'true' };
  const env = isolatedEnvironment(inherited, { SUPABASE_URL: 'http://127.0.0.1:54341', MEDIA_VIDEO_PROVIDER: 'mock' }, ['CUSTOM_SECRET', 'R2_SECRET_ACCESS_KEY']);
  assert.equal(env.SUPABASE_URL, 'http://127.0.0.1:54341'); assert.equal(env.R2_SECRET_ACCESS_KEY, ''); assert.equal(env.R2_PUBLIC_URL, '');
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, ''); assert.equal(env.PEERTUBE_BASE_URL, ''); assert.equal(env.PEERTUBE_CLIENT_SECRET, '');
  assert.equal(env.PEERTUBE_PASSWORD, ''); assert.equal(env.STREAM_PROVIDER_ENABLED, '');
  assert.equal(env.CUSTOM_SECRET, ''); assert.equal(env.DOCKER_HOST, ''); assert.equal(env.PATH, '/usr/bin'); assert.equal(env.MEDIA_VIDEO_PROVIDER, 'mock');
});

test('runner refuses workspace escape and symlink components before writing', async () => {
  const root = await mkdtemp(path.resolve('work/media-phase5/runner-guard-'));
  const workspace = path.join(root, 'work/media-local');
  try {
    await mkdir(workspace, { recursive: true });
    await assertWorkspace(root, workspace);
    await assert.rejects(assertWorkspace(root, path.resolve(root, '../outside')));
    await symlink(path.resolve(root), path.join(workspace, 'supabase'));
    await assert.rejects(assertWorkspace(root, workspace), /SYMLINK/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing cached CLI fails without npx, installation or remote contact', async () => {
  const root = await mkdtemp(path.resolve('work/media-phase5/runner-runtime-'));
  try { await assert.rejects(localRuntime(root, {}), /SUPABASE_CLI_MISSING/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('runner refuses a Docker environment aimed at a remote daemon before inspecting runtime', async () => {
  const root = await mkdtemp(path.resolve('work/media-phase5/runner-runtime-'));
  try {
    await mkdir(path.join(root, 'node_modules/.bin'), { recursive: true });
    await writeFile(path.join(root, 'node_modules/.bin/supabase'), 'fixture');
    await assert.rejects(localRuntime(root, { DOCKER_HOST: 'tcp://remote:2375' }), /DOCKER_CONTEXT_FORBIDDEN/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('prepare copies an explicit ordered list without importing unsafe history or overwriting signing keys', async () => {
  const root = await mkdtemp(path.resolve('work/media-phase5/runner-prepare-'));
  try {
    await mkdir(path.join(root, 'infrastructure/media-local'), { recursive: true });
    await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
    await writeFile(path.join(root, 'infrastructure/media-local/config.toml'), 'project_id = "gma-filmo-media-local"\n');
    await writeFile(path.join(root, 'infrastructure/media-local/baseline.sql'), '-- local baseline\n');
    for (const source of LOCAL_MIGRATION_SOURCES) await writeFile(path.join(root, 'supabase/migrations', source), `-- original ${source}\n`);
    await writeFile(path.join(root, 'supabase/migrations/unsafe_history.sql'), 'TRUNCATE public.peliculas;');
    const first = await prepareLocal(root);
    assert.equal(first.length, LOCAL_MIGRATION_SOURCES.length + 1);
    assert.ok(first.every(record => /^\d{14}_[a-zA-Z0-9_.-]+\.sql$/.test(record.target)));
    assert.deepEqual(first.map(record => record.target), [...first.map(record => record.target)].sort());
    assert.equal(first.findIndex(record => record.source.endsWith('2026100800031_media_title_lifecycle.sql')) > first.findIndex(record => record.source.endsWith('202610080003_media_publish_lifecycle.sql')), true);
    assert.ok(!(await readdir(path.join(root, 'work/media-local/supabase/migrations'))).includes('unsafe_history.sql'));
    const privatePath = path.join(root, 'work/media-local/keys/private.pem'); const key = await readFile(privatePath);
    const second = await prepareLocal(root); assert.deepEqual(second, first); assert.deepEqual(await readFile(privatePath), key);
    assert.equal((await stat(privatePath)).mode & 0o777, 0o600);
    assert.equal(await readFile(path.join(root, 'supabase/migrations/20261007_r2_capacity.sql'), 'utf8'), '-- original 20261007_r2_capacity.sql\n');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('start refuses occupied ports instead of treating another project health response as its own', async () => {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await assert.rejects(assertPortsFree([address.port]), /MEDIA_LOCAL_PORT_IN_USE/); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('stop recovers a dead owned supervisor only through the exact local Supabase workdir', async () => {
  const root = await mkdtemp(path.resolve('work/media-phase5/runner-orphan-'));
  const workspace = path.join(root, 'work/media-local');
  try {
    const bin = path.join(root, 'bin');
    const supabaseBin = path.join(root, 'node_modules/.bin/supabase');
    await mkdir(bin, { recursive: true }); await mkdir(path.dirname(supabaseBin), { recursive: true });
    await mkdir(path.join(workspace, 'supabase/migrations'), { recursive: true });
    const manifestPath = path.join(root, 'infrastructure/media-local/runtime-images.json');
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await copyFile(path.resolve('infrastructure/media-local/runtime-images.json'), manifestPath);
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { supabase: '2.120.0' } }));
    await mkdir(path.join(root, 'node_modules/supabase'), { recursive: true });
    await writeFile(path.join(root, 'node_modules/supabase/package.json'), JSON.stringify({ version: '2.120.0' }));
    const config = 'project_id = "gma-filmo-media-local"\n';
    await writeFile(path.join(workspace, 'supabase/config.toml'), config);
    const fixtureId = randomUUID();
    await writeFile(path.join(workspace, 'fixture-owner.json'), JSON.stringify({ projectId: LOCAL_PROJECT_ID, repository: await realpath(root),
      fixtureId, version: 1, configSha256: createHash('sha256').update(config).digest('hex') }));
    const child = spawn(process.execPath, ['-e', '']);
    const stalePid = child.pid!;
    await new Promise<void>(resolve => child.once('exit', () => resolve()));
    const callsFile = path.join(root, 'stop-args.json');
    const cli = `#!/usr/bin/env node\nconst fs=require('node:fs');fs.writeFileSync(${JSON.stringify(callsFile)},JSON.stringify(process.argv.slice(2)));`;
    await writeFile(supabaseBin, cli); await chmod(supabaseBin, 0o755);
    const docker = `#!/usr/bin/env node\nconst [a,b]=process.argv.slice(2);if(a==='context'&&b==='show')process.stdout.write('fixture-desktop\\n');else if(a==='context'&&b==='inspect')process.stdout.write('unix:///tmp/docker.sock\\n');else if(a==='info')process.stdout.write('{}');else if(a==='image'&&b==='inspect')process.exitCode=0;else process.exitCode=78;`;
    await writeFile(path.join(bin, 'docker'), docker); await chmod(path.join(bin, 'docker'), 0o755);
    const token = randomUUID();
    await writeFile(path.join(workspace, 'process-state.json'), JSON.stringify({ projectId: LOCAL_PROJECT_ID, token, pid: stalePid, ready: true, startedAt: new Date().toISOString() }));
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = `${bin}:${originalPath ?? ''}`;
      await runLocalAction(root, path.join(root, 'scripts/media/local-stack.ts'), 'stop');
    } finally { if (originalPath === undefined) delete process.env.PATH; else process.env.PATH = originalPath; }
    assert.deepEqual(JSON.parse(await readFile(callsFile, 'utf8')) as unknown, ['stop', '--workdir', workspace]);
    await assert.rejects(readFile(path.join(workspace, 'process-state.json')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
