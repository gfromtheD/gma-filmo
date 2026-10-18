import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceHarness } from './service-harness';
import { OWNER } from './database';
import { accepted } from './fixture';

test('4.3 executor claims receipt separately and processes verified Mock HLS with generation fencing', async () => {
  const h=await serviceHarness();try {
    await h.ingest();await h.service.complete(OWNER,h.id,1);
    assert.equal(await h.service.tick(1,false),1);
    assert.equal((await h.repo.session(h.id)).state,'uploaded');
    assert.equal((await h.repo.asset((await h.repo.session(h.id)).asset_id)).state,'validating');
    assert.equal(await h.service.tick(1,false),0,'API executor must not execute process');
    assert.equal(await h.service.tick(1,true),1);
    const result=await h.service.envelope(OWNER,h.id);assert.equal(result.asset.status,'ready');assert.equal(result.asset.durationSeconds,12);
    const confirmations=await h.db.query("SELECT * FROM gma_upload_ledger WHERE event='confirm'");assert.equal(confirmations.rows.length,3);
    await h.service.tick(5,true);assert.equal((await h.db.query("SELECT * FROM gma_upload_ledger WHERE event='confirm'")).rows.length,3);
  } finally{await h.close();}
});
test('4.3 managed pending polling does not consume failures and a stale heartbeat cannot revive cancellation', async()=>{
  const h=await serviceHarness();try {
    const f=await accepted(h.db,'peertube');
    await h.repo.jobControl(f.job.id,'fixture-worker','poll',1);
    assert.equal((await h.repo.job(f.job.id)).attempts,0);
    await h.db.query("UPDATE gma_upload_jobs SET run_after=now() WHERE id=$1",[f.job.id]);
    const job=await h.repo.claimSession(f.session.id,'verify','new-worker');assert.ok(job);
    await assert.rejects(h.repo.jobControl(job.id,'fixture-worker','heartbeat',1),/UPLOAD_LEASE_LOST/);
    await h.repo.uploadCommand(OWNER,'cancel',{session_id:f.session.id});
    await assert.rejects(h.repo.jobControl(job.id,'new-worker','heartbeat',1),/UPLOAD_LEASE_LOST/);
  } finally{await h.close();}
});
test('4.3 crashed process lease is reclaimed; stale worker and lost READY response cannot duplicate quota',async()=>{
 const h=await serviceHarness();try {
 await h.ingest();await h.service.complete(OWNER,h.id,1);await h.service.tick(1);
 const crashed=await h.repo.claimJob('crashed',true);assert.ok(crashed);assert.equal(crashed.kind,'process');
 await h.db.query("UPDATE gma_upload_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[crashed.id]);
 const reclaimed=await h.repo.claimJob('replacement',true);assert.ok(reclaimed);assert.equal(reclaimed.id,crashed.id);
 await h.service.run(crashed,'crashed',true);assert.equal((await h.repo.job(crashed.id)).lease_owner,'replacement');
 const command=h.repo.command.bind(h.repo);let lost=true;
 h.repo.command=async(owner,action,payload)=>{const result=await command(owner,action,payload);if(action==='ready' && lost){lost=false;throw Error('committed READY response lost');}return result;};
 await h.service.run(reclaimed,'replacement',true);assert.equal((await h.repo.asset((await h.repo.session(h.id)).asset_id)).state,'ready');
 await h.db.query('UPDATE gma_upload_jobs SET run_after=now() WHERE id=$1',[reclaimed.id]);await h.service.tick(1,true);
 assert.equal((await h.repo.job(reclaimed.id)).state,'done');assert.equal((await h.db.query("SELECT * FROM gma_upload_ledger WHERE event='confirm'")).rows.length,3);
 }finally{await h.close();}
});
test('4.3 exhausted thrown processor exception becomes visible failed with retry, without releasing quota',async()=>{
 const h=await serviceHarness();try {
 await h.ingest();await h.service.complete(OWNER,h.id,1);await h.service.tick(1);
 await h.db.query("UPDATE gma_upload_jobs SET attempts=11 WHERE session_id=$1 AND kind='process'",[h.id]);
 const {MediaService}=await import('../../lib/media/service');const service=new MediaService(h.repo,h.registry,{now:()=>Date.now()},{get:()=>({process:async()=>{throw Error('processor crashed');}})});
 await service.tick(1,true);const asset=await h.repo.asset((await h.repo.session(h.id)).asset_id);
 assert.equal(asset.state,'failed');assert.equal(asset.error_retryable,true);assert.equal(asset.error_code,'UPLOAD_JOB_FAILED');assert.equal((await h.repo.session(h.id)).quota_released,false);
 const job=(await h.db.query<{state:string}>("SELECT state FROM gma_upload_jobs WHERE session_id=$1 AND kind='process'",[h.id])).rows[0]!;assert.equal(job.state,'dead');
 const {randomUUID}=await import('node:crypto');const current=await service.envelope(OWNER,h.id);const retry=await service.retry(OWNER,h.id,{revision:current.session.revision,asset_revision:asset.revision,idempotency_key:randomUUID()});assert.equal(retry.asset.processingGeneration,2);
 }finally{await h.close();}
});
