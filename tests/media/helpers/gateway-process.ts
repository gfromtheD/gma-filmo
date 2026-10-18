import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { Pool, types } from 'pg';
import { createMediaGateway } from '../../../lib/media/gateway/server';
import { createGatewayDelivery } from '../../../lib/media/gateway/delivery';
import { MockMediaStorage } from '../../../lib/media/mock-storage';
import { serviceRepository } from '../service-fixture';

async function main(): Promise<void> {
  const value = process.env.MEDIA_TEST_DATABASE_URL;
  if (!value || process.env.MEDIA_TEST_DATABASE_ISOLATED !== 'true'
    || process.env.MEDIA_GATEWAY_PROCESS_TEST !== 'true') throw new Error('MEDIA_GATEWAY_PROCESS_ISOLATION_REQUIRED');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1'
    || url.pathname !== '/gma_media_gateway_test') throw new Error('MEDIA_GATEWAY_PROCESS_LOCAL_ONLY');
  const repository = await realpath(process.cwd());
  const scratch = await realpath(path.join(repository, 'work/media-phase5'));
  const workspace = await realpath(process.env.MEDIA_GATEWAY_PROCESS_WORKSPACE ?? '');
  if (!workspace.startsWith(`${scratch}${path.sep}`) || !path.basename(workspace).startsWith('gateway-process-')) {
    throw new Error('MEDIA_GATEWAY_PROCESS_WORKSPACE_INVALID');
  }
  const publicKey = await readFile(path.join(workspace, 'public.pem'), 'utf8');
  // Supabase JSON uses numbers; native pg defaults int8 to text. Reject unsafe values.
  types.setTypeParser(20, value => { const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error('MEDIA_TEST_INTEGER_UNSAFE'); return parsed; });
  const pool = new Pool({ connectionString: value, max: 4 });
  const repositoryDriver = serviceRepository(pool);
  if (process.env.MEDIA_GATEWAY_PROCESS_CRASH_AFTER_COMMIT === 'true') {
    const commit = repositoryDriver.commitChunk.bind(repositoryDriver);
    repositoryDriver.commitChunk = async (owner, input) => {
      const result = await commit(owner, input);
      process.send?.({ type: 'chunk-committed', pid: process.pid, sessionId: input.sessionId,
        startByte: input.startByte, endByte: input.endByte, fence: input.fence });
      // Test-only fault injection: SQL committed but canonical file promotion has not run.
      await new Promise<void>(() => undefined);
      return result;
    };
  }
  const dependencies = { repository: repositoryDriver, storage: new MockMediaStorage(path.join(workspace, 'storage')),
    publicKeys: { process: publicKey }, origins: ['http://127.0.0.1:4318'] };
  const server = createMediaGateway(dependencies, createGatewayDelivery(dependencies, path.join(repository, 'tests/media/fixtures/hls')));
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;
  server.maxHeadersCount = 40;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') throw new Error('MEDIA_GATEWAY_PROCESS_BIND_INVALID');
  if (!process.send) throw new Error('MEDIA_GATEWAY_PROCESS_IPC_REQUIRED');
  process.send({ type: 'ready', pid: process.pid, port: address.port });
  let stopping = false;
  async function stop(): Promise<void> {
    if (stopping) return;
    stopping = true;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    process.exit(0);
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void stop(); });
  process.once('disconnect', () => { void stop(); });
}

void main().catch(() => { console.error('MEDIA_GATEWAY_PROCESS_START_FAILED'); process.exitCode = 1; });
