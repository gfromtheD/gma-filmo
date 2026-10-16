import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceHarness } from './service-harness';
import { OWNER } from './database';

test('4.2 complete stages a private receipt and one verify intent, never uploaded or READY from route', async () => {
  const h=await serviceHarness();
  try {
    await h.ingest(); let calls=0;const original=h.provider.completeUpload.bind(h.provider);
    h.provider.completeUpload=async(ctx)=>{calls++;return original(ctx);};
    const first=await h.service.complete(OWNER,h.id,1);const replay=await h.service.complete(OWNER,h.id,1);
    assert.equal(first.asset.status,'received');assert.equal(replay.session.state,'uploading');assert.equal(calls,1);
    assert.ok((await h.repo.privateState(h.id)).provisional_receipt);
    assert.equal((await h.db.query("SELECT * FROM gma_upload_jobs WHERE kind='verify'")).rows.length,1);
    assert.ok(!JSON.stringify(first).includes('provisional_receipt'));
    await assert.rejects(h.service.complete(OWNER,h.id,2),/UPLOAD_REVISION_CONFLICT/);
  } finally {await h.close();}
});
test('4.2 incomplete source is 409 and wrong source SHA cannot schedule verification', async () => {
  const h=await serviceHarness();
  try {
    await assert.rejects(h.service.complete(OWNER,h.id,1),/transferencia|UPLOAD_NOT_COMPLETE/i);
    await h.ingest();await h.db.query("UPDATE gma_upload_sessions SET source_sha256=$1 WHERE id=$2",['f'.repeat(64),h.id]);
    await assert.rejects(h.service.complete(OWNER,h.id,1),/archivo seleccionado|UPLOAD_SOURCE_MISMATCH/i);
    assert.equal((await h.db.query("SELECT * FROM gma_upload_jobs WHERE kind='verify'")).rows.length,0);
  } finally {await h.close();}
});
