import { createPrivateKey, createPublicKey } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMediaConfig } from '../../lib/media/config';
import { assertLocalProject, assertLocalUrl, assertManagedEnvironment, assertWorkspace, LOCAL_PORTS, LOCAL_PROJECT_ID, localRuntime } from './local-stack';

function parseManagedEnvironment(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error('MEDIA_LOCAL_ENV_INVALID');
    const name = line.slice(0, separator), serialized = line.slice(separator + 1);
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || name in result) throw new Error('MEDIA_LOCAL_ENV_INVALID');
    let value: unknown;
    try { value = JSON.parse(serialized) as unknown; } catch { throw new Error('MEDIA_LOCAL_ENV_INVALID'); }
    if (typeof value !== 'string') throw new Error('MEDIA_LOCAL_ENV_INVALID');
    result[name] = value;
  }
  return result;
}

export async function preflightMediaLocal(environment: Record<string, string | undefined>, repository: string, requireRuntime = true): Promise<void> {
  const repo = await realpath(repository), workspace = path.join(repo, 'work/media-local');
  await assertWorkspace(repo, workspace);
  if (environment.MEDIA_LOCAL_PROJECT_ID !== LOCAL_PROJECT_ID || environment.MEDIA_LOCAL_ISOLATED !== 'true') throw new Error('MEDIA_LOCAL_ISOLATION_REQUIRED');
  assertLocalUrl(environment.SUPABASE_URL ?? '', LOCAL_PORTS.api, ['http:']);
  assertLocalUrl(environment.NEXT_PUBLIC_SUPABASE_URL ?? '', LOCAL_PORTS.api, ['http:']);
  const database = assertLocalUrl(environment.SUPABASE_DB_URL ?? '', LOCAL_PORTS.db, ['postgresql:', 'postgres:']);
  if (database.pathname !== '/postgres') throw new Error('MEDIA_LOCAL_DATABASE_REQUIRED');
  assertLocalUrl(environment.MEDIA_GATEWAY_URL ?? '', LOCAL_PORTS.gateway, ['http:']);
  const config = getMediaConfig(environment);
  if (config.environment !== 'local' || config.defaultVideoProvider !== 'mock' || config.auxiliaryProvider !== 'mock' || !config.mockEnabled || config.peerTubeEnabled) throw new Error('MEDIA_LOCAL_MOCK_REQUIRED');
  if (environment.PEERTUBE_PROVIDER_ENABLED !== 'false' || environment.STREAM_PROVIDER_ENABLED !== 'false' || environment.MEDIA_P2P_ENABLED !== 'false'
    || environment.NEXT_PUBLIC_R2_PUBLIC_URL !== '') throw new Error('MEDIA_LOCAL_EXTERNAL_PROVIDER_DISABLED_REQUIRED');
  if (path.resolve(environment.MEDIA_MOCK_STORAGE_DIR ?? '') !== path.join(workspace, 'storage')) throw new Error('MEDIA_LOCAL_STORAGE_REQUIRED');
  assertLocalProject(await readFile(path.join(workspace, 'supabase/config.toml'), 'utf8'));
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'MEDIA_LOCAL_TEST_PASSWORD', 'UPLOAD_EXECUTOR_SECRET', 'MEDIA_CAPABILITY_KEY_ID']) {
    if (!environment[key]) throw new Error(`MEDIA_LOCAL_KEY_REQUIRED:${key}`);
  }
  const privatePath = path.join(workspace, 'keys/private.pem'), publicPath = path.join(workspace, 'keys/public.pem');
  const privateStat = await lstat(privatePath), publicStat = await lstat(publicPath);
  if ((privateStat.mode & 0o777) !== 0o600 || privateStat.isSymbolicLink() || publicStat.isSymbolicLink()) throw new Error('MEDIA_LOCAL_PRIVATE_KEY_PERMISSIONS');
  const privateKey = createPrivateKey(environment.MEDIA_CAPABILITY_PRIVATE_KEY ?? await readFile(privatePath, 'utf8'));
  const publicKey = createPublicKey(environment.MEDIA_CAPABILITY_PUBLIC_KEY ?? await readFile(publicPath, 'utf8'));
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519'
    || !createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).equals(publicKey.export({ type: 'spki', format: 'der' }))) throw new Error('MEDIA_LOCAL_SIGNING_KEYS_INVALID');
  if (requireRuntime) await localRuntime(repo, process.env);
}

async function main(): Promise<void> {
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  await assertManagedEnvironment(repository);
  const source = await readFile(path.join(repository, '.env.media.local'), 'utf8');
  const environment = parseManagedEnvironment(source);
  await preflightMediaLocal(environment, repository);
  console.log('MEDIA_LOCAL_PREFLIGHT_OK');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch((error: unknown) => {
  console.error(error instanceof Error && /^MEDIA_LOCAL_[A-Z_0-9: -]+$/.test(error.message) ? error.message : 'MEDIA_LOCAL_PREFLIGHT_FAILED'); process.exitCode = 1;
});
