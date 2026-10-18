import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, OWNER, OTHER, uploadCommand } from './database';
import { asset, ready, session, uploading } from './fixture';
import type { UploadDraftRow } from '../../types/media-engine';

type Db = Awaited<ReturnType<typeof database>>;
async function publishedMock(db: Db) {
  const initial = await uploadCommand<UploadDraftRow>(db, 'create_draft', { purpose: 'title' });
  await uploadCommand(db, 'update_draft', { draft_id: initial.id, revision: initial.revision, metadata: { title: `Playback ${initial.id}`, language: 'es', genre: 'Drama' } });
  const titleDraft = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [initial.id])).rows[0]!;
  const current = await ready(db, 'mock');
  await db.query('DELETE FROM gma_draft_media WHERE asset_id=$1', [current.asset.id]);
  await db.query('UPDATE gma_upload_sessions SET draft_id=$1 WHERE asset_id=$2', [titleDraft.id, current.asset.id]);
  await db.query("INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,position) VALUES($1,$2,$3,'main','main',0)", [titleDraft.id, OWNER, current.asset.id]);
  await db.query('UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=$1', [titleDraft.id]);
  const draft = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [titleDraft.id])).rows[0]!;
  const title = await uploadCommand<{ id: number; slug: string }>(db, 'publish', {
    draft_id: draft.id, revision: draft.revision, request_hash: randomUUID(), main_media_id: current.asset.id,
  });
  return { assetId: current.asset.id, titleId: title.id, slug: title.slug, sessionId: current.session.id };
}

test('2.7 owner SELECT is isolated to five media relations; browser writes and private tables stay denied', async () => {
  const db = await database();
  try {
    const mine = await uploading(db, 'mock');
    await db.query('SELECT gma_media_provider_private.session_id FROM gma_media_provider_private LIMIT 1');
    const other = await uploading(db, 'mock', 'main', OTHER);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${OWNER}'`);
    for (const table of ['gma_upload_drafts', 'gma_upload_sessions', 'gma_media_assets', 'gma_draft_media', 'gma_title_media']) {
      const result = await db.query<{ owner_id: string }>(`SELECT * FROM ${table}`);
      if (table === 'gma_draft_media') assert.ok(result.rows.length >= 1);
      if (table === 'gma_upload_drafts' || table === 'gma_upload_sessions' || table === 'gma_media_assets') {
        assert.ok(result.rows.every((row) => row.owner_id === OWNER));
      }
      await assert.rejects(db.query(`DELETE FROM ${table}`), /permission denied/);
      await assert.rejects(db.query(`UPDATE ${table} SET owner_id=owner_id`), /permission denied/);
    }
    for (const table of ['gma_media_provider_private', 'gma_media_command_results', 'gma_media_upload_chunks', 'gma_title_media_versions', 'gma_media_outputs', 'gma_upload_jobs', 'gma_upload_ledger']) {
      await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/);
    }
    await assert.rejects(db.query("SELECT gma_media_authorize('00000000-0000-4000-8000-000000000000',NULL,NULL)"), /permission denied/);
    await db.exec('RESET ROLE');
    assert.ok((await db.query('SELECT * FROM gma_media_assets WHERE id=$1', [other.asset.id])).rows.length === 1);
  } finally { await db.close(); }
});

test('2.7 playback authorization permits own draft and published title, rejects foreign, unpublished, deleting and wrong slug', async () => {
  const db = await database();
  try {
    const draftAsset = await ready(db, 'mock');
    const preview = (await db.query<{ result: { id: string } }>('SELECT gma_media_authorize($1,$2,NULL) result', [draftAsset.asset.id, OWNER])).rows[0]!.result;
    assert.equal(preview.id, draftAsset.asset.id);
    await assert.rejects(db.query('SELECT gma_media_authorize($1,$2,NULL)', [draftAsset.asset.id, OTHER]), /UPLOAD_NOT_FOUND/);
    await assert.rejects(db.query('SELECT gma_media_authorize($1,NULL,NULL)', [draftAsset.asset.id]), /UPLOAD_NOT_FOUND/);
    const current = await publishedMock(db);
    assert.equal((await db.query<{ result: { id: string } }>('SELECT gma_media_authorize($1,NULL,$2) result', [current.assetId, current.slug])).rows[0]!.result.id, current.assetId);
    await assert.rejects(db.query('SELECT gma_media_authorize($1,NULL,$2)', [current.assetId, 'wrong-slug']), /UPLOAD_NOT_FOUND/);
    await assert.rejects(db.query('SELECT gma_media_output_authorized($1,$2,NULL,$3)', [current.assetId, 'unknown.ts', current.slug]), /UPLOAD_NOT_FOUND/);
    const title = (await db.query<{ media_revision: number }>('SELECT media_revision FROM peliculas WHERE id=$1', [current.titleId])).rows[0]!;
    const result = await db.query('SELECT gma_title_command($1,$2,$3::jsonb)', [OWNER, 'unpublish', JSON.stringify({
      title_id: current.titleId, expected_revision: title.media_revision, idempotency_key: randomUUID(), request_hash: 'f'.repeat(64),
    })]);
    assert.ok(result.rows.length === 1);
    await assert.rejects(db.query('SELECT gma_media_authorize($1,NULL,$2)', [current.assetId, current.slug]), /UPLOAD_NOT_FOUND/);
    assert.equal((await db.query('SELECT gma_media_authorize($1,$2,$3)', [current.assetId, OWNER, current.slug])).rows[0] !== undefined, true);
  } finally { await db.close(); }
});

test('2.7 Mock outputs are indexed under exact generation namespace and survive metadata refresh', async () => {
  const db = await database();
  try {
    const current = await ready(db, 'mock');
    const outputs = await db.query<{ relative: string; object_key: string; mime_type: string; size_bytes: number }>(
      'SELECT relative,object_key,mime_type,size_bytes FROM gma_media_outputs WHERE asset_id=$1 ORDER BY relative', [current.asset.id]);
    assert.equal(outputs.rows.length, 2);
    assert.ok(outputs.rows.every((row) => row.object_key.startsWith(`mock/${current.asset.id}/1/`) && row.size_bytes > 0 && row.mime_type.length > 0));
    const output = await db.query<{ result: { key: string; mimeType: string; sizeBytes: number } }>(
      'SELECT gma_media_output_authorized($1,$2,$3,NULL) result', [current.asset.id, outputs.rows[0]!.relative, OWNER]);
    assert.equal(output.rows[0]!.result.key, outputs.rows[0]!.object_key);
    await db.query("UPDATE gma_media_assets SET metadata=metadata||jsonb_build_object('probe_quality',42) WHERE id=$1", [current.asset.id]);
    assert.equal((await db.query('SELECT * FROM gma_media_outputs WHERE asset_id=$1', [current.asset.id])).rows.length, 2);
    await assert.rejects(db.query("UPDATE gma_media_assets SET metadata=jsonb_set(metadata,'{hls_prefix}','\"mock/wrong/1/\"') WHERE id=$1", [current.asset.id]), /UPLOAD_INVALID_INPUT/);
    await db.query("UPDATE gma_media_assets SET state='processing',processing_generation=processing_generation+1 WHERE id=$1", [current.asset.id]);
    assert.equal((await db.query('SELECT * FROM gma_media_outputs WHERE asset_id=$1', [current.asset.id])).rows.length, 0);
  } finally { await db.close(); }
});

test('2.7 historical R2 output metadata may keep nullable mime/size; Stream and PeerTube need no output enumeration', async () => {
  const db = await database();
  try {
    const r2 = await ready(db, 'r2');
    const row = await asset(db, r2.asset.id);
    const legacyMetadata = { ...row.metadata, outputs: [{ relative: 'master.m3u8' }, { relative: '0/index.m3u8' }] };
    await db.query('UPDATE gma_media_assets SET metadata=$2::jsonb WHERE id=$1', [row.id, JSON.stringify(legacyMetadata)]);
    const output = (await db.query<{ mime_type: string | null; size_bytes: number | null }>(
      "SELECT mime_type,size_bytes FROM gma_media_outputs WHERE asset_id=$1 AND relative='master.m3u8'", [row.id])).rows[0]!;
    assert.deepEqual(output, { mime_type: null, size_bytes: null });
    const stream = await ready(db, 'stream');
    const peer = await ready(db, 'peertube');
    assert.equal((await db.query('SELECT * FROM gma_media_outputs WHERE asset_id=ANY($1::uuid[])', [[stream.asset.id, peer.asset.id]])).rows.length, 0);
    const safeSummary = (await db.query<{ result: Record<string, unknown> }>(
      'SELECT gma_media_output_authorized($1,$2,$3,NULL) result', [row.id, 'master.m3u8', OWNER])).rows[0]!.result;
    assert.equal('provider_ref' in (safeSummary.asset as Record<string, unknown>), false);
    assert.equal('outputs' in ((safeSummary.asset as { metadata: Record<string, unknown> }).metadata), false);
  } finally { await db.close(); }
});

test('2.7 output updates are atomic, indexed by asset and relative, and removal revokes every path', async () => {
  const db = await database();
  try {
    const current = await ready(db, 'mock');
    await assert.rejects(db.query("UPDATE gma_media_assets SET metadata=jsonb_set(metadata,'{outputs,0,mime}','\"application/octet-stream\"') WHERE id=$1", [current.asset.id]), /UPLOAD_INVALID_INPUT/);
    const index = await db.query<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE tablename='gma_media_outputs' AND indexdef LIKE '%(asset_id, relative)%'");
    assert.ok(index.rows.length > 0);
    await db.query("UPDATE gma_media_assets SET state='deleting' WHERE id=$1", [current.asset.id]);
    assert.equal((await db.query('SELECT * FROM gma_media_outputs WHERE asset_id=$1', [current.asset.id])).rows.length, 0);
    await assert.rejects(db.query("SELECT gma_media_output_authorized($1,'master.m3u8',$2,NULL)", [current.asset.id, OWNER]), /UPLOAD_NOT_FOUND/);
  } finally { await db.close(); }
});
