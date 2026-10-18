import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, OWNER, OTHER, uploadCommand } from './database';
import type { AssetRole, MediaProviderKey, UploadDraftRow, UploadSessionRow } from '../../types/media-engine';

type Database = Awaited<ReturnType<typeof database>>;
const SHA = 'd'.repeat(64);
const GiB = 1024 ** 3;

async function draft(db: Database, owner = OWNER): Promise<UploadDraftRow> {
  return uploadCommand<UploadDraftRow>(db, 'create_draft', { purpose: 'title' }, owner);
}

function payload(current: UploadDraftRow, bytes: number, role: AssetRole = 'main', provider: MediaProviderKey = 'mock', revision = current.revision) {
  return {
    draft_id: current.id, revision, role, bytes, sha256: SHA, file_name: 'quota-fixture.mp4', content_type: 'video/mp4',
    idempotency_key: randomUUID(), request_hash: SHA, video_provider: provider, auxiliary_provider: provider === 'mock' ? 'mock' : 'r2',
  };
}

async function reserve(db: Database, current: UploadDraftRow, bytes: number, role: AssetRole = 'main', provider: MediaProviderKey = 'mock', revision = current.revision) {
  return uploadCommand<UploadSessionRow>(db, 'reserve', payload(current, bytes, role, provider, revision), current.owner_id);
}

test('2.4 default commercial quotas remain exactly 4/6/10 GiB and global 100 GiB', async () => {
  const db = await database();
  try {
    const policy = (await db.query<{ main_bytes: number; draft_bytes: number; user_bytes: number; global_bytes: number }>(
      'SELECT main_bytes,draft_bytes,user_bytes,global_bytes FROM gma_upload_policy',
    )).rows[0]!;
    assert.deepEqual(policy, { main_bytes: 4 * GiB, draft_bytes: 6 * GiB, user_bytes: 10 * GiB, global_bytes: 100 * GiB });
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    const invalidDraft = await draft(db);
    await assert.rejects(reserve(db, invalidDraft, 4 * GiB + 1), /UPLOAD_INVALID_INPUT/);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 0);
    const exact = await reserve(db, invalidDraft, 4 * GiB);
    assert.equal(exact.expected_input_bytes, 4 * GiB);
  } finally { await db.close(); }
});

test('2.4 draft quota accepts exactly 6 GiB and refuses one additional byte atomically', async () => {
  const db = await database();
  try {
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true,user_active_sessions=20');
    const current = await draft(db);
    await reserve(db, current, 4 * GiB);
    await reserve(db, current, GiB, 'extras', 'mock', 1);
    await reserve(db, current, GiB, 'trailer', 'mock', 2);
    await assert.rejects(reserve(db, current, 1, 'intro', 'mock', 3), /UPLOAD_QUOTA_EXCEEDED/);
    const quota = (await db.query<{ reserved_bytes: number }>('SELECT reserved_bytes FROM gma_upload_quota WHERE account_key=$1', [`draft:${current.id}`])).rows[0]!;
    assert.equal(quota.reserved_bytes, 6 * GiB);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions WHERE draft_id=$1', [current.id])).rows.length, 3);
    assert.equal((await db.query('SELECT * FROM gma_upload_ledger')).rows.length, 9);
  } finally { await db.close(); }
});

test('2.4 user quota accepts exactly 10 GiB across drafts and refuses the next byte', async () => {
  const db = await database();
  try {
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true,user_active_sessions=20');
    for (const bytes of [4 * GiB, 4 * GiB, 2 * GiB]) await reserve(db, await draft(db), bytes);
    await assert.rejects(reserve(db, await draft(db), 1), /UPLOAD_QUOTA_EXCEEDED/);
    assert.equal((await db.query<{ reserved_bytes: number }>('SELECT reserved_bytes FROM gma_upload_quota WHERE account_key=$1', [`owner:${OWNER}`])).rows[0]!.reserved_bytes, 10 * GiB);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 3);
  } finally { await db.close(); }
});

test('2.4 global quota accepts exactly 100 GiB without changing user/draft quotas', async () => {
  const db = await database();
  try {
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    for (let index = 0; index < 25; index += 1) {
      const owner = randomUUID();
      await db.query('INSERT INTO auth.users(id) VALUES($1)', [owner]);
      await db.query('INSERT INTO creator_profiles(user_id) VALUES($1)', [owner]);
      await reserve(db, await draft(db, owner), 4 * GiB);
    }
    await assert.rejects(reserve(db, await draft(db, OTHER), 1), /UPLOAD_QUOTA_EXCEEDED/);
    assert.equal((await db.query<{ reserved_bytes: number }>("SELECT reserved_bytes FROM gma_upload_quota WHERE account_key='global'")).rows[0]!.reserved_bytes, 100 * GiB);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 25);
  } finally { await db.close(); }
});

test('2.4 inventory gate, absent policy and concurrency limits fail before any authority is reserved', async () => {
  const db = await database();
  try {
    const current = await draft(db);
    await assert.rejects(reserve(db, current, 100), /UPLOAD_LEGACY_INVENTORY_REQUIRED/);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 0);
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    for (let index = 0; index < 3; index += 1) await reserve(db, await draft(db), 100);
    await assert.rejects(reserve(db, await draft(db), 100), /UPLOAD_CONCURRENCY_LIMIT/);
    await db.exec('DELETE FROM gma_upload_policy');
    await assert.rejects(reserve(db, current, 100), /UPLOAD_POLICY_UNAVAILABLE/);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 3);
    assert.equal((await db.query('SELECT * FROM gma_upload_ledger')).rows.length, 9);
  } finally { await db.close(); }
});

test('2.4 only Stream reserves seconds; other video providers retain independent duration limits', async () => {
  const db = await database();
  try {
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true,user_active_sessions=20');
    for (const provider of ['r2', 'mock', 'peertube', 'stream'] as const) {
      const current = await reserve(db, await draft(db), 100, 'main', provider);
      assert.equal(current.provider, provider);
      assert.equal(current.max_duration_seconds, 14400);
      const events = await db.query<{ seconds: number }>("SELECT seconds FROM gma_upload_ledger WHERE session_id=$1 AND event='reserve'", [current.id]);
      assert.equal(events.rows.length, 3);
      assert.ok(events.rows.every((event) => event.seconds === (provider === 'stream' ? 14400 : 0)));
    }
    const quota = (await db.query<{ reserved_seconds: number; reserved_bytes: number }>("SELECT reserved_seconds,reserved_bytes FROM gma_upload_quota WHERE account_key='global'")).rows[0]!;
    assert.deepEqual(quota, { reserved_seconds: 14400, reserved_bytes: 400 });
  } finally { await db.close(); }
});

test('2.4 auxiliary provider allowlist rejects managed video providers and unknown server selections', async () => {
  const db = await database();
  try {
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    const current = await draft(db);
    const base = payload(current, 100, 'poster');
    for (const auxiliary_provider of ['stream', 'peertube', 'unknown']) {
      await assert.rejects(uploadCommand(db, 'reserve', { ...base, auxiliary_provider }), /UPLOAD_INVALID_INPUT/);
    }
    await assert.rejects(uploadCommand(db, 'reserve', { ...payload(current, 100), video_provider: 'unknown' }), /UPLOAD_INVALID_INPUT/);
    assert.equal((await db.query('SELECT * FROM gma_media_assets')).rows.length, 0);
    const auxiliary = await uploadCommand<UploadSessionRow>(db, 'reserve', { ...base, auxiliary_provider: 'mock' });
    assert.equal(auxiliary.provider, 'mock');
    assert.equal(auxiliary.max_duration_seconds, 0);
  } finally { await db.close(); }
});

test('2.4 reserve replay keeps persisted provider across changed defaults and conflicts on identity', async () => {
  const db = await database();
  try {
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    const current = await draft(db);
    const originalPayload = payload(current, 100);
    const original = await uploadCommand<UploadSessionRow>(db, 'reserve', originalPayload);
    const replay = await uploadCommand<UploadSessionRow>(db, 'reserve', { ...originalPayload, revision: 999, video_provider: 'peertube' });
    assert.deepEqual(replay, original);
    await assert.rejects(uploadCommand(db, 'reserve', { ...originalPayload, bytes: 101 }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    await assert.rejects(uploadCommand(db, 'reserve', { ...originalPayload, request_hash: 'e'.repeat(64) }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    const another = await draft(db);
    await assert.rejects(uploadCommand(db, 'reserve', { ...originalPayload, draft_id: another.id }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE kind='provision'")).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM gma_upload_ledger')).rows.length, 3);
  } finally { await db.close(); }
});
