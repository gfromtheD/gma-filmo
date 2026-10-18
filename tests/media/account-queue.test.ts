import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { database } from './database';
import { serviceRepository } from './service-fixture';

test('completed account deletions cannot starve the next pending cleanup', async () => {
  const db = await database();
  try {
    const completed = Array.from({ length: 5 }, () => randomUUID());
    for (const [index, owner] of completed.entries()) {
      await db.query(
        "INSERT INTO gma_upload_account_deletions(owner_id,state,created_at) VALUES($1,'done',$2::timestamptz)",
        [owner, `2026-10-01T00:00:0${index}Z`],
      );
    }
    const pendingOwner = randomUUID();
    await db.query(
      "INSERT INTO gma_upload_account_deletions(owner_id,state,created_at) VALUES($1,'cleanup','2026-10-02T00:00:00Z')",
      [pendingOwner],
    );

    const unfiltered = await db.query<{ state: string }>(
      'SELECT state FROM gma_upload_account_deletions ORDER BY created_at LIMIT 5',
    );
    assert.equal(unfiltered.rows.length, 5);
    assert.ok(unfiltered.rows.every(row => row.state === 'done'));
    assert.deepEqual(await serviceRepository(db).accounts(), [{ owner_id: pendingOwner, state: 'cleanup' }]);
  } finally { await db.close(); }
});
