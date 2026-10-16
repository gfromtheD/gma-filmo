import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { Pool } from 'pg';

const repository = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const scratch = path.join(repository, 'work/media-phase2');
const bin = process.env.PG_BIN_DIR;
if (!bin || !path.isAbsolute(bin)) throw new Error('PG_BIN_DIR must point to local PostgreSQL binaries');
mkdirSync(scratch, { recursive: true });
if (!realpathSync(scratch).startsWith(`${repository}${path.sep}`)) throw new Error('PostgreSQL scratch must stay inside the repository');
const data = mkdtempSync(path.join(scratch, 'postgres-'));
if (!realpathSync(data).startsWith(`${realpathSync(scratch)}${path.sep}`)) throw new Error('Unsafe temporary PostgreSQL directory');

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: repository, env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} exited with ${result.status}`);
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to allocate loopback PostgreSQL port');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function main(): Promise<void> {
  let started = false;
  try {
    const port = await availablePort();
    run(path.join(bin!, 'initdb'), ['-D', data, '-U', 'gma_media_test', '--auth=trust', '--no-locale', '-E', 'UTF8']);
    run(path.join(bin!, 'pg_ctl'), ['-D', data, '-l', path.join(data, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${data} -c max_connections=32`, '-w', 'start']);
    started = true;
    const bootstrap = new Pool({ connectionString: `postgresql://gma_media_test@127.0.0.1:${port}/postgres`, max: 1 });
    try {
      await bootstrap.query('CREATE DATABASE gma_media_phase2_test');
      await bootstrap.query('CREATE DATABASE gma_media_gateway_test');
    } finally { await bootstrap.end(); }
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/media/database-concurrency.test.ts'], {
      stdio: 'inherit', cwd: repository,
      env: { ...process.env, MEDIA_TEST_DATABASE_ISOLATED: 'true', MEDIA_TEST_DATABASE_URL: `postgresql://gma_media_test@127.0.0.1:${port}/gma_media_phase2_test` },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = 1; return; }
    const gateway = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/media/gateway-process.test.ts'], {
      stdio: 'inherit', cwd: repository,
      env: { ...process.env, MEDIA_TEST_DATABASE_ISOLATED: 'true', MEDIA_TEST_DATABASE_URL: `postgresql://gma_media_test@127.0.0.1:${port}/gma_media_gateway_test` },
    });
    if (gateway.error) throw gateway.error;
    if (gateway.status !== 0) process.exitCode = 1;
  } finally {
    if (started) run(path.join(bin!, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
    rmSync(data, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Local PostgreSQL test runner failed');
  process.exitCode = 1;
});
