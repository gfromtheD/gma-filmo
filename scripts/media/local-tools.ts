/** Tools fail closed to the owned LOCAL fixture. Never accept a remote connection argument. */
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Pool } from 'pg';
const LOCAL_PROJECT_ID = 'gma-filmo-media-local';

export async function localEnvironment(): Promise<Record<string, string>> {
  const repository = await realpath(process.cwd());
  const source = await readFile('.env.media.local', 'utf8');
  for (const name of ['work','work/media-local','work/media-local/storage','work/media-local/keys','work/media-local/supabase','work/media-local/fixture-owner.json','.env.media.local']) {
    if ((await lstat(path.join(repository,name))).isSymbolicLink()) throw new Error('MEDIA_LOCAL_SYMLINK_FORBIDDEN');
  }
  if (((await lstat('.env.media.local')).mode & 0o777)!==0o600) throw new Error('MEDIA_LOCAL_ENV_PRIVATE_REQUIRED');
  const owner: unknown = JSON.parse(await readFile('work/media-local/fixture-owner.json','utf8'));
  if(!owner||typeof owner!=='object'||!('repository'in owner)||owner.repository!==repository||!('projectId'in owner)||owner.projectId!==LOCAL_PROJECT_ID
    ||!('envSha256'in owner)||owner.envSha256!==createHash('sha256').update(source).digest('hex')) throw new Error('MEDIA_LOCAL_ENV_UNOWNED');
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    const value: unknown = JSON.parse(line.slice(at + 1));
    if (at < 1 || typeof value !== 'string') throw new Error('MEDIA_LOCAL_ENV_INVALID');
    values[line.slice(0, at)] = value;
  }
  const db = new URL(values.SUPABASE_DB_URL ?? '');
  if (db.hostname !== '127.0.0.1' || db.port !== '54342' || db.pathname !== '/postgres'
    || !['postgres:', 'postgresql:'].includes(db.protocol) || values.MEDIA_LOCAL_PROJECT_ID !== LOCAL_PROJECT_ID
    || values.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54341' || values.MEDIA_LOCAL_ISOLATED!=='true'
    || values.UPLOAD_ISOLATION_ACK!=='true' || values.MEDIA_P2P_ENABLED!=='false' || values.LEGACY_MEDIA_WRITES_ENABLED!=='false'
    || values.SUPABASE_URL !== 'http://127.0.0.1:54341' || values.MEDIA_GATEWAY_URL !== 'http://127.0.0.1:4319'
    || values.PEERTUBE_PROVIDER_ENABLED !== 'false' || values.STREAM_PROVIDER_ENABLED!=='false'
    || values.UPLOAD_ENVIRONMENT!=='local' || values.UPLOAD_ENGINE_V2!=='true' || values.MEDIA_MOCK_ENABLED!=='true'
    || values.MEDIA_VIDEO_PROVIDER!=='mock' || values.MEDIA_AUXILIARY_PROVIDER!=='mock') throw new Error('MEDIA_LOCAL_ONLY');
  return values;
}
export function localDatabase(environment: Record<string, string>): Pool {
  return new Pool({ connectionString: environment.SUPABASE_DB_URL, max: 1, connectionTimeoutMillis: 5000 });
}
export async function localLogin(environment: Record<string, string>, email = 'gma.creator-a@example.invalid'): Promise<string> {
  const response = await fetch('http://127.0.0.1:54341/auth/v1/token?grant_type=password', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { apikey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: environment.MEDIA_LOCAL_TEST_PASSWORD }),
  });
  if (!response.ok) throw new Error(`MEDIA_LOCAL_AUTH_${response.status}`);
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !('access_token' in value) || typeof value.access_token !== 'string') throw new Error('MEDIA_LOCAL_AUTH_INVALID');
  return value.access_token;
}
