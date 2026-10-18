import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { command, database, OWNER, OTHER, uploadCommand } from './database';
import { accepted, asset, claimJob, ready, receiptFor, session, snapshotFor, uploading } from './fixture';
import type { MediaAssetRow, UploadSessionRow } from '../../types/media-engine';

test('2.3 neutral command rejects unknown actions and protects owner identity', async () => {
  const db = await database();
  try {
    const current = await uploading(db);
    await assert.rejects(command(db, 'getMetadata', { session_id: current.session.id }), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(command(db, 'upload', { session_id: current.session.id }), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(command(db, 'authorize_transfer', {
      session_id: current.session.id, transfer_generation: current.session.transfer_generation,
    }, OTHER), /UPLOAD_NOT_FOUND/);
    const authorized = await command<UploadSessionRow>(db, 'authorize_transfer', {
      session_id: current.session.id, transfer_generation: current.session.transfer_generation,
    });
    assert.equal(authorized.id, current.session.id);
    await assert.rejects(command(db, 'authorize_transfer', {
      session_id: current.session.id, transfer_generation: current.session.transfer_generation + 1,
    }), /UPLOAD_REVISION_CONFLICT/);
  } finally { await db.close(); }
});

test('2.3 binding preserves one provider resource and saves late UUID without reviving cancellation', async () => {
  const db = await database();
  try {
    const current = await uploading(db, 'peertube');
    const payload = {
      session_id: current.session.id, upload_id: `fixture-${current.session.id}`,
      transfer_generation: current.session.transfer_generation, provider_media_id: null,
      private_state: { fixture: true },
    };
    const repeated = await command<UploadSessionRow>(db, 'bind_upload', payload);
    assert.equal(repeated.id, current.session.id);
    assert.equal(repeated.revision, current.session.revision);
    assert.equal((await db.query('SELECT * FROM gma_media_provider_private WHERE session_id=$1', [current.session.id])).rows.length, 1);
    await assert.rejects(command(db, 'bind_upload', { ...payload, upload_id: 'another-upstream-resource' }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
    await uploadCommand(db, 'cancel', { session_id: current.session.id });
    const uuid = randomUUID();
    const late = await command<UploadSessionRow>(db, 'bind_upload', { ...payload, provider_media_id: uuid });
    assert.equal(late.state, 'cancelling');
    assert.equal(late.provider_ref, uuid);
    assert.equal((await asset(db, current.asset.id)).state, 'deleting');
    assert.equal((await asset(db, current.asset.id)).provider_ref, uuid);
  } finally { await db.close(); }
});

test('2.3 queue verification is backend-only intent and cannot manufacture a receipt or uploaded state', async () => {
  const db = await database();
  try {
    const current = await uploading(db);
    const payload = { session_id: current.session.id, transfer_generation: current.session.transfer_generation };
    await assert.rejects(command(db, 'queue_verification', { ...payload, proof: {} }), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(command(db, 'queue_verification', { ...payload, receipt: {} }), /UPLOAD_INVALID_INPUT/);
    await command(db, 'queue_verification', payload);
    await command(db, 'queue_verification', payload);
    assert.equal((await session(db, current.session.id)).state, 'uploading');
    assert.equal((await asset(db, current.asset.id)).state, 'received');
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='verify'", [current.session.id])).rows.length, 1);
    const verify = await claimJob(db, current.session.id, 'verify');
    await assert.rejects(command(db, 'ready', {
      session_id: current.session.id, job_id: verify.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: 0, snapshot: snapshotFor(current.session),
    }), /UPLOAD_LEASE_LOST/);
    // Even a correctly claimed process job cannot bypass the durable receipt.
    await db.query("SELECT gma_upload_enqueue_job('process',$1,'{\"processing_generation\":1}'::jsonb,$2,now())", [current.session.id, `premature-${current.session.id}`]);
    const premature = await claimJob(db, current.session.id, 'process');
    await assert.rejects(command(db, 'ready', {
      session_id: current.session.id, job_id: premature.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision, snapshot: snapshotFor(current.session),
    }), /UPLOAD_NOT_COMPLETE/);
  } finally { await db.close(); }
});

test('2.3 receipt rejects incomplete bytes, SHA mismatch, wrong provider and missing worker lease', async () => {
  const db = await database();
  try {
    const current = await uploading(db);
    const receipt = await receiptFor(db, current.session);
    await command(db, 'queue_verification', { session_id: current.session.id, transfer_generation: current.session.transfer_generation });
    const verify = await claimJob(db, current.session.id, 'verify');
    const payload = {
      session_id: current.session.id, job_id: verify.id, worker: 'fixture-worker', processing_generation: 1,
      transfer_generation: current.session.transfer_generation, expected_asset_revision: 0, receipt,
    };
    await assert.rejects(command(db, 'receipt', { ...payload, receipt: { ...receipt, complete: false } }), /UPLOAD_NOT_COMPLETE/);
    await assert.rejects(command(db, 'receipt', { ...payload, receipt: { ...receipt, receivedBytes: 99 } }), /UPLOAD_NOT_COMPLETE/);
    await assert.rejects(command(db, 'receipt', { ...payload, receipt: { ...receipt, sourceSha256: 'f'.repeat(64) } }), /UPLOAD_SOURCE_MISMATCH/);
    await assert.rejects(command(db, 'receipt', { ...payload, receipt: { ...receipt, proof: { ...receipt.proof, kind: 'stream-receipt' } } }), /UPLOAD_SOURCE_MISMATCH/);
    const withoutWorker = { ...payload, worker: undefined };
    await assert.rejects(command(db, 'receipt', withoutWorker), /UPLOAD_LEASE_LOST/);
    assert.equal((await asset(db, current.asset.id)).state, 'received');
    const received = await command<MediaAssetRow>(db, 'receipt', payload);
    assert.equal(received.state, 'validating');
    assert.equal((await session(db, current.session.id)).state, 'uploaded');
    const privateState = (await db.query<{ private_state: { receipt: unknown } }>('SELECT private_state FROM gma_media_provider_private WHERE session_id=$1', [current.session.id])).rows[0]!.private_state;
    assert.deepEqual(privateState.receipt, receipt);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query('SELECT private_state FROM gma_media_provider_private'), /permission denied/);
    await db.exec('RESET ROLE');
  } finally { await db.close(); }
});

test('2.3 repeated durable receipt preserves processing and ready with one process job', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    const processing = await command<MediaAssetRow>(db, 'processing', {
      session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision, metadata: { progress: 25 },
    });
    const replayProcessing = await command<MediaAssetRow>(db, 'receipt', current.receiptPayload);
    assert.equal(replayProcessing.state, 'processing');
    assert.equal(replayProcessing.revision, processing.revision);
    const completed = await command<MediaAssetRow>(db, 'ready', {
      session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: processing.revision, snapshot: snapshotFor(current.session),
    });
    const replayReady = await command<MediaAssetRow>(db, 'receipt', current.receiptPayload);
    assert.equal(replayReady.state, 'ready');
    assert.equal(replayReady.revision, completed.revision);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='process'", [current.session.id])).rows.length, 1);
    await assert.rejects(command(db, 'receipt', {
      ...current.receiptPayload, receipt: { ...current.receipt, receivedBytes: 99 },
    }), /UPLOAD_IDEMPOTENCY_CONFLICT/);
  } finally { await db.close(); }
});

test('2.3 READY callbacks confirm quota exactly once and late observations cannot degrade readiness', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    const payload = {
      session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision, snapshot: snapshotFor(current.session),
    };
    const completed = await command<MediaAssetRow>(db, 'ready', payload);
    const repeated = await command<MediaAssetRow>(db, 'ready', payload);
    assert.equal(repeated.revision, completed.revision);
    assert.equal(repeated.state, 'ready');
    await command(db, 'processing', { ...payload, metadata: { progress: 1 } });
    await command(db, 'failed', { ...payload, error_code: 'LATE_ERROR', retryable: true });
    await assert.rejects(uploadCommand(db, 'observe', { session_id: current.session.id, state: 'processing' }), /UPLOAD_PROTOCOL_UNSUPPORTED/);
    await assert.rejects(uploadCommand(db, 'observe', { session_id: current.session.id, state: 'rejected' }), /UPLOAD_PROTOCOL_UNSUPPORTED/);
    assert.equal((await asset(db, current.asset.id)).state, 'ready');
    assert.equal((await asset(db, current.asset.id)).revision, completed.revision);
    const ledger = await db.query<{ account_key: string; count: number }>(
      "SELECT account_key,count(*)::int count FROM gma_upload_ledger WHERE session_id=$1 AND event='confirm' GROUP BY account_key", [current.session.id],
    );
    assert.equal(ledger.rows.length, 3);
    assert.ok(ledger.rows.every((row) => row.count === 1));
    const quota = await db.query<{ used_bytes: number; reserved_bytes: number }>("SELECT used_bytes,reserved_bytes FROM gma_upload_quota WHERE account_key='global'");
    assert.deepEqual(quota.rows[0], { used_bytes: 100, reserved_bytes: 0 });
  } finally { await db.close(); }
});

test('2.3 expired, foreign, stale generation and stale revision callbacks lose their lease', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    const payload = { session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision };
    await assert.rejects(command(db, 'processing', { ...payload, worker: 'other-worker' }), /UPLOAD_LEASE_LOST/);
    await assert.rejects(command(db, 'processing', { ...payload, processing_generation: 2 }), /UPLOAD_LEASE_LOST/);
    await assert.rejects(command(db, 'processing', { ...payload, expected_asset_revision: 99 }), /UPLOAD_REVISION_CONFLICT/);
    await assert.rejects(command(db, 'processing', payload, OTHER), /UPLOAD_NOT_FOUND/);
    const foreign = await accepted(db, 'mock', 'main', OTHER);
    await assert.rejects(command(db, 'processing', { ...payload, job_id: foreign.job.id }), /UPLOAD_LEASE_LOST/);
    await db.query("UPDATE gma_upload_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [current.job.id]);
    await assert.rejects(command(db, 'processing', payload), /UPLOAD_LEASE_LOST/);
    await assert.rejects(db.query('SELECT gma_media_heartbeat($1,$2)', [current.job.id, 'fixture-worker']), /UPLOAD_LEASE_LOST/);
    assert.equal((await asset(db, current.asset.id)).state, 'validating');
  } finally { await db.close(); }
});

test('2.3 READY needs validated snapshot, duration, checksum and complete output inventory', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    const snapshot = snapshotFor(current.session);
    const payload = { session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision, snapshot };
    for (const changed of [
      { ...snapshot, status: 'unknown' }, { ...snapshot, playbackVerified: false },
      { ...snapshot, durationSeconds: 0 }, { ...snapshot, durationSeconds: 14401 },
      { ...snapshot, receivedBytes: 99 }, { ...snapshot, metadata: { source_sha256: 'f'.repeat(64) } },
    ]) await assert.rejects(command(db, 'ready', { ...payload, snapshot: changed }), /UPLOAD_PROCESSING_UNVERIFIED/);
    assert.equal((await session(db, current.session.id)).quota_confirmed, false);
    assert.equal((await asset(db, current.asset.id)).state, 'validating');
  } finally { await db.close(); }
});

test('2.3 normalized auxiliary uses verify lease and requires MIME, hash and nonzero bytes', async () => {
  const db = await database();
  try {
    const current = await accepted(db, 'mock', 'poster');
    assert.equal(current.job.kind, 'verify');
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='process'", [current.session.id])).rows.length, 0);
    const snapshot = snapshotFor(current.session);
    const payload = { session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision, snapshot };
    await assert.rejects(command(db, 'ready', { ...payload, snapshot: { ...snapshot, metadata: { source_sha256: current.session.source_sha256, normalized_bytes: 0, mime: 'image/webp' } } }), /UPLOAD_PROCESSING_UNVERIFIED/);
    await assert.rejects(command(db, 'ready', { ...payload, snapshot: { ...snapshot, metadata: { source_sha256: current.session.source_sha256, normalized_bytes: 50, mime: 'application/octet-stream' } } }), /UPLOAD_PROCESSING_UNVERIFIED/);
    const normalized = await command<MediaAssetRow>(db, 'ready', payload);
    assert.equal(normalized.state, 'ready');
    assert.equal(normalized.auxiliary_bytes, 50);
  } finally { await db.close(); }
});

test('2.3 terminal rejection and cancellation cannot be resurrected by late callbacks', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    const payload = { session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
      processing_generation: 1, expected_asset_revision: current.asset.revision };
    await command(db, 'failed', { ...payload, error_code: 'INVALID_SOURCE', retryable: false });
    assert.equal((await asset(db, current.asset.id)).state, 'deleting');
    assert.equal((await session(db, current.session.id)).state, 'cancelling');
    await assert.rejects(command(db, 'ready', { ...payload, snapshot: snapshotFor(current.session) }), /UPLOAD_LEASE_LOST|UPLOAD_CANCELLED/);
    await assert.rejects(uploadCommand(db, 'observe', { session_id: current.session.id, state: 'processing' }), /UPLOAD_PROTOCOL_UNSUPPORTED/);
    assert.equal((await asset(db, current.asset.id)).state, 'deleting');
    const second = await accepted(db, 'mock', 'extras');
    await uploadCommand(db, 'cancel', { session_id: second.session.id });
    await assert.rejects(command(db, 'processing', {
      session_id: second.session.id, job_id: second.job.id, worker: 'fixture-worker', processing_generation: 1,
      expected_asset_revision: second.asset.revision,
    }), /UPLOAD_CANCELLED/);
    assert.equal((await session(db, second.session.id)).quota_released, false);
  } finally { await db.close(); }
});

test('2.3 heartbeat renews only a live generation and never resurrects cancelled jobs', async () => {
  const db = await database();
  try {
    const current = await accepted(db);
    assert.equal((await db.query<{ ok: boolean }>('SELECT gma_media_heartbeat($1,$2) ok', [current.job.id, 'fixture-worker'])).rows[0]!.ok, true);
    await assert.rejects(db.query('SELECT gma_media_heartbeat($1,$2)', [current.job.id, 'other-worker']), /UPLOAD_LEASE_LOST/);
    await db.query('UPDATE gma_media_assets SET processing_generation=2 WHERE id=$1', [current.asset.id]);
    await assert.rejects(db.query('SELECT gma_media_heartbeat($1,$2)', [current.job.id, 'fixture-worker']), /UPLOAD_LEASE_LOST/);
    await db.query('UPDATE gma_media_assets SET processing_generation=1 WHERE id=$1', [current.asset.id]);
    await uploadCommand(db, 'cancel', { session_id: current.session.id });
    await assert.rejects(db.query('SELECT gma_media_heartbeat($1,$2)', [current.job.id, 'fixture-worker']), /UPLOAD_LEASE_LOST/);
  } finally { await db.close(); }
});

test('2.3 R2/Stream/PeerTube receipts retain provider identity and commercial quota behavior', async () => {
  const db = await database();
  try {
    for (const provider of ['r2', 'stream', 'peertube'] as const) {
      const current = await ready(db, provider);
      assert.equal(current.asset.provider, provider);
      assert.equal(current.asset.state, 'ready');
      assert.equal(current.session.quota_confirmed, true);
      assert.equal(current.session.asset_id, current.asset.id);
      if (provider === 'peertube') assert.match(current.asset.provider_ref ?? '', /^[a-f0-9-]{36}$/);
      if (provider === 'stream') {
        assert.equal(current.asset.provider_ref, current.session.provider_ref);
        assert.match(current.asset.provider_ref ?? '', /^[a-f0-9]{32}$/);
        await uploadCommand(db, 'observe', { session_id: current.session.id, state: 'processing' });
        await uploadCommand(db, 'observe', { session_id: current.session.id, state: 'rejected' });
        assert.equal((await asset(db, current.asset.id)).state, 'ready');
      }
      if (provider === 'r2') {
        const result = await db.query<{ result: MediaAssetRow }>("SELECT gma_video_command($1,'processing',$2::jsonb) result", [OWNER, JSON.stringify({
          session_id: current.session.id, job_id: current.job.id, worker: 'fixture-worker',
        })]);
        assert.equal(result.rows[0]!.result.state, 'ready');
        assert.equal((await asset(db, current.asset.id)).revision, current.asset.revision);
      }
    }
    assert.equal((await db.query<{ r2_video_url: string }>("SELECT r2_video_url FROM peliculas WHERE slug='legacy'")).rows[0]!.r2_video_url, 'https://legacy.example/video.mp4');
  } finally { await db.close(); }
});

test('2.3 lost-response receipt replay survives finished lease clearing without reprocessing', async () => {
  const db = await database();
  try {
    const current = await ready(db, 'peertube');
    await db.query('SELECT gma_upload_finish_job($1,$2,true,NULL,NULL)', [current.verify.id, 'fixture-worker']);
    const replay = await command<MediaAssetRow>(db, 'receipt', current.receiptPayload);
    assert.equal(replay.state, 'ready');
    assert.equal(replay.revision, current.asset.revision);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='verify'", [current.session.id])).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM gma_upload_jobs WHERE session_id=$1 AND kind='process'", [current.session.id])).rows.length, 0);
    await assert.rejects(command(db, 'receipt', { ...current.receiptPayload, worker: 'forged-worker' }), /UPLOAD_LEASE_LOST/);
  } finally { await db.close(); }
});
