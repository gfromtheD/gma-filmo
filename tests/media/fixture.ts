import { randomUUID } from 'node:crypto';
import type { AssetRole, MediaAssetRow, MediaProviderKey, UploadSessionRow, UploadDraftRow, UploadJobRow, UploadReceipt } from '../../types/media-engine';
import { command, uploadCommand, OWNER, type database } from './database';

export type MediaDatabase = Awaited<ReturnType<typeof database>>;
export const SHA = 'a'.repeat(64);

export async function asset(db: MediaDatabase, id: string): Promise<MediaAssetRow> {
  return (await db.query<MediaAssetRow>('SELECT * FROM gma_media_assets WHERE id=$1', [id])).rows[0]!;
}
export async function session(db: MediaDatabase, id: string): Promise<UploadSessionRow> {
  return (await db.query<UploadSessionRow>('SELECT * FROM gma_upload_sessions WHERE id=$1', [id])).rows[0]!;
}

export async function uploading(db: MediaDatabase, provider: MediaProviderKey = 'mock', role: AssetRole = 'main', owner = OWNER, bytes = 100) {
  await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
  const draft = await uploadCommand<UploadDraftRow>(db, 'create_draft', { purpose: role === 'avatar' ? 'avatar' : 'title' }, owner);
  let current = await uploadCommand<UploadSessionRow>(db, 'reserve', {
    draft_id: draft.id, revision: draft.revision, role, bytes, sha256: SHA, video_provider: provider, auxiliary_provider: provider === 'mock' ? 'mock' : 'r2',
    file_name: role === 'subtitles' ? 'cues.vtt' : role.startsWith('poster') || role === 'avatar' ? 'poster.png' : 'film.mp4',
    content_type: role === 'subtitles' ? 'text/vtt' : role.startsWith('poster') || role === 'avatar' ? 'image/png' : 'video/mp4',
    idempotency_key: randomUUID(), request_hash: SHA,
  }, owner);
  const providerMediaId = provider === 'stream' ? randomUUID().replaceAll('-', '') : null;
  current = await command<UploadSessionRow>(db, 'bind_upload', {
    session_id: current.id, upload_id: `fixture-${current.id}`, transfer_generation: current.transfer_generation,
    provider_media_id: providerMediaId, private_state: { fixture: true },
  }, owner);
  await db.query("UPDATE gma_upload_jobs SET state='done' WHERE session_id=$1 AND kind='provision'", [current.id]);
  return { draft, session: current, asset: await asset(db, current.asset_id) };
}

export async function claimJob(db: MediaDatabase, id: string, kind: 'verify' | 'process', worker = 'fixture-worker'): Promise<UploadJobRow> {
  const row = (await db.query<{ job: UploadJobRow | null }>(
    'SELECT to_jsonb(gma_upload_claim_session_job($1,$2,$3,120)) job', [id, kind, worker],
  )).rows[0]!.job;
  if (!row) throw new Error(`No ${kind} job for ${id}`);
  return row;
}

export async function receiptFor(db: MediaDatabase, current: UploadSessionRow): Promise<UploadReceipt> {
  let proof: UploadReceipt['proof'];
  if (current.provider === 'mock') {
    const fence = (await db.query<{ result: { fence: number } }>('SELECT gma_media_transfer_claim($1,$2,$3,$4) result',
      [current.owner_id, current.id, current.transfer_generation, 'fixture-writer'])).rows[0]!.result.fence;
    const end = current.expected_input_bytes - 1;
    await db.query('SELECT gma_media_transfer_commit($1,$2,$3,$4,$5,0,$6,$7,$8,true)',
      [current.owner_id, current.id, current.transfer_generation, 'fixture-writer', fence, end, SHA,
        `transfer/${current.id}/${current.transfer_generation}/chunks/0-${end}-${SHA}.bin`]);
    await db.query('SELECT gma_media_transfer_release($1,$2,$3,$4,$5)', [current.owner_id, current.id, current.transfer_generation, 'fixture-writer', fence]);
    proof = { kind: 'mock-sha256', size: current.expected_input_bytes, sha256: current.source_sha256, transferGeneration: current.transfer_generation, chunkManifestHash: 'b'.repeat(64) };
  } else if (current.provider === 'r2') {
    proof = { kind: 'r2-receipt', size: current.expected_input_bytes, etag: 'fixture-etag', objectKey: current.object_key!, completedPartsHash: 'b'.repeat(64) };
  } else if (current.provider === 'stream') {
    proof = { kind: 'stream-receipt', uid: current.provider_ref!, receivedBytes: current.expected_input_bytes, inspectedAt: '2026-10-07T00:00:00.000Z' };
  } else {
    proof = { kind: 'peertube-gateway', uploadId: `fixture-${current.id}`, videoUUID: randomUUID(), totalBytes: current.expected_input_bytes,
      upstreamReceivedBytes: current.expected_input_bytes, gmaSha256: current.source_sha256,
      correlationName: `gma-${current.asset_id}-a${current.transfer_generation}`, finalizingAt: '2026-10-07T00:00:00.000Z' };
  }
  return { complete: true, receivedBytes: current.expected_input_bytes, sourceSha256: current.provider === 'stream' || current.provider === 'r2' ? null : current.source_sha256,
    identity: current.provider === 'stream' || current.provider === 'r2' ? 'provider-receipt' : 'sha256', providerMediaId: proof.kind === 'peertube-gateway' ? proof.videoUUID : current.provider_ref, proof };
}

export function snapshotFor(current: UploadSessionRow, generation = 1, duration = 180) {
  const prefix = current.provider === 'mock' ? `mock/${current.asset_id}/${generation}/` : `media/${current.asset_id}/hls/fixture/`;
  return { status: 'ready', receivedBytes: current.expected_input_bytes, durationSeconds: duration, playbackVerified: true, error: null,
    metadata: current.max_duration_seconds > 0 ? {
      source_sha256: current.source_sha256, outputs_verified: true, hls_prefix: prefix, master_key: `${prefix}master.m3u8`, processed_bytes: 80,
      outputs: [{ relative: 'master.m3u8', bytes: 40, mime: 'application/vnd.apple.mpegurl' }, { relative: '0/segment-000.ts', bytes: 40, mime: 'video/mp2t' }],
      syntheticPlayback: current.provider === 'mock', width: 640, height: 360,
    } : { source_sha256: current.source_sha256, normalized_bytes: 50, mime: current.role === 'subtitles' ? 'text/vtt' : 'image/webp' },
  };
}

export async function accepted(db: MediaDatabase, provider: MediaProviderKey = 'mock', role: AssetRole = 'main', owner = OWNER) {
  const fixture = await uploading(db, provider, role, owner);
  const receipt = await receiptFor(db, fixture.session);
  await command(db, 'queue_verification', { session_id: fixture.session.id, transfer_generation: fixture.session.transfer_generation }, owner);
  const verify = await claimJob(db, fixture.session.id, 'verify');
  const payload = { session_id: fixture.session.id, job_id: verify.id, worker: 'fixture-worker', processing_generation: 1,
    transfer_generation: fixture.session.transfer_generation, expected_asset_revision: fixture.asset.revision, receipt };
  const validated = await command<MediaAssetRow>(db, 'receipt', payload, owner);
  const job = fixture.session.max_duration_seconds > 0 && ['mock', 'r2'].includes(provider) ? await claimJob(db, fixture.session.id, 'process') : verify;
  return { ...fixture, asset: validated, job, verify, receipt, receiptPayload: payload };
}

export async function ready(db: MediaDatabase, provider: MediaProviderKey = 'mock', owner = OWNER, role: AssetRole = 'main') {
  const fixture = await accepted(db, provider, role, owner);
  const current = await command<MediaAssetRow>(db, 'ready', { session_id: fixture.session.id, job_id: fixture.job.id, worker: 'fixture-worker',
    processing_generation: fixture.asset.processing_generation, expected_asset_revision: fixture.asset.revision,
    snapshot: snapshotFor(fixture.session), delivery_path: `/api/media/${fixture.asset.id}/hls/master.m3u8` }, owner);
  return { ...fixture, asset: current, session: await session(db, fixture.session.id) };
}
