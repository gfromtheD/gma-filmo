import test from 'node:test';
import assert from 'node:assert/strict';
import { localDatabase, localEnvironment } from '../../scripts/media/local-tools';
import { legacyInventory } from '../../scripts/media/legacy-inventory';
import { migrationDryRun } from '../../scripts/media/legacy-migrate';
import { fingerprint } from '../../scripts/media/rollback-local';

test('8.6 local PostgreSQL inventory/dry-run writes nothing, transaction rejects mutation and fixture has no unreferenced namespace',async()=>{
  if(process.env.MEDIA_LOCAL_LIVE_ACCEPTANCE!=='true')throw new Error('LOCAL_LIVE_ACCEPTANCE_REQUIRED');
  const db=localDatabase(await localEnvironment());
  try {
    const before=await fingerprint(db),inventory=await legacyInventory(db),dryRun=migrationDryRun(inventory);
    assert.equal(dryRun.writes,0);assert.equal(dryRun.networkRequests,0);assert.deepEqual(await fingerprint(db),before);
    assert.deepEqual(inventory.orphanMedia,[]);assert.deepEqual(inventory.orphanTransferDirectories,[]);assert.deepEqual(inventory.orphanAssetDirectories,[]);
    const connection=await db.connect();
    try {
      await connection.query('BEGIN READ ONLY');
      await assert.rejects(connection.query('UPDATE gma_upload_policy SET legacy_inventory_verified=false'),/read-only transaction/);
    } finally {await connection.query('ROLLBACK');connection.release();}
    assert.deepEqual(await fingerprint(db),before);
  } finally {await db.end();}
});
