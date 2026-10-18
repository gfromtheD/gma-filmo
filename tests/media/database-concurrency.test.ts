import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { baselineSql, OWNER } from '../uploads/database';
import { mediaMigrations } from './database';
import type { UploadDraft } from '../../lib/uploads/types';
import type { MediaAssetRow, UploadJobRow, UploadSessionRow } from '../../types/media-engine';

interface Claim { fence: number; offset: number; leaseUntil: string }
interface Offset { offset: number; upstreamOffset: number }
const SHA = 'c'.repeat(64);

function isolatedConnection(): string {
  const value = process.env.MEDIA_TEST_DATABASE_URL;
  if (!value || process.env.MEDIA_TEST_DATABASE_ISOLATED !== 'true') throw new Error('An explicitly isolated local PostgreSQL database is required');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Concurrency tests only accept a loopback PostgreSQL database');
  }
  if (url.pathname !== '/gma_media_phase2_test') throw new Error('Concurrency tests require the disposable gma_media_phase2_test database');
  return value;
}

async function uploadCommand<T>(client: PoolClient, action: string, payload: unknown, owner = OWNER): Promise<T> {
  return (await client.query<{ result: T }>('SELECT gma_upload_command($1,$2,$3::jsonb) result',
    [owner, action, JSON.stringify(payload)])).rows[0]!.result;
}

async function mediaCommand<T>(client: PoolClient, action: string, payload: unknown, owner = OWNER): Promise<T> {
  return (await client.query<{ result: T }>('SELECT gma_media_command($1,$2,$3::jsonb) result',
    [owner, action, JSON.stringify(payload)])).rows[0]!.result;
}

async function reserve(client: PoolClient): Promise<UploadSessionRow> {
  const draft = await uploadCommand<UploadDraft>(client, 'create_draft', { purpose: 'title' });
  const session = await uploadCommand<UploadSessionRow>(client, 'reserve', {
    draft_id: draft.id, revision: 0, role: 'main', bytes: 100, sha256: SHA,
    file_name: 'isolated.mp4', content_type: 'video/mp4', idempotency_key: randomUUID(), request_hash: SHA,
  });
  return uploadCommand<UploadSessionRow>(client, 'bind', {
    session_id: session.id, provider_ref: session.object_key, provider_data: { multipartUploadId: 'isolated-upload' },
  });
}

function writerClaim(client: PoolClient, session: Pick<UploadSessionRow, 'id' | 'transfer_generation'>, writer: string): Promise<Claim> {
  return client.query<{ result: Claim }>('SELECT gma_media_transfer_claim($1,$2,$3,$4) result',
    [OWNER, session.id, session.transfer_generation, writer]).then((result) => result.rows[0]!.result);
}

function commit(client: PoolClient, session: Pick<UploadSessionRow, 'id' | 'transfer_generation'>, writer: string, fence: number): Promise<Offset> {
  return client.query<{ result: Offset }>('SELECT gma_media_transfer_commit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
    [OWNER, session.id, session.transfer_generation, writer, fence, 0, 99, SHA,
      `transfer/${session.id}/${session.transfer_generation}/chunks/0-99-${SHA}.bin`, true],
  ).then((result) => result.rows[0]!.result);
}

test('2.2 real PostgreSQL: 20 distinct connections elect one writer, fencing and no global quota lock', async () => {
  const pool = new Pool({ connectionString: isolatedConnection(), max: 20 });
  const clients: PoolClient[] = [];
  try {
    for (let index = 0; index < 20; index += 1) clients.push(await pool.connect());
    const control = clients[0]!;
    const pids = await Promise.all(clients.map((client) => client.query<{ pid: number }>('SELECT pg_backend_pid() pid')));
    assert.equal(new Set(pids.map((result) => result.rows[0]!.pid)).size, 20);
    await control.query(baselineSql);
    for (const migration of [
      'supabase/migrations/20261005_upload_engine_v2.sql', 'supabase/migrations/20261006_upload_engine_r2_first.sql',
      'supabase/migrations/20261007_r2_capacity.sql', 'supabase/migrations/202610080001_media_provider_neutral.sql',
      ...mediaMigrations,
    ]) await control.query(await readFile(migration, 'utf8'));
    await control.query('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    const session = await reserve(control);
    const claims = await Promise.allSettled(clients.map((client, index) => writerClaim(client, session, `writer-${index}`)));
    const accepted = claims.flatMap((result, index) => result.status === 'fulfilled' ? [{ index, claim: result.value }] : []);
    assert.equal(accepted.length, 1);
    for (const rejected of claims) if (rejected.status === 'rejected') {
      assert.ok(rejected.reason instanceof Error);
      assert.match(rejected.reason.message, /UPLOAD_WRITER_BUSY/);
    }
    const winner = accepted[0]!;
    assert.deepEqual(await commit(clients[winner.index]!, session, `writer-${winner.index}`, winner.claim.fence), { offset: 100, upstreamOffset: 100 });
    const replays = await Promise.all(clients.map((client) => commit(client, session, `writer-${winner.index}`, winner.claim.fence)));
    assert.equal(replays.length, 20);
    assert.ok(replays.every((result) => result.offset === 100));
    assert.equal((await control.query<{ count: string }>('SELECT count(*) count FROM gma_media_upload_chunks WHERE session_id=$1', [session.id])).rows[0]!.count, '1');
    await control.query("UPDATE gma_upload_sessions SET transfer_lease_until=now()-interval '1 second' WHERE id=$1", [session.id]);
    const takeover = await writerClaim(control, session, 'replacement-writer');
    assert.equal(takeover.fence, winner.claim.fence + 1);
    const stale = await Promise.allSettled(clients.map((client) => commit(client, session, `writer-${winner.index}`, winner.claim.fence)));
    assert.ok(stale.every((result) => result.status === 'rejected'));
    for (const result of stale) if (result.status === 'rejected') {
      assert.ok(result.reason instanceof Error);
      assert.match(result.reason.message, /UPLOAD_LEASE_LOST/);
    }
    // A transaction blocking the global quota row must not block unrelated transfer claims.
    const independent = await reserve(control);
    await clients[1]!.query('BEGIN');
    try {
      await clients[1]!.query("SELECT 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE");
      await clients[2]!.query("SET statement_timeout='2s'");
      const free = await writerClaim(clients[2]!, independent, 'independent-writer');
      assert.equal(free.fence, 1);
    } finally {
      await clients[1]!.query('ROLLBACK');
      await clients[2]!.query('RESET statement_timeout');
    }
    console.log('20 independent PostgreSQL backends: exactly one writer, 20 duplicate commits, 20 stale fences rejected; global quota lock did not block claim.');

    const quotaOwner = randomUUID();
    await control.query('INSERT INTO auth.users(id) VALUES($1)', [quotaOwner]);
    await control.query('INSERT INTO creator_profiles(user_id) VALUES($1)', [quotaOwner]);
    await control.query('UPDATE gma_upload_policy SET global_bytes=700,user_bytes=500,draft_bytes=500,user_active_sessions=20');
    const drafts = await Promise.all(clients.map((client) => uploadCommand<UploadDraft>(client, 'create_draft', { purpose: 'title' }, quotaOwner)));
    const reservePayloads = drafts.map((draft) => ({ draft_id: draft.id, revision: 0, role: 'poster', bytes: 100,
      sha256: SHA, file_name: 'isolated.png', content_type: 'image/png', idempotency_key: randomUUID(), request_hash: SHA,
      video_provider: 'mock', auxiliary_provider: 'mock' }));
    const reservations = await Promise.allSettled(clients.map((client, index) => uploadCommand<UploadSessionRow>(client, 'reserve', reservePayloads[index], quotaOwner)));
    assert.equal(reservations.filter((result) => result.status === 'fulfilled').length, 5);
    for (const result of reservations) if (result.status === 'rejected') {
      assert.ok(result.reason instanceof Error);
      assert.match(result.reason.message, /UPLOAD_QUOTA_EXCEEDED/);
    }
    assert.equal((await control.query<{ reserved_bytes: string }>("SELECT reserved_bytes FROM gma_upload_quota WHERE account_key='global'")).rows[0]!.reserved_bytes, '700');
    const acceptedIndex = reservations.findIndex((result) => result.status === 'fulfilled');
    const onePayload = reservePayloads[acceptedIndex]!;
    const reserveReplays = await Promise.all(clients.map((client) => uploadCommand<UploadSessionRow>(client, 'reserve', { ...onePayload, video_provider: 'peertube' }, quotaOwner)));
    assert.equal(new Set(reserveReplays.map((result) => result.id)).size, 1);
    assert.equal((await control.query<{ count: string }>("SELECT count(*) count FROM gma_upload_ledger WHERE session_id=$1 AND event='reserve'", [reserveReplays[0]!.id])).rows[0]!.count, '3');
    console.log('20 concurrent reservations: 5 accepted exactly at owner/global boundary, 15 rejected; 20 replays kept one reservation.');

    await control.query('UPDATE gma_upload_policy SET global_bytes=1048576,user_bytes=1048576,draft_bytes=1048576');
    const retryDraft = await uploadCommand<UploadDraft>(control, 'create_draft', { purpose: 'title' });
    let retrySession = await uploadCommand<UploadSessionRow>(control, 'reserve', {
      draft_id: retryDraft.id, revision: 0, role: 'main', bytes: 100, sha256: SHA,
      file_name: 'retry.mp4', content_type: 'video/mp4', video_provider: 'mock', auxiliary_provider: 'mock',
      idempotency_key: randomUUID(), request_hash: SHA,
    });
    retrySession = await mediaCommand<UploadSessionRow>(control, 'bind_upload', {
      session_id: retrySession.id, transfer_generation: 1, upload_id: `local-${retrySession.id}`, provider_media_id: null, private_state: {},
    });
    await control.query("UPDATE gma_upload_jobs SET state='done' WHERE session_id=$1 AND kind='provision'", [retrySession.id]);
    const writer = await writerClaim(control, retrySession, 'retry-writer');
    await commit(control, retrySession, 'retry-writer', writer.fence);
    await control.query('SELECT gma_media_transfer_release($1,$2,$3,$4,$5)', [OWNER, retrySession.id, 1, 'retry-writer', writer.fence]);
    await mediaCommand(control, 'queue_verification', { session_id: retrySession.id, transfer_generation: 1 });
    const verify = (await control.query<{ job: UploadJobRow }>("SELECT to_jsonb(gma_upload_claim_session_job($1,'verify','verify-worker',120)) job", [retrySession.id])).rows[0]!.job;
    const receipt = { complete: true, receivedBytes: 100, sourceSha256: SHA, identity: 'sha256', providerMediaId: null,
      proof: { kind: 'mock-sha256', size: 100, sha256: SHA, transferGeneration: 1, chunkManifestHash: 'b'.repeat(64) } };
    const validating = await mediaCommand<MediaAssetRow>(control, 'receipt', {
      session_id: retrySession.id, job_id: verify.id, worker: 'verify-worker', processing_generation: 1,
      transfer_generation: 1, expected_asset_revision: 0, receipt,
    });
    const processJob = (await control.query<{ job: UploadJobRow }>("SELECT to_jsonb(gma_upload_claim_session_job($1,'process','process-worker',120)) job", [retrySession.id])).rows[0]!.job;
    const failed = await mediaCommand<MediaAssetRow>(control, 'failed', {
      session_id: retrySession.id, job_id: processJob.id, worker: 'process-worker', processing_generation: 1,
      expected_asset_revision: validating.revision, error_code: 'TRANSIENT_PROCESSING', retryable: true,
    });
    retrySession = (await control.query<UploadSessionRow>('SELECT * FROM gma_upload_sessions WHERE id=$1', [retrySession.id])).rows[0]!;
    const retryPayload = { session_id: retrySession.id, revision: retrySession.revision, asset_revision: failed.revision,
      idempotency_key: randomUUID(), request_hash: 'e'.repeat(64) };
    interface RetryResult { session: UploadSessionRow; asset: MediaAssetRow }
    const concurrentRetry = await Promise.all(clients.map((client) => mediaCommand<RetryResult>(client, 'retry', retryPayload)));
    assert.ok(concurrentRetry.every((result) => result.session.id === retrySession.id && result.session.retry_count === 1 && result.asset.processing_generation === 2));
    assert.equal((await control.query<{ count: string }>("SELECT count(*) count FROM gma_media_command_results WHERE session_id=$1 AND action='retry'", [retrySession.id])).rows[0]!.count, '1');
    const jobs = await Promise.all(clients.map((client, index) => client.query<{ job: UploadJobRow | null }>("SELECT to_jsonb(gma_upload_claim_session_job($1,'process',$2,120)) job", [retrySession.id, `retry-worker-${index}`])));
    const soleJob = jobs.flatMap((result) => result.rows[0]!.job ? [result.rows[0]!.job!] : []);
    assert.equal(soleJob.length, 1);
    assert.equal(soleJob[0]!.payload.processing_generation, 2);
    const prefix = `mock/${retrySession.asset_id}/2/`;
    await mediaCommand(control, 'ready', {
      session_id: retrySession.id, job_id: soleJob[0]!.id, worker: soleJob[0]!.lease_owner, processing_generation: 2,
      expected_asset_revision: concurrentRetry[0]!.asset.revision, snapshot: { status: 'ready', receivedBytes: 100, durationSeconds: 180,
        playbackVerified: true, error: null, metadata: { source_sha256: SHA, outputs_verified: true, processed_bytes: 80,
          hls_prefix: prefix, master_key: `${prefix}master.m3u8`, outputs: [{ relative: 'master.m3u8', bytes: 80, mime: 'application/vnd.apple.mpegurl' }] } },
    });
    const lostResponseReplays = await Promise.all(clients.map((client) => mediaCommand<RetryResult>(client, 'retry', retryPayload)));
    assert.deepEqual(lostResponseReplays, concurrentRetry);
    assert.equal((await control.query<{ count: string }>("SELECT count(*) count FROM gma_upload_ledger WHERE session_id=$1 AND event='confirm'", [retrySession.id])).rows[0]!.count, '3');
    console.log('20 concurrent retries: one command result, one generation, one claimed process job; 20 response-loss replays after READY kept the original result.');
  } finally {
    for (const client of clients) client.release();
    await pool.end();
  }
});
