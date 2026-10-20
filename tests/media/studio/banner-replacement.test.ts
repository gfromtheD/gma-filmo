import assert from 'node:assert/strict';
import test from 'node:test';
import { database, OWNER, OTHER, uploadCommand } from '../database';
import { asset, ready, session } from '../fixture';

test('banner publication points the creator profile at the new asset and cleans up the replaced banner', async () => {
  const db = await database();
  try {
    const first = await ready(db, 'mock', OWNER, 'banner');
    await uploadCommand(db, 'banner', { draft_id: first.draft.id }, OWNER);
    const second = await ready(db, 'mock', OWNER, 'banner');
    await uploadCommand(db, 'banner', { draft_id: second.draft.id }, OWNER);

    const profile = await db.query<{ banner_url: string; avatar_url: string | null }>('SELECT banner_url, avatar_url FROM creator_profiles WHERE user_id=$1', [OWNER]);
    const oldSession = await session(db, first.session.id);
    const oldAsset = await asset(db, first.asset.id);
    const cleanup = await db.query<{ count: string }>("SELECT count(*)::text count FROM gma_upload_jobs WHERE session_id=$1 AND kind='delete'", [first.session.id]);
    assert.equal(profile.rows[0]?.banner_url, second.asset.delivery_path);
    assert.equal(profile.rows[0]?.avatar_url, null);
    assert.equal(oldSession.state, 'cancelling');
    assert.equal(oldAsset.state, 'deleting');
    assert.equal(cleanup.rows[0]?.count, '1');
    assert.equal((await session(db, second.session.id)).state, 'uploaded');
  } finally { await db.close(); }
});

test('a banner in use is public, cannot be cancelled, and other roles cannot use a banner draft', async () => {
  const db = await database();
  try {
    const current = await ready(db, 'mock', OWNER, 'banner');
    await uploadCommand(db, 'banner', { draft_id: current.draft.id }, OWNER);
    const authorized = await db.query<{ result: { id: string } }>('SELECT gma_media_authorize($1,NULL,NULL) AS result', [current.asset.id]);
    assert.equal(authorized.rows[0]?.result.id, current.asset.id);
    await assert.rejects(uploadCommand(db, 'cancel', { session_id: current.session.id }, OWNER), /UPLOAD_ASSET_IN_USE/);

    const draft = await uploadCommand<{ id: string; revision: number }>(db, 'create_draft', { purpose: 'banner' }, OWNER);
    await assert.rejects(uploadCommand(db, 'reserve', { draft_id: draft.id, revision: draft.revision, role: 'avatar', bytes: 10, sha256: 'a'.repeat(64),
      file_name: 'x.png', content_type: 'image/png', idempotency_key: crypto.randomUUID(), request_hash: 'h'.repeat(64), auxiliary_provider: 'mock' }, OWNER), /UPLOAD_FORBIDDEN/);
    await assert.rejects(uploadCommand(db, 'reserve', { draft_id: draft.id, revision: draft.revision, role: 'banner', bytes: 10_485_761, sha256: 'a'.repeat(64),
      file_name: 'x.png', content_type: 'image/png', idempotency_key: crypto.randomUUID(), request_hash: 'h'.repeat(64), auxiliary_provider: 'mock' }, OWNER), /UPLOAD_INVALID_INPUT/);
  } finally { await db.close(); }
});

test('a banner needs a creator profile and only its owner can attach it', async () => {
  const db = await database();
  try {
    const current = await ready(db, 'mock', OWNER, 'banner');
    await assert.rejects(uploadCommand(db, 'banner', { draft_id: current.draft.id }, OTHER), /UPLOAD_NOT_FOUND/);
    await db.query('DELETE FROM creator_profiles WHERE user_id=$1', [OTHER]);
    const draft = await uploadCommand<{ id: string; revision: number }>(db, 'create_draft', { purpose: 'banner' }, OTHER);
    await assert.rejects(uploadCommand(db, 'reserve', { draft_id: draft.id, revision: draft.revision, role: 'banner', bytes: 10, sha256: 'a'.repeat(64),
      file_name: 'x.png', content_type: 'image/png', idempotency_key: crypto.randomUUID(), request_hash: 'h'.repeat(64), auxiliary_provider: 'mock' }, OTHER), /UPLOAD_FORBIDDEN/);
  } finally { await db.close(); }
});
