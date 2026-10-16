import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, OWNER, uploadCommand } from './database';
import { ready } from './fixture';
import { serviceRepository } from './service-fixture';

test('5.3 published profile avatar issues a private indexed grant and replacement revokes it immediately', async () => {
  const db = await database();
  try {
    const current = await ready(db, 'mock', OWNER, 'avatar');
    const repo = serviceRepository(db);
    const relative = 'avatar.webp';
    await db.query('UPDATE gma_media_assets SET metadata=metadata||$2::jsonb WHERE id=$1', [current.asset.id, JSON.stringify({
      hls_prefix: `mock/${current.asset.id}/1/`, auxiliary_file: relative,
      outputs: [{ relative, bytes: 50, mime: 'image/webp' }],
    })]);
    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    const tokenHash = 'c'.repeat(64);
    // A ready avatar in an active private draft is not yet a public profile resource.
    await assert.rejects(repo.registerGatewayGrant(null, current.asset.id, 1, null, null, tokenHash, expiresAt), /UPLOAD_NOT_FOUND/);
    await uploadCommand(db, 'avatar', { draft_id: current.draft.id });
    const draft = await db.query<{ state: string }>('SELECT state FROM gma_upload_drafts WHERE id=$1', [current.draft.id]);
    assert.equal(draft.rows[0]?.state, 'published');
    await repo.registerGatewayGrant(null, current.asset.id, 1, null, null, tokenHash, expiresAt);
    const audience = await db.query<{ audience: string; owner_id: string | null; draft_id: string | null; title_slug: string | null }>(
      'SELECT audience,owner_id,draft_id,title_slug FROM gma_media_gateway_grants WHERE token_hash=$1', [tokenHash]);
    assert.deepEqual(audience.rows[0], { audience: 'profile-avatar', owner_id: null, draft_id: null, title_slug: null });
    const output = await repo.gatewayOutput(current.asset.id, 1, relative, tokenHash);
    assert.equal(output.mimeType, 'image/webp'); assert.equal(output.sizeBytes, 50); assert.equal(output.provider, 'mock');
    await assert.rejects(repo.gatewayOutput(current.asset.id, 1, 'original.bin', tokenHash), /UPLOAD_NOT_FOUND/);
    // Preserve READY and the grant row: only the current profile reference is changed.
    await db.query('UPDATE creator_profiles SET avatar_url=$2 WHERE user_id=$1', [OWNER, `/api/media/${randomUUID()}`]);
    await assert.rejects(repo.gatewayOutput(current.asset.id, 1, relative, tokenHash), /UPLOAD_NOT_FOUND/);
    await assert.rejects(repo.registerGatewayGrant(null, current.asset.id, 1, null, null, 'd'.repeat(64), expiresAt), /UPLOAD_NOT_FOUND/);
  } finally { await db.close(); }
});
