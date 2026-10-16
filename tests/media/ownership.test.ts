import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { database, OWNER, OTHER, uploadCommand } from './database';
import type { UploadDraft, UploadSession } from '../../lib/uploads/types';

type TestDatabase = Awaited<ReturnType<typeof database>>;
interface WriterClaim { fence: number; leaseUntil: string; offset: number }
interface ChunkResult { offset: number; upstreamOffset: number }
const SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);

async function uploading(db: TestDatabase, bytes = 100, owner = OWNER): Promise<UploadSession> {
  await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
  const draft = await uploadCommand<UploadDraft>(db, 'create_draft', { purpose: 'title' }, owner);
  const session = await uploadCommand<UploadSession>(db, 'reserve', {
    draft_id: draft.id, revision: 0, role: 'main', bytes, sha256: SHA,
    file_name: 'local-test.mp4', content_type: 'video/mp4',
    idempotency_key: randomUUID(), request_hash: SHA,
  }, owner);
  return uploadCommand<UploadSession>(db, 'bind', {
    session_id: session.id, provider_ref: session.object_key,
    provider_data: { multipartUploadId: 'local-fixture-upload' },
  }, owner);
}

async function claim(db: TestDatabase, session: UploadSession, writer = 'writer-a', owner = OWNER, generation = session.transfer_generation): Promise<WriterClaim> {
  const result = await db.query<{ result: WriterClaim }>(
    'SELECT gma_media_transfer_claim($1,$2,$3,$4) result', [owner, session.id, generation, writer],
  );
  return result.rows[0]!.result;
}

function chunkPath(session: UploadSession, start: number, end: number, sha = SHA): string {
  return `transfer/${session.id}/${session.transfer_generation}/chunks/${start}-${end}-${sha}.bin`;
}

async function commit(db: TestDatabase, session: UploadSession, fence: number, start = 0, end = 49,
  options: { writer?: string; sha?: string; path?: string; confirmed?: boolean; generation?: number; owner?: string } = {}): Promise<ChunkResult> {
  const sha = options.sha ?? SHA;
  const result = await db.query<{ result: ChunkResult }>(
    'SELECT gma_media_transfer_commit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
    [options.owner ?? OWNER, session.id, options.generation ?? session.transfer_generation,
      options.writer ?? 'writer-a', fence, start, end, sha,
      options.path ?? chunkPath(session, start, end, sha), options.confirmed ?? false],
  );
  return result.rows[0]!.result;
}

test('2.2 private provider rows enforce session/asset/provider consistency and JSON objects', async () => {
  const db = await database();
  try {
    const session = await uploading(db);
    const foreign = await uploading(db, 100, OTHER);
    const insert = (asset: string, provider = 'r2', state: unknown = {}) => db.query(
      'INSERT INTO gma_media_provider_private(session_id,asset_id,provider,upload_id,private_state) VALUES($1,$2,$3,$4,$5::jsonb)',
      [session.id, asset, provider, 'local-upload', JSON.stringify(state)],
    );
    await assert.rejects(insert(foreign.asset_id), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(insert(session.asset_id, 'mock'), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(insert(session.asset_id, 'r2', []), /check constraint/);
    await insert(session.asset_id, 'r2', { correlation: 'local-fixture' });
    await assert.rejects(db.query('UPDATE gma_media_provider_private SET asset_id=$1 WHERE session_id=$2',
      [foreign.asset_id, session.id]), /UPLOAD_INVALID_INPUT/);
    assert.equal((await db.query('SELECT session_id FROM gma_media_provider_private')).rows.length, 1);
    await db.exec(await readFile('supabase/migrations/202610080002_media_commands.sql', 'utf8'));
    assert.equal((await db.query('SELECT session_id FROM gma_media_provider_private')).rows.length, 1);
  } finally { await db.close(); }
});

test('2.2 private tables and writer RPCs deny authenticated/anon but permit service_role', async () => {
  const db = await database();
  try {
    const session = await uploading(db);
    await db.query('INSERT INTO gma_media_provider_private(session_id,asset_id,provider) VALUES($1,$2,$3)',
      [session.id, session.asset_id, session.provider]);
    for (const role of ['authenticated', 'anon'] as const) {
      await db.exec(`SET ROLE ${role}`);
      for (const table of ['gma_media_provider_private', 'gma_media_command_results', 'gma_media_upload_chunks']) {
        await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/);
        await assert.rejects(db.query(`DELETE FROM ${table}`), /permission denied/);
      }
      await assert.rejects(claim(db, session), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');
    assert.equal((await db.query('SELECT session_id FROM gma_media_provider_private')).rows.length, 1);
    assert.equal((await claim(db, session)).fence, 1);
    await db.exec('RESET ROLE');
    await assert.rejects(claim(db, session, 'writer-b', OTHER), /UPLOAD_NOT_FOUND/);
  } finally { await db.close(); }
});

test('2.2 command result constraints enforce UUID keys, hashes and exactly one resource', async () => {
  const db = await database();
  try {
    const session = await uploading(db);
    const key = randomUUID();
    const insert = (sessionId: string | null, titleId: number | null, hash: string, idempotencyKey: string = key) => db.query(
      "INSERT INTO gma_media_command_results(owner_id,session_id,title_id,action,idempotency_key,request_hash,result) VALUES($1,$2,$3,'retry',$4,$5,'{}')",
      [OWNER, sessionId, titleId, idempotencyKey, hash],
    );
    await assert.rejects(insert(null, null, SHA), /check constraint/);
    await assert.rejects(insert(session.id, 1, SHA), /check constraint/);
    await assert.rejects(insert(session.id, null, 'not-a-hash'), /check constraint/);
    await assert.rejects(insert(session.id, null, SHA, 'not-a-uuid'), /invalid input syntax/);
    await insert(session.id, null, SHA);
    await assert.rejects(insert(session.id, null, SHA), /duplicate key/);
    assert.equal((await db.query('SELECT * FROM gma_media_command_results')).rows.length, 1);
  } finally { await db.close(); }
});

test('2.2 writer lease renewal, immutable chunk replay and generation/path/range bounds', async () => {
  const db = await database();
  try {
    const session = await uploading(db, 32 * 1024 * 1024);
    const first = await claim(db, session);
    assert.equal(first.fence, 1);
    assert.equal(first.offset, 0);
    assert.equal((await claim(db, session)).fence, first.fence);
    await assert.rejects(claim(db, session, 'writer-b'), /UPLOAD_WRITER_BUSY/);
    await assert.rejects(claim(db, session, 'writer-a', OWNER, 2), /UPLOAD_REVISION_CONFLICT/);
    await assert.rejects(commit(db, session, first.fence, 50, 99), /UPLOAD_RANGE_CONFLICT/);
    await assert.rejects(commit(db, session, first.fence, 0, 16 * 1024 * 1024), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(commit(db, session, first.fence, 0, 49, { path: '../outside.bin' }), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(commit(db, session, first.fence, 0, 49, { generation: 2 }), /UPLOAD_LEASE_LOST/);
    assert.deepEqual(await commit(db, session, first.fence), { offset: 50, upstreamOffset: 0 });
    assert.deepEqual(await commit(db, session, first.fence), { offset: 50, upstreamOffset: 0 });
    await assert.rejects(commit(db, session, first.fence, 0, 49, { sha: OTHER_SHA }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    assert.deepEqual(await commit(db, session, first.fence, 50, 99), { offset: 100, upstreamOffset: 0 });
    assert.equal((await db.query('SELECT * FROM gma_media_upload_chunks WHERE session_id=$1', [session.id])).rows.length, 2);
    assert.equal((await claim(db, session)).offset, 100);
    const renewal = await db.query<{ result: { fence: number } }>('SELECT gma_media_transfer_renew($1,$2,$3,$4,$5) result',
      [OWNER, session.id, session.transfer_generation, 'writer-a', first.fence]);
    assert.equal(renewal.rows[0]!.result.fence, first.fence);
    await db.query('SELECT gma_media_transfer_release($1,$2,$3,$4,$5)',
      [OWNER, session.id, session.transfer_generation, 'writer-a', first.fence]);
    const second = await claim(db, session, 'writer-b');
    assert.equal(second.fence, first.fence + 1);
    await assert.rejects(commit(db, session, first.fence), /UPLOAD_LEASE_LOST/);
    await assert.rejects(db.query('SELECT gma_media_transfer_release($1,$2,$3,$4,$5)',
      [OWNER, session.id, session.transfer_generation, 'writer-a', first.fence]), /UPLOAD_LEASE_LOST/);
  } finally { await db.close(); }
});

test('2.2 confirmed upstream offset cannot skip an unconfirmed earlier chunk', async () => {
  const db = await database();
  try {
    const session = await uploading(db);
    const writer = await claim(db, session);
    await commit(db, session, writer.fence);
    assert.deepEqual(await commit(db, session, writer.fence, 50, 99, { confirmed: true }), { offset: 100, upstreamOffset: 0 });
    assert.deepEqual(await commit(db, session, writer.fence, 0, 49, { confirmed: true }), { offset: 100, upstreamOffset: 100 });
    assert.deepEqual(await commit(db, session, writer.fence), { offset: 100, upstreamOffset: 100 });
  } finally { await db.close(); }
});

test('2.2 expired writer takeover fences old commit/renew and cancellation rejects transport', async () => {
  const db = await database();
  try {
    const session = await uploading(db);
    const first = await claim(db, session);
    await db.query("UPDATE gma_upload_sessions SET transfer_lease_until=now()-interval '1 second' WHERE id=$1", [session.id]);
    const replacement = await claim(db, session, 'writer-b');
    assert.equal(replacement.fence, first.fence + 1);
    await assert.rejects(commit(db, session, first.fence), /UPLOAD_LEASE_LOST/);
    await assert.rejects(db.query('SELECT gma_media_transfer_renew($1,$2,$3,$4,$5)',
      [OWNER, session.id, session.transfer_generation, 'writer-a', first.fence]), /UPLOAD_LEASE_LOST/);
    await uploadCommand(db, 'cancel', { session_id: session.id });
    await assert.rejects(claim(db, session, 'writer-b'), /UPLOAD_CANCELLED/);
    await assert.rejects(commit(db, session, replacement.fence, 0, 49, { writer: 'writer-b' }), /UPLOAD_CANCELLED/);
  } finally { await db.close(); }
});
