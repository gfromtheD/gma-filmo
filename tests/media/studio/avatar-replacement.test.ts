import assert from 'node:assert/strict';
import test from 'node:test';
import { database, OWNER, uploadCommand } from '../database';
import { asset, ready, session } from '../fixture';

test('neutral avatar publication scopes to its owner and queues one durable cleanup for the replaced avatar', async () => {
  const db = await database();
  try {
    const first = await ready(db, 'mock', OWNER, 'avatar');
    await db.query('UPDATE creator_profiles SET avatar_url=$2 WHERE user_id=$1', [OWNER, first.asset.delivery_path]);
    const second = await ready(db, 'mock', OWNER, 'avatar');
    await uploadCommand(db, 'avatar', { draft_id: second.draft.id }, OWNER);

    const profile = await db.query<{ avatar_url: string }>('SELECT avatar_url FROM creator_profiles WHERE user_id=$1', [OWNER]);
    const oldSession = await session(db, first.session.id);
    const newSession = await session(db, second.session.id);
    const oldAsset = await asset(db, first.asset.id);
    const cleanup = await db.query<{ count: string }>("SELECT count(*)::text count FROM gma_upload_jobs WHERE session_id=$1 AND kind='delete'", [first.session.id]);
    assert.equal(profile.rows[0]?.avatar_url, second.asset.delivery_path);
    assert.equal(oldSession.state, 'cancelling');
    assert.equal(oldSession.quota_released, false);
    assert.equal(oldAsset.state, 'deleting');
    assert.equal(cleanup.rows[0]?.count, '1');
    assert.equal(newSession.state, 'uploaded');
    assert.equal(newSession.quota_released, false);
  } finally { await db.close(); }
});
