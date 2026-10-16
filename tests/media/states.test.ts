import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { command, database, OWNER } from '../uploads/database';

test('provider-neutral migration is additive, idempotent and preserves legacy and R2/Stream records', async () => {
  const db = await database();
  try {
    const legacyBefore = await db.query<{ id: number; r2_video_url: string; playback_kind: string }>(
      "SELECT id, r2_video_url, playback_kind FROM peliculas WHERE slug='legacy'",
    );
    assert.equal(legacyBefore.rows.length, 1);
    const draft = await db.query<{ id: string }>(
      "INSERT INTO gma_upload_drafts(owner_id,purpose) VALUES($1,'title') RETURNING id",
      [OWNER],
    );
    const asset = await db.query<{ id: string }>(
      "INSERT INTO gma_media_assets(owner_id,role,provider,expected_input_bytes) VALUES($1,'main','r2',1024) RETURNING id",
      [OWNER],
    );
    const streamDraft = await command<{ id: string; revision: number }>(db, 'create_draft', { purpose: 'title' });
    await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
    const streamSession = await command<{ id: string; asset_id: string }>(db, 'reserve', {
      draft_id: streamDraft.id, revision: streamDraft.revision, role: 'main', bytes: 2048,
      video_provider: 'stream', sha256: 'b'.repeat(64), file_name: 'stream.mp4', content_type: 'video/mp4',
      idempotency_key: 'stream-preserved', request_hash: 'stream-preserved',
    });
    const ids = await db.query<{ provider: string; revision: number; processing_generation: number }>(
      'SELECT provider, revision, processing_generation FROM gma_media_assets WHERE id=$1',
      [asset.rows[0]!.id],
    );
    assert.deepEqual(ids.rows[0], { provider: 'r2', revision: 0, processing_generation: 1 });
    const streamBefore = await db.query<{ provider: string; provider_ref: string | null }>(
      'SELECT provider, provider_ref FROM gma_upload_sessions WHERE id=$1',
      [streamSession.id],
    );

    const migration = await readFile('supabase/migrations/202610080001_media_provider_neutral.sql', 'utf8');
    await db.exec(migration);

    await db.query(
      "UPDATE gma_media_assets SET provider='mock',state='failed',error_code='MOCK_RETRYABLE',error_retryable=true WHERE id=$1",
      [asset.rows[0]!.id],
    );
    const neutral = await db.query<{ provider: string; state: string; error_code: string; error_retryable: boolean }>(
      'SELECT provider,state,error_code,error_retryable FROM gma_media_assets WHERE id=$1',
      [asset.rows[0]!.id],
    );
    assert.deepEqual(neutral.rows[0], { provider: 'mock', state: 'failed', error_code: 'MOCK_RETRYABLE', error_retryable: true });

    await db.exec(migration);
    const legacyAfter = await db.query<{ id: number; r2_video_url: string; playback_kind: string }>(
      "SELECT id, r2_video_url, playback_kind FROM peliculas WHERE slug='legacy'",
    );
    assert.deepEqual(legacyAfter.rows[0], legacyBefore.rows[0]);
    const streamAfter = await db.query<{ provider: string; provider_ref: string | null }>(
      'SELECT provider, provider_ref FROM gma_upload_sessions WHERE id=$1',
      [streamSession.id],
    );
    assert.deepEqual(streamAfter.rows[0], streamBefore.rows[0]);
    assert.ok(draft.rows[0]?.id);
  } finally {
    await db.close();
  }
});
