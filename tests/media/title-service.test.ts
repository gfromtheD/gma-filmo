import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {serviceHarness} from './service-harness';import {OWNER} from './database';import {TitleService} from '../../lib/media/title-service';import {legacyMediaWritesGate} from '../../lib/media/legacy-writes';
test('4.7 publish strict main UUID, retire/republication, idempotent pending delete and durable cleanup',async()=>{
 const h=await serviceHarness();try{
 await h.ingest();await h.service.complete(OWNER,h.id,1);await h.service.tick(1);await h.service.tick(1,true);
 const state=await h.service.envelope(OWNER,h.id);await h.repo.uploadCommand(OWNER,'update_draft',{draft_id:h.input.draft_id,revision:state.draftRevision,metadata:{title:'Neutral title'}});
 const draft=await h.repo.draft(OWNER,h.input.draft_id);const titles=new TitleService(h.repo);const input={draft_id:draft.id,revision:draft.revision,main_media_id:state.asset.mediaId};
 await assert.rejects(titles.publish(OWNER,{...input,r2VideoUrl:'https://evil.example'}));
 const published=await titles.publish(OWNER,input);assert.deepEqual(await titles.publish(OWNER,input),published);
 const slug=published.title.slug;const key=randomUUID();const retired=await titles.lifecycle(OWNER,slug,'unpublish',{revision:published.title.mediaRevision,idempotency_key:key});
 assert.equal(retired.title.status,'unpublished');assert.equal((await h.repo.asset(state.asset.mediaId)).state,'ready');assert.equal((await h.repo.session(h.id)).quota_released,false);
 const republished=await titles.lifecycle(OWNER,slug,'republish',{revision:retired.title.mediaRevision,idempotency_key:randomUUID()});assert.equal(republished.title.status,'published');
 const deletion={revision:republished.title.mediaRevision,idempotency_key:randomUUID()};const pending=await titles.lifecycle(OWNER,slug,'delete',deletion);assert.equal(pending.title.deletionState,'pending');assert.deepEqual(await titles.lifecycle(OWNER,slug,'delete',deletion),pending);
 await h.service.remove(await h.service.context(h.id));await h.repo.schedule();assert.equal((await titles.detail(OWNER,slug)).title.deletionState,'done');
 await assert.rejects(titles.detail(randomUUID(),slug),/UPLOAD_NOT_FOUND/);
 }finally{await h.close();}
});
test('4.7 legacy write gate remains closed even when neutral engine disabled',()=>{
 const prev=process.env.LEGACY_MEDIA_WRITES_ENABLED;process.env.LEGACY_MEDIA_WRITES_ENABLED='false';try{assert.throws(legacyMediaWritesGate,/LEGACY_UPLOAD_DISABLED/);}finally{if(prev!==undefined)process.env.LEGACY_MEDIA_WRITES_ENABLED=prev;else delete process.env.LEGACY_MEDIA_WRITES_ENABLED;}
});
