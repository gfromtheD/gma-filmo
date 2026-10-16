import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, uploadCommand } from './database';
import { ready, uploading } from './fixture';
import type { UploadDraftRow } from '../../types/media-engine';

type Db = Awaited<ReturnType<typeof database>>;
async function titleDraft(db: Db, title?: string, titleSlug?: string): Promise<UploadDraftRow> {
  const d = await uploadCommand<UploadDraftRow>(db, 'create_draft', { purpose: 'title', ...(titleSlug ? { title_slug: titleSlug } : {}) });
  await uploadCommand(db, 'update_draft', { draft_id: d.id, revision: d.revision, metadata: { title: title ?? `Film ${d.id}`, language: 'es', genre: 'Drama' } });
  return (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [d.id])).rows[0]!;
}
async function attachedMain(db: Db, draft: UploadDraftRow, provider: 'mock' | 'r2' | 'peertube' = 'mock', makeReady = true) {
  const source = makeReady ? await ready(db, provider) : await uploading(db, provider);
  await db.query('DELETE FROM gma_draft_media WHERE asset_id=$1', [source.asset.id]);
  await db.query('UPDATE gma_upload_sessions SET draft_id=$1 WHERE asset_id=$2', [draft.id, source.asset.id]);
  await db.query("INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,language,position) VALUES($1,$2,$3,'main','main',NULL,0)", [draft.id, source.asset.owner_id, source.asset.id]);
  await db.query('UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=$1', [draft.id]);
  const currentDraft = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [draft.id])).rows[0]!;
  return { assetId: source.asset.id, draft: currentDraft };
}
async function publishDraft(db: Db, draft: UploadDraftRow, mainId: string, hash: string = randomUUID()) {
  return uploadCommand<{ id: number; slug: string; playback_kind: string; media_revision: number; r2_video_url: string | null }>(db, 'publish', {
    draft_id: draft.id, revision: draft.revision, request_hash: hash, main_media_id: mainId,
  });
}

test('2.5 publish requires main_media_id and matches the ready main slot', async () => {
  const db = await database();
  try {
    const initial = await titleDraft(db);
    const source = await uploading(db, 'mock');
    await db.query('DELETE FROM gma_draft_media WHERE asset_id=$1', [source.asset.id]);
    await db.query('UPDATE gma_upload_sessions SET draft_id=$1 WHERE asset_id=$2', [initial.id, source.asset.id]);
    await db.query("INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,language,position) VALUES($1,$2,$3,'main','main',NULL,0)", [initial.id, source.asset.owner_id, source.asset.id]);
    await db.query('UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=$1', [initial.id]);
    const draft = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [initial.id])).rows[0]!;
    await assert.rejects(db.query('SELECT gma_upload_command($1,$2,$3::jsonb)', [source.session.owner_id, 'publish', JSON.stringify({ draft_id: draft.id, revision: draft.revision, request_hash: 'missing-main' })]), /UPLOAD_INVALID_INPUT/);
    await assert.rejects(publishDraft(db, draft, randomUUID()), /UPLOAD_REVISION_CONFLICT/);
    await assert.rejects(publishDraft(db, draft, source.asset.id), /UPLOAD_MEDIA_NOT_READY/);
  } finally { await db.close(); }
});

test('2.5 Mock publication uses the verified UUID and media playback without writing a legacy URL', async () => {
  const db = await database();
  try {
    const initial = await titleDraft(db);
    const { draft, assetId } = await attachedMain(db, initial, 'mock');
    const title = await publishDraft(db, draft, assetId, 'mock-title-publication');
    assert.equal(title.playback_kind, 'media');
    assert.equal(title.r2_video_url, null);
    assert.deepEqual(await publishDraft(db, { ...draft, revision: 0 }, assetId, 'mock-title-publication'), title);
    const junction = (await db.query<{ asset_id: string }>("SELECT asset_id FROM gma_title_media WHERE title_id=$1 AND role='main' AND slot='main'", [title.id])).rows[0]!;
    assert.equal(junction.asset_id, assetId);
    assert.equal((await db.query('SELECT * FROM gma_upload_publications WHERE title_id=$1', [title.id])).rows.length, 1);
  } finally { await db.close(); }
});

test('2.5 replacement retains the old ready media and stable MP4 snapshot for seven days', async () => {
  const db = await database();
  try {
    await db.query("UPDATE peliculas SET creator_user_id=$1,playback_kind='legacy' WHERE slug='legacy'", [(await db.query<{ id:string }>('SELECT id FROM auth.users ORDER BY id LIMIT 1')).rows[0]!.id]);
    const initial = await titleDraft(db, 'First film');
    const firstData = await attachedMain(db, initial, 'r2');
    const first = await publishDraft(db, firstData.draft, firstData.assetId, 'r2-first-publish');
    assert.equal(first.playback_kind, 'r2_hls');
    const oldUrl = (await db.query<{ r2_video_url: string | null }>('SELECT r2_video_url FROM peliculas WHERE id=$1', [first.id])).rows[0]!.r2_video_url;
    const replacementInitial = await titleDraft(db, 'Revised film', first.slug);
    const replacement = await attachedMain(db, replacementInitial, 'mock');
    const republished = await publishDraft(db, replacement.draft, replacement.assetId, 'r2-to-mock-replacement');
    assert.equal(republished.playback_kind, 'media');
    const previous = (await db.query<{ retained_until: Date; snapshot: { media: Array<{ asset_id: string }>; r2_video_url: string | null } }>(
      'SELECT retained_until,snapshot FROM gma_title_media_versions WHERE title_id=$1 AND revision=0', [first.id])).rows[0]!;
    assert.equal(previous.snapshot.media[0]?.asset_id, firstData.assetId);
    assert.equal(previous.snapshot.r2_video_url, oldUrl);
    assert.ok(new Date(previous.retained_until).getTime() > Date.now() + 6 * 24 * 60 * 60 * 1000);
    assert.equal((await db.query('SELECT * FROM gma_title_media WHERE title_id=$1 AND asset_id=$2', [first.id, firstData.assetId])).rows.length, 0);
    const oldSession = (await db.query<{ quota_released: boolean }>('SELECT quota_released FROM gma_upload_sessions WHERE asset_id=$1', [firstData.assetId])).rows[0]!;
    assert.equal(oldSession.quota_released, false);
  } finally { await db.close(); }
});

test('2.5 PeerTube publication stays behind GMA media playback and Stream retains its legacy playback kind', async () => {
  const db = await database();
  try {
    const peerInitial = await titleDraft(db, 'Peer film');
    const peer = await attachedMain(db, peerInitial, 'peertube');
    const peerTitle = await publishDraft(db, peer.draft, peer.assetId, 'peertube-media-publish');
    assert.equal(peerTitle.playback_kind, 'media');
    assert.equal(peerTitle.r2_video_url, null);
    const streamInitial = await titleDraft(db, 'Stream film');
    const stream = await ready(db, 'stream');
    await db.query('DELETE FROM gma_draft_media WHERE asset_id=$1', [stream.asset.id]);
    await db.query('UPDATE gma_upload_sessions SET draft_id=$1 WHERE asset_id=$2', [streamInitial.id, stream.asset.id]);
    await db.query("INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,language,position) VALUES($1,$2,$3,'main','main',NULL,0)", [streamInitial.id, stream.asset.owner_id, stream.asset.id]);
    await db.query('UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=$1', [streamInitial.id]);
    const streamDraft = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [streamInitial.id])).rows[0]!;
    const streamTitle = await publishDraft(db, streamDraft, stream.asset.id, 'stream-legacy-publish');
    assert.equal(streamTitle.playback_kind, 'stream');
    assert.equal(streamTitle.r2_video_url, null);
  } finally { await db.close(); }
});
