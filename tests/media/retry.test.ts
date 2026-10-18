import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { command, database, OWNER } from './database';
import { accepted, asset, claimJob, session, snapshotFor } from './fixture';
import type { MediaAssetRow, MediaProviderKey, UploadSessionRow } from '../../types/media-engine';

type Database = Awaited<ReturnType<typeof database>>;
interface RetryResult { session: UploadSessionRow; asset: MediaAssetRow }
const HASH = 'e'.repeat(64);

async function failed(db: Database, provider: MediaProviderKey = 'mock') {
  const current = await accepted(db, provider);
  await command(db, 'failed', { session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
    processing_generation: current.asset.processing_generation, expected_asset_revision: current.asset.revision,
    error_code: 'TRANSIENT_PROCESSING', retryable: true,
  });
  return { ...current, session: await session(db, current.session.id), asset: await asset(db, current.asset.id) };
}

function retryPayload(current: { session: UploadSessionRow; asset: MediaAssetRow }, key: string = randomUUID()) {
  return { session_id: current.session.id, revision: current.session.revision, asset_revision: current.asset.revision,
    idempotency_key: key, request_hash: HASH };
}

test('2.4 retry keeps media/session identity, original receipt and one quota reservation', async () => {
  const db = await database();
  try {
    const current = await failed(db);
    const beforeLedger = (await db.query('SELECT * FROM gma_upload_ledger ORDER BY account_key,event')).rows;
    const beforeQuota = (await db.query('SELECT * FROM gma_upload_quota ORDER BY account_key')).rows;
    const payload = retryPayload(current);
    const result = await command<RetryResult>(db, 'retry', payload);
    assert.equal(result.session.id, current.session.id);
    assert.equal(result.asset.id, current.asset.id);
    assert.equal(result.session.transfer_generation, current.session.transfer_generation);
    assert.equal(result.asset.processing_generation, current.asset.processing_generation + 1);
    assert.equal(result.asset.state, 'processing');
    assert.equal(result.session.retry_count, 1);
    assert.equal(result.session.revision, current.session.revision + 1);
    assert.equal(result.asset.revision, current.asset.revision + 1);
    assert.equal(result.asset.error_code, null);
    assert.equal(result.session.last_error_code, null);
    assert.deepEqual((await db.query('SELECT * FROM gma_upload_ledger ORDER BY account_key,event')).rows, beforeLedger);
    assert.deepEqual((await db.query('SELECT * FROM gma_upload_quota ORDER BY account_key')).rows, beforeQuota);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='provision'", [current.session.id])).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length, 1);
    const job = await claimJob(db, current.session.id, 'process', 'retry-worker');
    const completed = await command<MediaAssetRow>(db, 'ready', {
      session_id: current.session.id, job_id: job.id, worker: 'retry-worker', processing_generation: 2,
      expected_asset_revision: result.asset.revision, snapshot: snapshotFor(result.session, 2),
    });
    assert.equal(completed.state, 'ready');
    const replay = await command<RetryResult>(db, 'retry', payload);
    assert.deepEqual(replay, result);
    assert.equal((await asset(db, current.asset.id)).state, 'ready');
    assert.equal((await db.query("SELECT * FROM gma_upload_ledger WHERE session_id=$1 AND event='confirm'", [current.session.id])).rows.length, 3);
    assert.equal((await db.query('SELECT * FROM gma_media_command_results WHERE session_id=$1', [current.session.id])).rows.length, 1);
  } finally { await db.close(); }
});

test('2.4 retry idempotency detects hash/resource conflicts before state and revision checks', async () => {
  const db = await database();
  try {
    const current = await failed(db);
    const payload = retryPayload(current);
    const result = await command<RetryResult>(db, 'retry', payload);
    await assert.rejects(command(db, 'retry', { ...payload, revision: 999, asset_revision: 999, request_hash: 'f'.repeat(64) }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    const another = await failed(db);
    await assert.rejects(command(db, 'retry', { ...payload, session_id: another.session.id }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    assert.deepEqual(await command<RetryResult>(db, 'retry', { ...payload, revision: 999, asset_revision: 999 }), result);
    assert.equal((await db.query('SELECT * FROM gma_media_command_results')).rows.length, 1);
  } finally { await db.close(); }
});

test('2.4 retry CAS requires both revisions and caps explicit retries at three', async () => {
  const db = await database();
  try {
    let current = await failed(db);
    await assert.rejects(command(db, 'retry', { ...retryPayload(current), revision: current.session.revision - 1 }), /UPLOAD_REVISION_CONFLICT/);
    await assert.rejects(command(db, 'retry', { ...retryPayload(current), asset_revision: current.asset.revision - 1 }), /UPLOAD_REVISION_CONFLICT/);
    for (let count = 1; count <= 3; count += 1) {
      const result = await command<RetryResult>(db, 'retry', retryPayload(current));
      assert.equal(result.session.retry_count, count);
      const job = await claimJob(db, result.session.id, 'process', 'loop-worker');
      await command(db, 'failed', {
        session_id: result.session.id, job_id: job.id, worker: 'loop-worker', processing_generation: result.asset.processing_generation,
        expected_asset_revision: result.asset.revision, error_code: 'TRANSIENT_PROCESSING', retryable: true,
      });
      current = { ...current, session: await session(db, result.session.id), asset: await asset(db, result.asset.id) };
    }
    await assert.rejects(command(db, 'retry', retryPayload(current)), /UPLOAD_RETRY_LIMIT/);
    assert.equal((await session(db, current.session.id)).retry_count, 3);
    assert.equal((await db.query('SELECT * FROM gma_media_command_results')).rows.length, 3);
    assert.equal((await db.query("SELECT * FROM gma_upload_ledger WHERE event='reserve'")).rows.length, 3);
  } finally { await db.close(); }
});

test('2.4 retry invalidates an older live job and generation before creating its successor', async () => {
  const db = await database();
  try {
    const current = await failed(db);
    // A second stale worker lease simulates a process that did not observe the failure yet.
    const staleId = randomUUID();
    await db.query("INSERT INTO gma_upload_jobs(id,session_id,kind,payload,dedupe_key,state,lease_owner,lease_until) VALUES($1,$2,'process',$3::jsonb,$4,'running','stale-worker',now()+interval '120 seconds')",
      [staleId, current.session.id, JSON.stringify({ processing_generation: 1 }), `stale-${staleId}`]);
    const result = await command<RetryResult>(db, 'retry', retryPayload(current));
    const stale = (await db.query<{ state: string; last_error: string; lease_owner: string | null }>('SELECT state,last_error,lease_owner FROM gma_upload_jobs WHERE id=$1', [staleId])).rows[0]!;
    assert.deepEqual(stale, { state: 'dead', last_error: 'UPLOAD_GENERATION_SUPERSEDED', lease_owner: null });
    await assert.rejects(command(db, 'ready', {
      session_id: current.session.id, job_id: staleId, worker: 'stale-worker', processing_generation: 1,
      expected_asset_revision: result.asset.revision, snapshot: snapshotFor(current.session),
    }), /UPLOAD_LEASE_LOST/);
    await assert.rejects(db.query('SELECT gma_media_heartbeat($1,$2)', [staleId, 'stale-worker']), /UPLOAD_LEASE_LOST/);
  } finally { await db.close(); }
});

test('2.4 PeerTube observe-only retry reuses durable receipt and queues one verify generation', async () => {
  const db = await database();
  try {
    const current = await failed(db, 'peertube');
    const oldReceipt = (await db.query<{ private_state: unknown }>('SELECT private_state FROM gma_media_provider_private WHERE session_id=$1', [current.session.id])).rows[0]!.private_state;
    const result = await command<RetryResult>(db, 'retry', retryPayload(current));
    const verify = await claimJob(db, current.session.id, 'verify', 'observer');
    assert.equal(verify.payload.processing_generation, 2);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='process'", [current.session.id])).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='provision'", [current.session.id])).rows.length, 1);
    assert.deepEqual((await db.query<{ private_state: unknown }>('SELECT private_state FROM gma_media_provider_private WHERE session_id=$1', [current.session.id])).rows[0]!.private_state, oldReceipt);
    const completed = await command<MediaAssetRow>(db, 'ready', {
      session_id: current.session.id, job_id: verify.id, worker: 'observer', processing_generation: 2,
      expected_asset_revision: result.asset.revision, snapshot: snapshotFor(result.session, 2),
    });
    assert.equal(completed.state, 'ready');
    assert.equal(completed.provider_ref, current.asset.provider_ref);
  } finally { await db.close(); }
});

test('2.4 retry rejects Stream replacement mode, missing receipt and published references', async () => {
  const db = await database();
  try {
    const stream = await failed(db, 'stream');
    await assert.rejects(command(db, 'retry', retryPayload(stream)), /UPLOAD_PROTOCOL_UNSUPPORTED/);
    const current = await failed(db);
    await db.query("UPDATE gma_media_provider_private SET private_state=private_state-'receipt' WHERE session_id=$1", [current.session.id]);
    await assert.rejects(command(db, 'retry', retryPayload(current)), /UPLOAD_RETRY_UNAVAILABLE/);
    const referenced = await failed(db, 'r2');
    await db.query("INSERT INTO gma_title_media(title_id,asset_id,owner_id,role,slot) VALUES(1,$1,$2,'main','main')", [referenced.asset.id, OWNER]);
    await assert.rejects(command(db, 'retry', retryPayload(referenced)), /UPLOAD_RETRY_UNAVAILABLE/);
    assert.equal((await db.query('SELECT * FROM gma_media_command_results')).rows.length, 0);
  } finally { await db.close(); }
});

test('2.4 exhausted crashed Mock lease becomes visible failed and does not suppress reconciliation', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    await db.query("UPDATE gma_upload_jobs SET attempts=12,lease_until=now()-interval '1 second' WHERE id=$1", [current.job.id]);
    await db.query('SELECT gma_upload_schedule()');
    const ended = (await db.query<{ state: string }>('SELECT state FROM gma_upload_jobs WHERE id=$1', [current.job.id])).rows[0]!;
    assert.equal(ended.state, 'dead');
    const failedAsset = await asset(db, current.asset.id);
    assert.equal(failedAsset.state, 'failed');
    assert.equal(failedAsset.error_retryable, true);
    await db.query("UPDATE gma_upload_sessions SET updated_at=now()-interval '10 minutes' WHERE id=$1", [current.session.id]);
    await db.query('SELECT gma_upload_schedule()');
    assert.ok((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='reconcile' AND state='pending'", [current.session.id])).rows.length > 0);
  } finally { await db.close(); }
});
