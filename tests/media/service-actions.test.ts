import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {serviceHarness} from './service-harness';
import {OWNER} from './database';
test('4.4 pause/resume CAS preserves File and transfer identity; cancel releases only after observation',async()=>{
 const h=await serviceHarness();try{
 const start=await h.service.envelope(OWNER,h.id);const paused=await h.service.pause(OWNER,h.id,start.session.revision);
 await assert.rejects(h.service.resume(OWNER,h.id,h.input.sha256,h.bytes.length,start.session.revision),/UPLOAD_REVISION_CONFLICT/);
 await assert.rejects(h.service.resume(OWNER,h.id,'f'.repeat(64),h.bytes.length,paused.session.revision),/UPLOAD_SOURCE_MISMATCH/);
 const resumed=await h.service.resume(OWNER,h.id,h.input.sha256,h.bytes.length,paused.session.revision);assert.equal(resumed.session.transferGeneration,1);assert.ok(resumed.transfer);
 const cancelled=await h.service.cancel(OWNER,h.id,resumed.session.revision);assert.equal(cancelled.asset.status,'deleting');assert.equal((await h.repo.session(h.id)).quota_released,false);
 await h.service.remove(await h.service.context(h.id));await h.service.remove(await h.service.context(h.id));assert.equal((await h.repo.session(h.id)).quota_released,true);
 assert.equal((await h.db.query("SELECT * FROM gma_upload_ledger WHERE event='release'")).rows.length,3);
 }finally{await h.close();}
});
test('4.4 failed-once retry replay after READY is the persisted result with one reservation',async()=>{
 const h=await serviceHarness();try{
 await h.db.query("UPDATE gma_media_provider_private SET private_state=private_state||'{\"mockScenario\":\"processing-fails-once\"}' WHERE session_id=$1",[h.id]);
 await h.ingest();await h.service.complete(OWNER,h.id,1);await h.service.tick(1);await h.service.tick(1,true);
 const failed=await h.service.envelope(OWNER,h.id);assert.equal(failed.asset.status,'failed');
 const input={revision:failed.session.revision,asset_revision:failed.asset.revision,idempotency_key:randomUUID()};
 const retry=await h.service.retry(OWNER,h.id,input);await h.service.tick(1,true);assert.equal((await h.repo.asset(retry.asset.mediaId)).state,'ready');
 assert.deepEqual(await h.service.retry(OWNER,h.id,input),retry);
 assert.equal((await h.db.query("SELECT * FROM gma_upload_ledger WHERE event='reserve'")).rows.length,3);
 }finally{await h.close();}
});
test('4.4 pending delete and active writer keep quota; account purges only after provider confirmation',async()=>{
 const h=await serviceHarness();try{
 await h.db.query("UPDATE gma_media_provider_private SET private_state=private_state||'{\"mockScenario\":\"delete-pending-once\"}' WHERE session_id=$1",[h.id]);
 await h.repo.uploadCommand(OWNER,'delete_account',{});let authCalls=0;
 await h.service.finalizeAccounts(async()=>{authCalls++;});assert.equal(authCalls,0);
 await assert.rejects(h.service.remove(await h.service.context(h.id)),/UPLOAD_CLEANUP_UNCONFIRMED/);assert.equal((await h.repo.session(h.id)).quota_released,false);
 await h.service.remove(await h.service.context(h.id));await h.service.finalizeAccounts(async()=>{authCalls++;});assert.equal(authCalls,1);
 assert.equal((await h.db.query('SELECT * FROM gma_media_assets')).rows.length,0);
 }finally{await h.close();}
});
test('4.4 cancellation fences active process; delete waits until worker settles and does not spend polling attempts',async()=>{
 const h=await serviceHarness();try{
 await h.ingest();await h.service.complete(OWNER,h.id,1);await h.service.tick(1);
 const worker='active-process';const process=await h.repo.claimJob(worker,true);assert.ok(process);assert.equal(process.kind,'process');
 const state=await h.service.envelope(OWNER,h.id);await h.service.cancel(OWNER,h.id,state.session.revision);
 await assert.rejects(h.service.remove(await h.service.context(h.id)),/UPLOAD_CLEANUP_UNCONFIRMED/);
 const deletion=await h.repo.claimSession(h.id,'delete','cleanup');assert.ok(deletion);await h.service.run(deletion,'cleanup');
 const polled=await h.repo.job(deletion.id);assert.equal(polled.state,'pending');assert.equal(polled.attempts,0);assert.equal((await h.repo.session(h.id)).quota_released,false);
 await h.service.run(process,worker,true);await h.service.remove(await h.service.context(h.id));assert.equal((await h.repo.session(h.id)).quota_released,true);
 assert.equal((await h.repo.asset(state.asset.mediaId)).state,'deleted');
 }finally{await h.close();}
});
