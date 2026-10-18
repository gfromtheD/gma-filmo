import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MediaRepository, type MediaRepositoryClient } from '../../lib/media/repository';

function fakeClient(reply: unknown): { client: MediaRepositoryClient; calls: Array<{ name: string; args: Record<string, unknown> }> } {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: MediaRepositoryClient = {
    async rpc(name, args) { calls.push({ name, args }); return { data: reply, error: null }; },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: {
                    session_id: '22222222-2222-4222-8222-222222222222', asset_id: '11111111-1111-4111-8111-111111111111',
                    provider: 'mock', upload_id: 'upload-local', private_state: { receipt: { size: 10 } }, updated_at: '2026-10-07T10:00:00.000Z',
                  }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test('empty PostgREST composite claims are idle while malformed nonempty jobs fail closed', async () => {
  for (const reply of [null, [], { id: null, kind: null, payload: null, state: null }, [{ id: null, kind: null, payload: null, state: null }]]) {
    const repo = new MediaRepository(fakeClient(reply).client);
    assert.equal(await repo.claimJob('worker', true), null);
    assert.equal(await repo.claimSession(null, null, 'worker'), null);
  }
  for (const reply of [{}, { id: null, kind: 'process' }]) {
    const repo = new MediaRepository(fakeClient(reply).client);
    await assert.rejects(repo.claimJob('worker', true));
    await assert.rejects(repo.claimSession(null, null, 'worker'));
  }
});

test('typed facade preserves JSON batch arrays and maps exact SQL RPC parameter names', async () => {
  const batch = [{ id: 'one' }, { id: 'two' }];
  const { client, calls } = fakeClient(batch);
  const repository = new MediaRepository(client);
  assert.deepEqual(await repository.command('owner', 'ready', { session_id: 's' }), batch);
  await repository.commitChunk('owner', {
    sessionId: 'session', generation: 1, writer: 'worker', fence: 2, startByte: 0, endByte: 9,
    sha256: 'a'.repeat(64), storageRelative: 'transfer/session/1/chunks/0-9-' + 'a'.repeat(64) + '.bin', upstreamConfirmed: true,
  });
  assert.equal(calls[0]?.name, 'gma_media_command');
  assert.equal(calls[1]?.name, 'gma_media_transfer_commit');
  assert.equal(calls[1]?.args.p_start_byte, 0);
  assert.equal(calls[1]?.args.p_end_byte, 9);
  assert.equal(calls[1]?.args.p_start, undefined);
});

test('private state is read from its private table and returns no row wrapper', async () => {
  const { client } = fakeClient(null);
  const state = await new MediaRepository(client).privateState('22222222-2222-4222-8222-222222222222');
  assert.deepEqual(state, { receipt: { size: 10 } });
});

test('playback authorization validates the SQL summary shape instead of assuming a nested result', async () => {
  const summary = {
    id: '11111111-1111-4111-8111-111111111111', owner_id: '44444444-4444-4444-8444-444444444444',
    provider: 'mock', role: 'main', state: 'ready', duration_seconds: 120, expected_input_bytes: 10,
    received_bytes: 10, delivery_path: null, verified_at: '2026-10-07T10:00:00.000Z', metadata: { width: 1280 },
  };
  const { client, calls } = fakeClient(summary);
  assert.deepEqual(await new MediaRepository(client).authorizePlayback(summary.id, null, 'fixture-title'), summary);
  assert.equal(calls[0]?.args.p_title_slug, 'fixture-title');
  assert.equal(calls[0]?.args.p_title_id, undefined);
});
