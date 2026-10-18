import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LOCAL_MIGRATION_SOURCES, prepareLocal } from '../../scripts/media/local-stack';
import { preflightMediaLocal } from '../../scripts/media/preflight';

test('local Mock preflight validates isolated endpoints and signing keys without provider credentials', async () => {
  const root = await mkdtemp(path.resolve('work/media-phase5/preflight-local-'));
  try {
    await mkdir(path.join(root, 'infrastructure/media-local'), { recursive: true });
    await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
    await writeFile(path.join(root, 'infrastructure/media-local/config.toml'), 'project_id = "gma-filmo-media-local"\n');
    await writeFile(path.join(root, 'infrastructure/media-local/baseline.sql'), '-- fixture schema\n');
    for (const source of LOCAL_MIGRATION_SOURCES) await writeFile(path.join(root, 'supabase/migrations', source), `-- fixture ${source}\n`);
    await prepareLocal(root);
    const environment = {
      UPLOAD_ENVIRONMENT: 'local', UPLOAD_ISOLATION_ACK: 'true', MEDIA_LOCAL_PROJECT_ID: 'gma-filmo-media-local', MEDIA_LOCAL_ISOLATED: 'true',
      MEDIA_VIDEO_PROVIDER: 'mock', MEDIA_AUXILIARY_PROVIDER: 'mock', MEDIA_MOCK_ENABLED: 'true', PEERTUBE_PROVIDER_ENABLED: 'false',
      STREAM_PROVIDER_ENABLED: 'false', MEDIA_P2P_ENABLED: 'false', NEXT_PUBLIC_R2_PUBLIC_URL: '',
      SUPABASE_URL: 'http://127.0.0.1:54341', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54341',
      SUPABASE_DB_URL: 'postgresql://postgres:fixture@127.0.0.1:54342/postgres', MEDIA_GATEWAY_URL: 'http://127.0.0.1:4319',
      MEDIA_MOCK_STORAGE_DIR: path.join(root, 'work/media-local/storage'), SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key', MEDIA_LOCAL_TEST_PASSWORD: 'local-test-password', UPLOAD_EXECUTOR_SECRET: 'local-executor-secret',
      MEDIA_CAPABILITY_KEY_ID: 'local-1',
    };
    await preflightMediaLocal(environment, root, false);
    await assert.rejects(preflightMediaLocal({ ...environment, SUPABASE_URL: 'https://production.example' }, root, false), /MEDIA_LOCAL_URL_REQUIRED/);
    await assert.rejects(preflightMediaLocal({ ...environment, PEERTUBE_PROVIDER_ENABLED: 'true' }, root, false), /MEDIA_LOCAL_MOCK_REQUIRED/);
    await assert.rejects(preflightMediaLocal({ ...environment, NEXT_PUBLIC_R2_PUBLIC_URL: 'https://r2.example' }, root, false), /MEDIA_LOCAL_EXTERNAL_PROVIDER_DISABLED_REQUIRED/);
    await assert.match(await readFile(path.join(root, 'work/media-local/keys/public.pem'), 'utf8'), /PUBLIC KEY/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
