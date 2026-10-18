import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { command, database, uploadCommand, OWNER } from './database';
import { ready, session, uploading } from './fixture';
import type { UploadDraftRow } from '../../types/media-engine';

type Db = Awaited<ReturnType<typeof database>>;
async function published(db: Db, provider: 'r2' | 'mock' = 'mock') {
  const draft = await uploadCommand<UploadDraftRow>(db, 'create_draft', { purpose: 'title' });
  await uploadCommand(db, 'update_draft', { draft_id: draft.id, revision: draft.revision, metadata: { title: `Lifecycle ${draft.id}`, language: 'es', genre: 'Drama' } });
  const saved = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [draft.id])).rows[0]!;
  const source = await ready(db, provider);
  await db.query('DELETE FROM gma_draft_media WHERE asset_id=$1', [source.asset.id]);
  await db.query('UPDATE gma_upload_sessions SET draft_id=$1 WHERE asset_id=$2', [saved.id, source.asset.id]);
  await db.query("INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,position) VALUES($1,$2,$3,'main','main',0)", [saved.id, OWNER, source.asset.id]);
  await db.query('UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=$1', [saved.id]);
  const current = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [saved.id])).rows[0]!;
  const title = await uploadCommand<{ id: number; slug: string; media_revision: number }>(db, 'publish', {
    draft_id: current.id, revision: current.revision, request_hash: randomUUID(), main_media_id: source.asset.id,
  });
  return { title, asset: source.asset, draft: current };
}
async function titleCommand<T>(db: Db, action: string, payload: unknown, owner = OWNER): Promise<T> {
  const result = await db.query<{ result: T }>('SELECT gma_title_command($1,$2,$3::jsonb) result', [owner, action, JSON.stringify(payload)]);
  return result.rows[0]!.result;
}
function titlePayload(titleId: number, revision: number, action: string) {
  return { title_id: titleId, expected_revision: revision, idempotency_key: randomUUID(), request_hash: 'c'.repeat(64), ...(action ? {} : {}) };
}

test('2.6 unpublish is reversible, preserves junctions and quota, and republish validates all retained assets', async () => {
  const db = await database();
  try {
    const initial = await published(db);
    const before = (await db.query<{ media_revision: number; status: string }>('SELECT media_revision,status FROM peliculas WHERE id=$1', [initial.title.id])).rows[0]!;
    const unpublish = await titleCommand<{ status: string; media_revision: number }>(db, 'unpublish', titlePayload(initial.title.id, before.media_revision, 'unpublish'));
    assert.equal(unpublish.status, 'unpublished');
    assert.equal((await db.query('SELECT * FROM gma_title_media WHERE title_id=$1', [initial.title.id])).rows.length, 1);
    assert.equal((await session(db, (await db.query<{ id: string }>('SELECT id FROM gma_upload_sessions WHERE asset_id=$1', [initial.asset.id])).rows[0]!.id)).quota_released, false);
    const republished = await titleCommand<{ status: string }>(db, 'republish', titlePayload(initial.title.id, unpublish.media_revision, 'republish'));
    assert.equal(republished.status, 'published');
    await assert.rejects(titleCommand(db, 'republish', { ...titlePayload(initial.title.id, unpublish.media_revision, 'republish'), idempotency_key: randomUUID() }), /UPLOAD_REVISION_CONFLICT/);
    await db.query("UPDATE gma_media_assets SET state='failed' WHERE id=$1", [initial.asset.id]);
    const row = (await db.query<{ media_revision: number }>('SELECT media_revision FROM peliculas WHERE id=$1', [initial.title.id])).rows[0]!;
    await titleCommand(db, 'unpublish', titlePayload(initial.title.id, row.media_revision, 'unpublish'));
    const next = (await db.query<{ media_revision: number }>('SELECT media_revision FROM peliculas WHERE id=$1', [initial.title.id])).rows[0]!;
    await assert.rejects(titleCommand(db, 'republish', titlePayload(initial.title.id, next.media_revision, 'republish')), /UPLOAD_MEDIA_NOT_READY/);
  } finally { await db.close(); }
});

test('2.6 delete removes catalog references first, stays pending until provider absence and releases once', async () => {
  const db = await database();
  try {
    const initial = await published(db);
    const film = (await db.query<{ media_revision: number }>('SELECT media_revision FROM peliculas WHERE id=$1', [initial.title.id])).rows[0]!;
    const payload = titlePayload(initial.title.id, film.media_revision, 'delete');
    const deleted = await titleCommand<{ status: string; media_delete_state: string; accepted: boolean }>(db, 'delete', payload);
    assert.deepEqual(deleted, { title_id: initial.title.id, status: 'unpublished', media_delete_state: 'pending', accepted: true });
    assert.deepEqual(await titleCommand(db, 'delete', payload), deleted);
    assert.equal((await db.query('SELECT * FROM gma_title_media WHERE title_id=$1', [initial.title.id])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gma_title_media_versions WHERE title_id=$1 AND retained_until>now()', [initial.title.id])).rows.length, 0);
    const upload = (await db.query<{ id: string; asset_id: string; quota_released: boolean; state: string }>('SELECT id,asset_id,quota_released,state FROM gma_upload_sessions WHERE asset_id=$1', [initial.asset.id])).rows[0]!;
    assert.equal(upload.state, 'cancelling');
    assert.equal(upload.quota_released, false);
    await command(db, 'delete_confirmed', { session_id: upload.id, absent: true, writes_revoked: true });
    await command(db, 'delete_confirmed', { session_id: upload.id, absent: true, writes_revoked: true });
    const releases = await db.query("SELECT * FROM gma_upload_ledger WHERE session_id=$1 AND event='release'", [upload.id]);
    assert.equal(releases.rows.length, 3);
    await db.query('SELECT gma_upload_schedule()');
    assert.equal((await db.query<{ media_delete_state: string }>('SELECT media_delete_state FROM peliculas WHERE id=$1', [initial.title.id])).rows[0]!.media_delete_state, 'done');
  } finally { await db.close(); }
});

test('2.6 restore is owner scoped, CAS fenced, idempotent, monotonic, and limited to retained ready assets', async () => {
  const db = await database();
  try {
    const first = await published(db, 'r2');
    const oldMedia = (await db.query<{ asset_id: string }>('SELECT asset_id FROM gma_title_media WHERE title_id=$1 AND role=\'main\'', [first.title.id])).rows[0]!.asset_id;
    const draft = await uploadCommand<UploadDraftRow>(db, 'create_draft', { purpose: 'title', title_slug: first.title.slug });
    await uploadCommand(db, 'update_draft', { draft_id: draft.id, revision: draft.revision, metadata: { title: 'Replacement', language: 'es', genre: 'Drama' } });
    const currentDraft = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [draft.id])).rows[0]!;
    const source = await ready(db, 'mock');
    await db.query('DELETE FROM gma_draft_media WHERE asset_id=$1', [source.asset.id]);
    await db.query('UPDATE gma_upload_sessions SET draft_id=$1 WHERE asset_id=$2', [draft.id, source.asset.id]);
    await db.query("INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,position) VALUES($1,$2,$3,'main','main',0)", [draft.id, OWNER, source.asset.id]);
    await db.query('UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=$1', [draft.id]);
    const amended = (await db.query<UploadDraftRow>('SELECT * FROM gma_upload_drafts WHERE id=$1', [draft.id])).rows[0]!;
    const replaced = await uploadCommand<{ media_revision: number }>(db, 'publish', { draft_id: amended.id, revision: amended.revision, request_hash: randomUUID(), main_media_id: source.asset.id });
    assert.equal(replaced.media_revision, 1);
    await assert.rejects(db.query('SELECT gma_title_restore_version($1,$2,$3,$4,$5)', [randomUUID(), first.title.id, replaced.media_revision, 0, randomUUID()]), /UPLOAD_NOT_FOUND/);
    await assert.rejects(db.query('SELECT gma_title_restore_version($1,$2,$3,$4,$5)', [OWNER, first.title.id, 0, 0, randomUUID()]), /UPLOAD_REVISION_CONFLICT/);
    const key = randomUUID();
    const restored = (await db.query<{ value: { media_revision: number; playback_kind: string } }>('SELECT gma_title_restore_version($1,$2,$3,$4,$5) value', [OWNER, first.title.id, replaced.media_revision, 0, key])).rows[0]!.value;
    assert.equal(restored.media_revision, 2);
    assert.equal(restored.playback_kind, 'r2_hls');
    assert.equal((await db.query<{ asset_id: string }>('SELECT asset_id FROM gma_title_media WHERE title_id=$1 AND role=\'main\'', [first.title.id])).rows[0]!.asset_id, oldMedia);
    const replay = (await db.query<{ value: { media_revision: number; playback_kind: string } }>('SELECT gma_title_restore_version($1,$2,$3,$4,$5) value', [OWNER, first.title.id, replaced.media_revision, 0, key])).rows[0]!.value;
    assert.deepEqual(replay, restored);
    assert.equal((await db.query<{ media_revision: number }>('SELECT media_revision FROM peliculas WHERE id=$1', [first.title.id])).rows[0]!.media_revision, 2);
  } finally { await db.close(); }
});

test('2.6 delete keeps historical MP4 rows and account purge removes private version/result foreign keys first', async () => {
  const db = await database();
  try {
    await db.query("UPDATE peliculas SET creator_user_id=$1,playback_kind='legacy' WHERE slug='legacy'", [OWNER]);
    const legacy = (await db.query<{ id: number; r2_video_url: string; media_revision: number }>("SELECT id,r2_video_url,media_revision FROM peliculas WHERE slug='legacy'")).rows[0]!;
    const deleted = await titleCommand<{ media_delete_state: string }>(db, 'delete', titlePayload(legacy.id, legacy.media_revision, 'delete'));
    assert.equal(deleted.media_delete_state, 'pending');
    assert.equal((await db.query<{ r2_video_url: string }>('SELECT r2_video_url FROM peliculas WHERE id=$1', [legacy.id])).rows[0]!.r2_video_url, legacy.r2_video_url);
    await db.query('SELECT gma_upload_schedule()');
    assert.equal((await db.query<{ media_delete_state: string }>('SELECT media_delete_state FROM peliculas WHERE id=$1', [legacy.id])).rows[0]!.media_delete_state, 'done');

    const owned = await published(db, 'mock');
    const film = (await db.query<{ media_revision: number }>('SELECT media_revision FROM peliculas WHERE id=$1', [owned.title.id])).rows[0]!;
    await titleCommand(db, 'delete', titlePayload(owned.title.id, film.media_revision, 'delete'));
    await uploadCommand(db, 'delete_account', {});
    await command(db, 'delete_confirmed', { session_id: (await db.query<{ id: string }>('SELECT id FROM gma_upload_sessions WHERE asset_id=$1', [owned.asset.id])).rows[0]!.id, absent: true, writes_revoked: true });
    await uploadCommand(db, 'purge_account', {});
    assert.equal((await db.query('SELECT * FROM gma_title_media_versions WHERE owner_id=$1', [OWNER])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gma_media_command_results WHERE owner_id=$1', [OWNER])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gma_media_assets WHERE owner_id=$1', [OWNER])).rows.length, 0);
  } finally { await db.close(); }
});
