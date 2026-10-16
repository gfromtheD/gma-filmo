/** Supervisor for the isolated local media fixture. Never uses a linked project. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { access, chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const LOCAL_PROJECT_ID = 'gma-filmo-media-local';
export const LOCAL_PORTS = { web: 4318, gateway: 4319, api: 54341, db: 54342, studio: 54343, mail: 54344 } as const;
export const LOCAL_MIGRATION_SOURCES = [
  '20261005_upload_engine_v2.sql', '20261006_upload_engine_r2_first.sql', '20261007_r2_capacity.sql',
  '202610080001_media_provider_neutral.sql', '202610080002_media_commands.sql',
  '202610080003_media_publish_lifecycle.sql', '2026100800031_media_title_lifecycle.sql',
  '202610080004_media_delivery_security.sql', '202610080005_media_coordination.sql',
  '202610080006_media_gateway.sql', '202610080007_media_gateway_grants.sql', '202610080008_title_writes_server_only.sql',
] as const;
type Environment = Record<string, string> & { NODE_ENV: 'development' | 'production' | 'test' };
type State = { projectId: typeof LOCAL_PROJECT_ID; token: string; pid: number; ready: boolean; startedAt: string };
type MigrationRecord = { source: string; target: string; sha256: string };
type FixtureOwner = { projectId: typeof LOCAL_PROJECT_ID; repository: string; fixtureId: string; version: 1; configSha256: string; envSha256?: string };
export type LocalCredentials = { projectId: typeof LOCAL_PROJECT_ID; fixtureId: string; password: string; executorSecret: string };
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');

export function assertLocalUrl(value: string, port: number, protocols: readonly string[]): URL {
  const url = new URL(value);
  if (url.hostname !== '127.0.0.1' || !protocols.includes(url.protocol) || Number(url.port) !== port || url.search || url.hash) {
    throw new Error('MEDIA_LOCAL_URL_REQUIRED');
  }
  return url;
}
export function assertLocalProject(config: string): void {
  const values = [...config.matchAll(/^\s*project_id\s*=\s*"([^"]+)"\s*$/gm)];
  if (values.length !== 1 || values[0]?.[1] !== LOCAL_PROJECT_ID) throw new Error('MEDIA_LOCAL_PROJECT_REQUIRED');
}
export function assertLocalDockerEndpoint(name: string, endpoint: string): string {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || !endpoint.startsWith('unix:///')) throw new Error('MEDIA_LOCAL_DOCKER_SOCKET_REQUIRED');
  return name;
}
export async function assertWorkspace(repository: string, workspace: string): Promise<void> {
  const repo = await realpath(repository);
  if (path.resolve(workspace) !== path.join(repo, 'work/media-local')) throw new Error('MEDIA_LOCAL_WORKSPACE_REQUIRED');
  // Reject symlinks at every existing component before writes or removal.
  for (const component of [path.join(repo, 'work'), workspace, path.join(workspace, 'supabase'), path.join(workspace, 'supabase/migrations'), path.join(workspace, 'keys'), path.join(workspace, 'storage'), path.join(workspace, 'fonts'), path.join(workspace, 'credentials.json'), path.join(workspace, 'fixture-owner.json'), path.join(repo, '.env.media.local')]) {
    try { if ((await lstat(component)).isSymbolicLink()) throw new Error('MEDIA_LOCAL_WORKSPACE_SYMLINK'); }
    catch (error: unknown) { if (!isMissing(error)) throw error; }
  }
}
export async function assertPortsFree(ports: readonly number[] = Object.values(LOCAL_PORTS)): Promise<void> {
  for (const port of ports) {
    const probe = createServer();
    await new Promise<void>((resolve, reject) => { probe.once('error', () => reject(new Error(`MEDIA_LOCAL_PORT_IN_USE:${port}`))); probe.listen(port, '127.0.0.1', resolve); });
    await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  }
}
function isMissing(error: unknown): boolean { return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'; }
async function exists(file: string): Promise<boolean> { try { await access(file); return true; } catch (error: unknown) { if (isMissing(error)) return false; throw error; } }

/** Only OS runtime variables survive; repository credentials are explicitly emptied before Next loads .env files. */
export function isolatedEnvironment(inherited: Record<string, string | undefined>, local: Record<string, string>, dotenvKeys: readonly string[] = []): Environment {
  const result: Environment = { NODE_ENV: 'development' };
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'SYSTEMROOT']) if (inherited[key]) result[key] = inherited[key]!;
  for (const key of dotenvKeys) result[key] = '';
  for (const key of ['SUPABASE_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN',
    'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'PEERTUBE_BASE_URL', 'PEERTUBE_USERNAME', 'PEERTUBE_PASSWORD',
    'UPLOAD_EXECUTOR_SECRET', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'DOCKER_HOST', 'DOCKER_CONTEXT']) result[key] = '';
  for (const key of Object.keys(inherited)) if (/^(?:CLOUDFLARE_|R2_|PEERTUBE_|STREAM_)/.test(key)) result[key] = '';
  return { ...result, ...local, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1' };
}

async function readOwner(repository: string): Promise<FixtureOwner | null> {
  const file = path.join(repository, 'work/media-local/fixture-owner.json');
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!value || typeof value !== 'object' || !('projectId' in value) || value.projectId !== LOCAL_PROJECT_ID
      || !('repository' in value) || value.repository !== await realpath(repository) || !('version' in value) || value.version !== 1
      || !('fixtureId' in value) || typeof value.fixtureId !== 'string' || !/^[a-f0-9-]{36}$/.test(value.fixtureId)
      || !('configSha256' in value) || typeof value.configSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.configSha256)
      || 'envSha256' in value && (typeof value.envSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.envSha256))) throw new Error('MEDIA_LOCAL_FIXTURE_OWNER_INVALID');
    return value as FixtureOwner;
  } catch (error: unknown) { if (isMissing(error)) return null; throw error; }
}
export async function assertManagedEnvironment(repository: string): Promise<void> {
  const file = path.join(repository, '.env.media.local');
  if (!await exists(file)) return;
  if ((await lstat(file)).isSymbolicLink()) throw new Error('MEDIA_LOCAL_ENV_UNOWNED');
  const owner = await readOwner(repository), content = await readFile(file);
  const marker = owner ? `# GMA_MEDIA_LOCAL_ENV ${LOCAL_PROJECT_ID} ${owner.fixtureId}\n` : '';
  if (!owner || !owner.envSha256 || hash(content) !== owner.envSha256 || !content.toString().startsWith(marker)) throw new Error('MEDIA_LOCAL_ENV_UNOWNED: preserve the existing file before creating this fixture');
}
export async function localCredentials(repository: string): Promise<LocalCredentials> {
  const owner = await readOwner(repository); if (!owner) throw new Error('MEDIA_LOCAL_FIXTURE_OWNER_REQUIRED');
  const file = path.join(repository, 'work/media-local/credentials.json');
  let value: unknown;
  if (await exists(file)) {
    const info = await lstat(file); if (info.isSymbolicLink() || (info.mode & 0o777) !== 0o600) throw new Error('MEDIA_LOCAL_CREDENTIALS_PRIVATE_REQUIRED');
    value = JSON.parse(await readFile(file, 'utf8'));
  } else {
    value = { projectId: LOCAL_PROJECT_ID, fixtureId: owner.fixtureId, password: randomBytes(32).toString('base64url'), executorSecret: randomBytes(32).toString('base64url') };
    await writeFile(file, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  }
  if (!value || typeof value !== 'object' || !('projectId' in value) || value.projectId !== LOCAL_PROJECT_ID || !('fixtureId' in value) || value.fixtureId !== owner.fixtureId
    || !('password' in value) || typeof value.password !== 'string' || !/^[a-zA-Z0-9_-]{43,}$/.test(value.password)
    || !('executorSecret' in value) || typeof value.executorSecret !== 'string' || !/^[a-zA-Z0-9_-]{43,}$/.test(value.executorSecret)) throw new Error('MEDIA_LOCAL_CREDENTIALS_INVALID');
  return value as LocalCredentials;
}
async function writeLocalEnvironment(repository: string, local: Environment): Promise<void> {
  await assertManagedEnvironment(repository);
  const owner = await readOwner(repository); if (!owner) throw new Error('MEDIA_LOCAL_FIXTURE_OWNER_REQUIRED');
  const content = `# GMA_MEDIA_LOCAL_ENV ${LOCAL_PROJECT_ID} ${owner.fixtureId}\n` + Object.entries(local).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n';
  await writeFile(path.join(repository, '.env.media.local'), content, { mode: 0o600 });
  await chmod(path.join(repository, '.env.media.local'), 0o600);
  owner.envSha256 = hash(content); await writeFile(path.join(repository, 'work/media-local/fixture-owner.json'), JSON.stringify(owner), { mode: 0o600 });
}

export async function prepareLocal(repository: string): Promise<MigrationRecord[]> {
  const workspace = path.join(await realpath(repository), 'work/media-local');
  await assertWorkspace(repository, workspace);
  const config = await readFile(path.join(repository, 'infrastructure/media-local/config.toml'), 'utf8');
  assertLocalProject(config);
  await assertManagedEnvironment(repository);
  let owner = await readOwner(repository);
  const configPath = path.join(workspace, 'supabase/config.toml');
  if (await exists(configPath) && ((await lstat(configPath)).isSymbolicLink() || !owner || hash(await readFile(configPath)) !== owner.configSha256)) throw new Error('MEDIA_LOCAL_CONFIG_UNOWNED');
  if (!owner && await exists(path.join(workspace, 'credentials.json'))) throw new Error('MEDIA_LOCAL_CREDENTIALS_UNOWNED');
  const sources = ['infrastructure/media-local/baseline.sql', ...LOCAL_MIGRATION_SOURCES.map(name => `supabase/migrations/${name}`)];
  const records: MigrationRecord[] = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]!;
    const content = await readFile(path.join(repository, source));
    const stamp = String(20261007000000 + index * 100);
    const target = `${stamp}_${path.basename(source).replace(/^\d+_/, '').replace('baseline.sql', 'media_local_baseline.sql')}`;
    records.push({ source, target, sha256: hash(content) });
  }
  // Only remove previously generated migration copies; originals and unknown files are never deleted.
  const manifestPath = path.join(workspace, 'migration-manifest.json');
  const previous: MigrationRecord[] = [];
  if (await exists(manifestPath)) {
    if ((await lstat(manifestPath)).isSymbolicLink()) throw new Error('MEDIA_LOCAL_MANIFEST_UNOWNED');
    if (!owner) throw new Error('MEDIA_LOCAL_MANIFEST_UNOWNED');
    const old: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!Array.isArray(old)) throw new Error('MEDIA_LOCAL_MANIFEST_INVALID');
    for (const entry of old) {
      if (!entry || typeof entry !== 'object' || !('target' in entry) || typeof entry.target !== 'string' || !/^20261007\d{6}_[a-zA-Z0-9_.-]+\.sql$/.test(entry.target)
        || !('source' in entry) || typeof entry.source !== 'string' || !('sha256' in entry) || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
        throw new Error('MEDIA_LOCAL_MANIFEST_INVALID');
      }
      const generated = path.join(workspace, 'supabase/migrations', entry.target);
      if (await exists(generated) && ((await lstat(generated)).isSymbolicLink() || hash(await readFile(generated)) !== entry.sha256)) throw new Error('MEDIA_LOCAL_MIGRATION_MODIFIED');
      previous.push(entry as MigrationRecord);
    }
  }
  try {
    const files = await readdir(path.join(workspace, 'supabase/migrations'));
    if (files.some(file => !previous.some(record => record.target === file))) throw new Error('MEDIA_LOCAL_MIGRATION_UNOWNED');
  } catch (error: unknown) { if (!isMissing(error)) throw error; }
  await mkdir(path.join(workspace, 'supabase/migrations'), { recursive: true, mode: 0o700 });
  await mkdir(path.join(workspace, 'storage'), { recursive: true, mode: 0o700 });
  if (!owner) owner = { projectId: LOCAL_PROJECT_ID, repository: await realpath(repository), fixtureId: randomUUID(), version: 1, configSha256: hash(config) };
  owner.configSha256 = hash(config);
  await writeFile(path.join(workspace, 'fixture-owner.json'), JSON.stringify(owner), { mode: 0o600 });
  await writeFile(configPath, config, { mode: 0o600 });
  for (const entry of previous) if (!records.some(record => record.target === entry.target)) await rm(path.join(workspace, 'supabase/migrations', entry.target), { force: true });
  for (const record of records) await copyFile(path.join(repository, record.source), path.join(workspace, 'supabase/migrations', record.target));
  await writeFile(manifestPath, JSON.stringify(records, null, 2), { mode: 0o600 });
  const keys = path.join(workspace, 'keys'); await mkdir(keys, { recursive: true, mode: 0o700 });
  const privatePath = path.join(keys, 'private.pem'), publicPath = path.join(keys, 'public.pem');
  const havePrivate = await exists(privatePath), havePublic = await exists(publicPath);
  if (havePrivate !== havePublic) throw new Error('MEDIA_LOCAL_KEYS_INCOMPLETE');
  if (havePrivate && ((await lstat(privatePath)).isSymbolicLink() || (await lstat(publicPath)).isSymbolicLink())) throw new Error('MEDIA_LOCAL_KEYS_SYMLINK');
  if (!havePrivate) {
    const pair = generateKeyPairSync('ed25519');
    await writeFile(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
    await writeFile(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644, flag: 'wx' });
  }
  await chmod(privatePath, 0o600);
  await localCredentials(repository);
  return records;
}

/** Check actual Docker bindings, not merely config.toml or the URL returned by status. */
export function assertContainerLoopback(value: unknown): void {
  if (!Array.isArray(value) || !value.length) throw new Error('MEDIA_LOCAL_CONTAINER_INSPECTION_REQUIRED');
  const boundPorts = new Set<number>();
  for (const item of value as unknown[]) {
    if (!item || typeof item !== 'object' || !('Name' in item) || typeof item.Name !== 'string' || !/^\/?supabase_[a-z0-9_-]+_gma-filmo-media-local$/.test(item.Name)
      || !('NetworkSettings' in item) || !item.NetworkSettings || typeof item.NetworkSettings !== 'object'
      || !('Ports' in item.NetworkSettings) || !item.NetworkSettings.Ports || typeof item.NetworkSettings.Ports !== 'object') throw new Error('MEDIA_LOCAL_CONTAINER_PROJECT_REQUIRED');
    for (const binding of Object.values(item.NetworkSettings.Ports)) {
      if (binding === null) continue;
      if (!Array.isArray(binding)) throw new Error('MEDIA_LOCAL_CONTAINER_BINDING_INVALID');
      for (const published of binding as unknown[]) {
        if (!published || typeof published !== 'object' || !('HostIp' in published) || !['127.0.0.1', '::1'].includes(String(published.HostIp))
          || !('HostPort' in published) || typeof published.HostPort !== 'string' || !/^\d+$/.test(published.HostPort)) throw new Error('MEDIA_LOCAL_CONTAINER_LOOPBACK_REQUIRED');
        const port = Number(published.HostPort); if (port < 1 || port > 65535) throw new Error('MEDIA_LOCAL_CONTAINER_BINDING_INVALID');
        if (published.HostIp === '127.0.0.1') boundPorts.add(port);
      }
    }
  }
  if (!boundPorts.has(LOCAL_PORTS.api) || !boundPorts.has(LOCAL_PORTS.db)) throw new Error('MEDIA_LOCAL_CONTAINER_API_DB_REQUIRED');
}
function inspectLocalContainers(repository: string, env: Environment): void {
  const names = spawnSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8', env, cwd: repository, timeout: 10_000 });
  if (names.status !== 0) throw new Error('MEDIA_LOCAL_CONTAINER_INSPECTION_REQUIRED');
  const owned = names.stdout.trim().split('\n').filter(name => /^supabase_[a-z0-9_-]+_gma-filmo-media-local$/.test(name));
  if (!owned.length) throw new Error('MEDIA_LOCAL_CONTAINER_INSPECTION_REQUIRED');
  const inspect = spawnSync('docker', ['inspect', ...owned], { encoding: 'utf8', env, cwd: repository, timeout: 10_000 });
  if (inspect.status !== 0) throw new Error('MEDIA_LOCAL_CONTAINER_INSPECTION_REQUIRED');
  assertContainerLoopback(JSON.parse(inspect.stdout) as unknown);
}

const FONT_URLS = {
  Manrope: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
  'Instrument Serif': 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap',
} as const;
/** Build an offline Next-font mapping only from actual, already cached font-face declarations and WOFF2 bytes. */
export async function prepareLocalFonts(repository: string): Promise<string> {
  const repo = await realpath(repository), workspace = path.join(repo, 'work/media-local'); await assertWorkspace(repo, workspace);
  const owner = await readOwner(repo); if (!owner) throw new Error('MEDIA_LOCAL_FIXTURE_OWNER_REQUIRED');
  const mapping = path.join(workspace, 'fonts/google-font-responses.cjs'), manifestPath = path.join(workspace, 'fonts/font-cache.json');
  if (await exists(manifestPath)) {
    if ((await lstat(manifestPath)).isSymbolicLink() || (await lstat(mapping)).isSymbolicLink()) throw new Error('MEDIA_LOCAL_FONT_MAPPING_MODIFIED');
    const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || !('projectId' in manifest) || manifest.projectId !== LOCAL_PROJECT_ID
      || !('fixtureId' in manifest) || manifest.fixtureId !== owner.fixtureId || !('mappingSha256' in manifest) || manifest.mappingSha256 !== hash(await readFile(mapping))
      || !('fonts' in manifest) || !Array.isArray(manifest.fonts) || !manifest.fonts.length) throw new Error('MEDIA_LOCAL_FONT_MAPPING_MODIFIED');
    for (const font of manifest.fonts as unknown[]) {
      if (!font || typeof font !== 'object' || !('file' in font) || typeof font.file !== 'string' || !/^[a-f0-9]{64}\.woff2$/.test(font.file)
        || !('sha256' in font) || typeof font.sha256 !== 'string' || font.file !== `${font.sha256}.woff2`) throw new Error('MEDIA_LOCAL_FONT_MAPPING_MODIFIED');
      const cached = path.join(workspace, 'fonts', font.file);
      if ((await lstat(cached)).isSymbolicLink() || hash(await readFile(cached)) !== font.sha256) throw new Error('MEDIA_LOCAL_FONT_MAPPING_MODIFIED');
    }
    return mapping;
  }
  if (await exists(mapping)) throw new Error('MEDIA_LOCAL_FONT_MAPPING_UNOWNED');
  const cssDirectory = path.join(repo, '.next/static/css');
  let files: string[];
  try { files = (await readdir(cssDirectory)).filter(file => /^[a-zA-Z0-9_.-]+\.css$/.test(file)); }
  catch (error: unknown) { if (isMissing(error)) throw new Error('MEDIA_LOCAL_FONT_CACHE_REQUIRED: provide cached Manrope/Instrument Serif WOFF2 files; no remote download'); throw error; }
  const families: Record<string, Set<string>> = { Manrope: new Set(), 'Instrument Serif': new Set() };
  const cachedFonts = new Map<string, Buffer>();
  for (const file of files) {
    const cssPath = await realpath(path.join(cssDirectory, file)); if (!cssPath.startsWith(`${repo}${path.sep}`)) throw new Error('MEDIA_LOCAL_FONT_CACHE_INVALID');
    const source = await readFile(cssPath, 'utf8'); if (Buffer.byteLength(source) > 4 * 1024 ** 2) throw new Error('MEDIA_LOCAL_FONT_CACHE_INVALID');
    for (const block of source.matchAll(/@font-face\s*\{[^{}]+\}/g)) {
      const family = /font-family\s*:\s*["']?(__Manrope_[a-f0-9]+|__Instrument_Serif_[a-f0-9]+)["']?\s*;/.exec(block[0]);
      if (!family) continue;
      const name = family[1]!.startsWith('__Manrope_') ? 'Manrope' : 'Instrument Serif';
      const cachedSource = /src\s*:\s*url\(["']?\/_next\/static\/media\/([a-zA-Z0-9_.-]+\.woff2)["']?\)\s*format\(["']woff2["']\)/.exec(block[0]);
      if (!cachedSource) throw new Error('MEDIA_LOCAL_FONT_CACHE_INVALID');
      const cachedPath = await realpath(path.join(repo, '.next/static/media', cachedSource[1]!));
      if (!cachedPath.startsWith(`${repo}${path.sep}`)) throw new Error('MEDIA_LOCAL_FONT_CACHE_INVALID');
      const bytes = await readFile(cachedPath); if (bytes.length < 4 || bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error('MEDIA_LOCAL_FONT_CACHE_INVALID');
      const target = path.join(workspace, 'fonts', `${hash(bytes)}.woff2`); cachedFonts.set(target, bytes);
      const declaration = block[0].replace(/font-family\s*:[^;]+;/, `font-family:'${name}';`).replace(cachedSource[0], `src:url(${target}) format('woff2')`);
      families[name]!.add(declaration);
    }
  }
  if (!families.Manrope?.size || !families['Instrument Serif']?.size) throw new Error('MEDIA_LOCAL_FONT_CACHE_REQUIRED');
  const content = '/* Generated exclusively from existing local Next font cache. */\nmodule.exports = ' + JSON.stringify({
    [FONT_URLS.Manrope]: [...families.Manrope].join('\n'), [FONT_URLS['Instrument Serif']]: [...families['Instrument Serif']].join('\n'),
  }, null, 2) + ';\n';
  await mkdir(path.join(workspace, 'fonts'), { recursive: true, mode: 0o700 });
  for (const [target, bytes] of cachedFonts) {
    if (await exists(target)) {
      if ((await lstat(target)).isSymbolicLink() || hash(await readFile(target)) !== hash(bytes)) throw new Error('MEDIA_LOCAL_FONT_CACHE_MODIFIED');
    } else await writeFile(target, bytes, { mode: 0o600, flag: 'wx' });
  }
  await writeFile(mapping, content, { mode: 0o600, flag: 'wx' });
  await writeFile(manifestPath, JSON.stringify({ projectId: LOCAL_PROJECT_ID, fixtureId: owner.fixtureId, mappingSha256: hash(content),
    fonts: [...cachedFonts].map(([target, bytes]) => ({ file: path.basename(target), sha256: hash(bytes) })) }), { mode: 0o600, flag: 'wx' });
  return mapping;
}

export async function localRuntime(repository: string, inherited: Record<string, string | undefined>): Promise<{ cli: string; env: Environment }> {
  const cli = path.join(repository, 'node_modules/.bin/supabase');
  if (!await exists(cli)) throw new Error('MEDIA_LOCAL_SUPABASE_CLI_MISSING: install the pinned CLI from an approved local cache; no npx/network fallback');
  if (inherited.DOCKER_HOST || inherited.DOCKER_CONTEXT) throw new Error('MEDIA_LOCAL_DOCKER_CONTEXT_FORBIDDEN');
  const baseEnv = isolatedEnvironment(inherited, {});
  const selected = spawnSync('docker', ['context', 'show'], { encoding: 'utf8', env: baseEnv, cwd: repository, timeout: 10_000 });
  if (selected.status !== 0) throw new Error('MEDIA_LOCAL_DOCKER_SOCKET_REQUIRED');
  const contextName = selected.stdout.trim();
  const context = spawnSync('docker', ['context', 'inspect', contextName, '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8', env: baseEnv, cwd: repository, timeout: 10_000 });
  if (context.status !== 0) throw new Error('MEDIA_LOCAL_DOCKER_SOCKET_REQUIRED');
  assertLocalDockerEndpoint(contextName, context.stdout.trim());
  const env = isolatedEnvironment(inherited, { DOCKER_CONTEXT: contextName });
  const docker = spawnSync('docker', ['info', '--format', '{{json .}}'], { encoding: 'utf8', env, cwd: repository, timeout: 10_000 });
  if (docker.status !== 0) throw new Error('MEDIA_LOCAL_DOCKER_RUNTIME_MISSING: install/start a compatible local runtime');
  const manifest: unknown = JSON.parse(await readFile(path.join(repository, 'infrastructure/media-local/runtime-images.json'), 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !('cliVersion' in manifest) || typeof manifest.cliVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.cliVersion)
    || !('images' in manifest) || !Array.isArray(manifest.images) || !manifest.images.length || !manifest.images.every(image => typeof image === 'string' && /^[a-zA-Z0-9./_-]+:[a-zA-Z0-9._-]+$/.test(image))) {
    throw new Error('MEDIA_LOCAL_CACHED_IMAGE_MANIFEST_REQUIRED');
  }
  const dependency: unknown = JSON.parse(await readFile(path.join(repository, 'package.json'), 'utf8'));
  const installed: unknown = JSON.parse(await readFile(path.join(repository, 'node_modules/supabase/package.json'), 'utf8'));
  if (!dependency || typeof dependency !== 'object' || !('devDependencies' in dependency) || !dependency.devDependencies || typeof dependency.devDependencies !== 'object'
    || !('supabase' in dependency.devDependencies) || dependency.devDependencies.supabase !== manifest.cliVersion
    || !installed || typeof installed !== 'object' || !('version' in installed) || installed.version !== manifest.cliVersion) throw new Error('MEDIA_LOCAL_CLI_EXACT_PIN_REQUIRED');
  for (const image of manifest.images as string[]) {
    if (spawnSync('docker', ['image', 'inspect', image], { env, stdio: 'ignore', timeout: 10_000 }).status !== 0) {
      throw new Error('MEDIA_LOCAL_DOCKER_IMAGES_MISSING: populate every pinned image offline before start');
    }
  }
  return { cli, env };
}

function cliRun(cli: string, args: string[], repository: string, env: Environment): string {
  const result = spawnSync(cli, args, { encoding: 'utf8', cwd: repository, env, timeout: 120_000, maxBuffer: 1024 * 1024 });
  // CLI output may contain credentials. Never forward stdout/stderr to the terminal or errors.
  if (result.error || result.status !== 0) throw new Error(`MEDIA_LOCAL_CLI_FAILED:${args[0]}`);
  return result.stdout;
}
export function statusEnvironment(status: string, repository: string, credentials: LocalCredentials): Environment {
  const parsed: unknown = JSON.parse(status);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('MEDIA_LOCAL_STATUS_INVALID');
  const values = parsed as Record<string, unknown>;
  for (const key of ['API_URL', 'DB_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) if (typeof values[key] !== 'string' || !values[key]) throw new Error('MEDIA_LOCAL_STATUS_INVALID');
  assertLocalUrl(values.API_URL as string, LOCAL_PORTS.api, ['http:']);
  const db = assertLocalUrl(values.DB_URL as string, LOCAL_PORTS.db, ['postgresql:', 'postgres:']);
  if (db.pathname !== '/postgres') throw new Error('MEDIA_LOCAL_DATABASE_REQUIRED');
  return { NODE_ENV: 'development', UPLOAD_ENVIRONMENT: 'local', UPLOAD_ISOLATION_ACK: 'true', UPLOAD_ENGINE_V2: 'true', NEXT_PUBLIC_UPLOAD_ENGINE_V2: 'true',
    MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_AUXILIARY_PROVIDER: 'mock', MEDIA_MOCK_ENABLED: 'true', MEDIA_P2P_ENABLED: 'false',
    PEERTUBE_PROVIDER_ENABLED: 'false', STREAM_PROVIDER_ENABLED: 'false', VIDEO_PROCESSING_ENABLED: 'false', LEGACY_MEDIA_WRITES_ENABLED: 'false',
    SUPABASE_URL: values.API_URL as string, NEXT_PUBLIC_SUPABASE_URL: values.API_URL as string, SUPABASE_DB_URL: values.DB_URL as string,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY as string, NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY as string,
    MEDIA_GATEWAY_URL: 'http://127.0.0.1:4319', MEDIA_MOCK_STORAGE_DIR: path.join(repository, 'work/media-local/storage'),
    MEDIA_CAPABILITY_KEY_ID: 'local-1', MEDIA_CAPABILITY_PUBLIC_KEY_FILE: path.join(repository, 'work/media-local/keys/public.pem'),
    MEDIA_CAPABILITY_PRIVATE_KEY_FILE: path.join(repository, 'work/media-local/keys/private.pem'), NEXT_PUBLIC_R2_PUBLIC_URL: '',
    MEDIA_LOCAL_PROJECT_ID: LOCAL_PROJECT_ID, MEDIA_LOCAL_ISOLATED: 'true', MEDIA_LOCAL_TEST_PASSWORD: credentials.password, UPLOAD_EXECUTOR_SECRET: credentials.executorSecret };
}
async function dotenvKeys(repository: string): Promise<string[]> {
  const keys = new Set<string>();
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.media.local']) {
    try { for (const match of (await readFile(path.join(repository, name), 'utf8')).matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)) keys.add(match[1]!); }
    catch (error: unknown) { if (!isMissing(error)) throw error; }
  }
  return [...keys];
}
async function health(url: string): Promise<boolean> {
  try { const result = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1500) }); return result.ok; } catch { return false; }
}
async function waitHealth(url: string, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error('MEDIA_LOCAL_CHILD_EXITED');
    if (await health(url)) return;
    await new Promise<void>(resolve => setTimeout(resolve, 200));
  }
  throw new Error('MEDIA_LOCAL_HEALTH_TIMEOUT');
}
async function readState(workspace: string): Promise<State | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(workspace, 'process-state.json'), 'utf8'));
    if (!value || typeof value !== 'object' || !('projectId' in value) || value.projectId !== LOCAL_PROJECT_ID
      || !('pid' in value) || !Number.isSafeInteger(value.pid) || Number(value.pid) < 2 || Number(value.pid) > 2_147_483_647
      || !('ready' in value) || typeof value.ready !== 'boolean' || !('token' in value) || typeof value.token !== 'string'
      || !/^[a-f0-9-]{36}$/.test(value.token)) throw new Error('MEDIA_LOCAL_STATE_INVALID');
    if ((await lstat(path.join(workspace, 'process-state.json'))).isSymbolicLink()) throw new Error('MEDIA_LOCAL_STATE_INVALID');
    return value as State;
  } catch (error: unknown) { if (isMissing(error)) return null; throw error; }
}
function ownsSupervisor(state: State, script: string): boolean {
  const result = spawnSync('ps', ['-p', String(state.pid), '-o', 'args='], { encoding: 'utf8', timeout: 2000 });
  return result.status === 0 && result.stdout.includes(script) && result.stdout.includes(`supervise ${state.token}`);
}
async function stopOwned(repository: string, script: string): Promise<void> {
  const workspace = path.join(repository, 'work/media-local'); await assertWorkspace(repository, workspace);
  if (!await readOwner(repository)) throw new Error('MEDIA_LOCAL_FIXTURE_OWNER_REQUIRED');
  await assertManagedEnvironment(repository);
  const config = await readFile(path.join(workspace, 'supabase/config.toml'), 'utf8'); assertLocalProject(config);
  const state = await readState(workspace);
  if (state && ownsSupervisor(state, script)) {
    process.kill(state.pid, 'SIGTERM');
    const deadline = Date.now() + 20_000;
    while (ownsSupervisor(state, script) && Date.now() < deadline) await new Promise<void>(resolve => setTimeout(resolve, 100));
    if (ownsSupervisor(state, script)) throw new Error('MEDIA_LOCAL_STOP_TIMEOUT');
  } else if (state) {
    // Recover only an absent PID. A reused/live PID stays fail-closed; Supabase
    // receives this fixture's exact workdir and can stop only its own project.
    try { process.kill(state.pid, 0); }
    catch (error: unknown) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ESRCH') {
        throw new Error('MEDIA_LOCAL_SUPERVISOR_UNVERIFIABLE: preserve the fixture and inspect the supervisor');
      }
      const runtime = await localRuntime(repository, process.env);
      cliRun(runtime.cli, ['stop', '--workdir', workspace], repository, runtime.env);
      const current = await readState(workspace);
      if (current?.token !== state.token) throw new Error('MEDIA_LOCAL_STATE_CHANGED');
      await rm(path.join(workspace, 'process-state.json'));
      return;
    }
    throw new Error('MEDIA_LOCAL_SUPERVISOR_UNVERIFIABLE: a process owns this PID; preserve the fixture');
  } else {
    const runtime = await localRuntime(repository, process.env);
    cliRun(runtime.cli, ['stop', '--workdir', workspace], repository, runtime.env);
  }
}
async function supervise(repository: string, script: string, token: string): Promise<void> {
  const workspace = path.join(repository, 'work/media-local'), runtime = await localRuntime(repository, process.env);
  const fontMapping = await prepareLocalFonts(repository);
  assertLocalProject(await readFile(path.join(workspace, 'supabase/config.toml'), 'utf8'));
  const children: ChildProcess[] = []; let stackStarted = false, closing = false;
  const state: State = { projectId: LOCAL_PROJECT_ID, token, pid: process.pid, ready: false, startedAt: new Date().toISOString() };
  const stateFile = path.join(workspace, 'process-state.json');
  await writeFile(stateFile, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
  const shutdown = async () => {
    if (closing) return; closing = true;
    for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.all(children.map(child => child.exitCode === null ? new Promise<void>(resolve => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    }) : Promise.resolve()));
    if (stackStarted) cliRun(runtime.cli, ['stop', '--workdir', workspace], repository, runtime.env);
    const current = await readState(workspace); if (current?.token === token) await rm(stateFile, { force: true });
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void shutdown().then(() => process.exit(0), () => process.exit(1)); });
  try {
    await assertPortsFree();
    // A failed CLI start can still leave this project's partial containers; stop them in finally.
    stackStarted = true; cliRun(runtime.cli, ['start', '--workdir', workspace], repository, runtime.env);
    inspectLocalContainers(repository, runtime.env);
    const local = statusEnvironment(cliRun(runtime.cli, ['status', '--output', 'json', '--workdir', workspace], repository, runtime.env), repository, await localCredentials(repository));
    local.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = fontMapping;
    local.MEDIA_CAPABILITY_PRIVATE_KEY = await readFile(local.MEDIA_CAPABILITY_PRIVATE_KEY_FILE!, 'utf8');
    local.MEDIA_CAPABILITY_PUBLIC_KEY = await readFile(local.MEDIA_CAPABILITY_PUBLIC_KEY_FILE!, 'utf8');
    const env = isolatedEnvironment(process.env, local, await dotenvKeys(repository));
    await writeLocalEnvironment(repository, local);
    await waitHealth(`${local.SUPABASE_URL}/auth/v1/health`);
    const tsx = path.join(repository, 'node_modules/tsx/dist/cli.mjs');
    // Seed only through real local Auth. It must independently validate local project+URLs.
    const seed = spawnSync(process.execPath, [tsx, path.join(repository, 'scripts/media/local-seed.ts')], { cwd: repository, env, encoding: 'utf8', timeout: 60_000 });
    if (seed.status !== 0) {
      const code = seed.stderr?.trim();
      throw new Error(code && /^MEDIA_LOCAL_[A-Z_0-9]+$/.test(code) ? code : 'MEDIA_LOCAL_SEED_FAILED');
    }
    const launch = (args: string[]) => {
      const child = spawn(process.execPath, args, { cwd: repository, env, stdio: 'ignore' }); children.push(child);
      child.once('error', () => { void shutdown().then(() => process.exit(1)); });
      child.once('exit', () => { if (!closing) void shutdown().then(() => process.exit(1)); });
      return child;
    };
    const gateway = launch([tsx, path.join(repository, 'scripts/media/gateway.ts')]); await waitHealth(`${local.MEDIA_GATEWAY_URL}/health`, gateway);
    launch([tsx, path.join(repository, 'scripts/media/executor.ts')]);
    const web = launch([path.join(repository, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(LOCAL_PORTS.web)]);
    await waitHealth(`http://127.0.0.1:${LOCAL_PORTS.web}`, web);
    state.ready = true; await writeFile(stateFile, JSON.stringify(state), { mode: 0o600 });
    await new Promise<void>(() => { /* Remain the owner of child handles until stop signals this supervisor. */ });
  } catch (error: unknown) { await shutdown(); throw error; }
  void script;
}

export async function runLocalAction(repository: string, script: string, action: string): Promise<void> {
  const repo = await realpath(repository), workspace = path.join(repo, 'work/media-local');
  await assertWorkspace(repo, workspace);
  if (action === 'prepare') { await prepareLocal(repo); return; }
  if (action === 'stop') { await stopOwned(repo, script); return; }
  if (action === 'reset') {
    await assertManagedEnvironment(repo);
    await stopOwned(repo, script); const runtime = await localRuntime(repo, process.env);
    // No db reset/--linked exists anywhere. CLI stop --no-backup deletes this project only.
    cliRun(runtime.cli, ['stop', '--no-backup', '--workdir', workspace], repo, runtime.env);
    await rm(path.join(workspace, 'storage'), { recursive: true, force: true });
    await rm(path.join(repo, '.env.media.local'), { force: true });
    await prepareLocal(repo); return;
  }
  if (action !== 'start') throw new Error('MEDIA_LOCAL_ACTION_INVALID');
  await prepareLocal(repo); await prepareLocalFonts(repo);
  await localRuntime(repo, process.env);
  const previous = await readState(workspace);
  if (previous) {
    if (ownsSupervisor(previous, script)) {
      if (previous.ready) return;
      throw new Error('MEDIA_LOCAL_ALREADY_STARTING');
    }
    // `stopOwned` recovers only a confirmed ESRCH PID through this fixture's
    // exact --workdir; a reused/live unrelated PID remains protected.
    await stopOwned(repo, script);
  }
  const token = randomUUID(), tsx = path.join(repo, 'node_modules/tsx/dist/cli.mjs');
  const child = spawn(process.execPath, [tsx, script, 'supervise', token], { cwd: repo, env: isolatedEnvironment(process.env, {}), detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let startupError = 'MEDIA_LOCAL_START_FAILED';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (value: string) => {
    const code = value.trim();
    if (code.length <= 128 && /^MEDIA_LOCAL_[A-Z_0-9]+$/.test(code)) startupError = code;
  });
  child.unref();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const state = await readState(workspace);
    if (state?.token === token && state.ready) { child.stderr?.destroy(); return; }
    if (child.exitCode !== null) { child.stderr?.destroy(); throw new Error(startupError); }
    await new Promise<void>(resolve => setTimeout(resolve, 200));
  }
  throw new Error('MEDIA_LOCAL_START_TIMEOUT');
}
async function main(): Promise<void> {
  const script = fileURLToPath(import.meta.url);
  const repository = path.resolve(path.dirname(script), '../..');
  const action = process.argv[2] ?? '';
  if (action === 'supervise') {
    const token = process.argv[3]; if (!token || !/^[a-f0-9-]{36}$/.test(token)) throw new Error('MEDIA_LOCAL_OWNER_TOKEN_REQUIRED');
    await supervise(repository, script, token); return;
  }
  await runLocalAction(repository, script, action);
  console.log(`MEDIA_LOCAL_${action.toUpperCase()}_OK`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'MEDIA_LOCAL_FAILED'); process.exitCode = 1;
});
