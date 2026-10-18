import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {serviceHarness} from './service-harness';import {OWNER} from './database';
test('4.5 DTO owner-only reads whitelist private data and never run jobs',async()=>{
 const h=await serviceHarness();try{
 await h.db.query("UPDATE gma_media_provider_private SET private_state=private_state||'{\"secret\":\"DO_NOT_LEAK\",\"uploadLocation\":\"https://private.example/x\"}' WHERE session_id=$1",[h.id]);
 await h.db.query("UPDATE gma_upload_drafts SET metadata=metadata||'{\"providerToken\":\"DO_NOT_LEAK\",\"title\":\"Safe\"}' WHERE id=$1",[h.input.draft_id]);
 const before=JSON.stringify((await h.db.query('SELECT * FROM gma_upload_jobs')).rows);
 const result=await h.service.draftDetail(OWNER,h.input.draft_id);const json=JSON.stringify(result);
 for(const forbidden of ['DO_NOT_LEAK','uploadLocation','providerToken','provider_data','outputs','uploadId'])assert.equal(json.includes(forbidden),false);
 assert.equal(result.draft.metadata.title,'Safe');assert.equal(result.uploads[0]!.session.receivedBytes,0);
 await assert.rejects(h.service.draftDetail(randomUUID(),h.input.draft_id),/UPLOAD_NOT_FOUND/);
 await assert.rejects(h.service.envelope(randomUUID(),h.id),/UPLOAD_NOT_FOUND/);
 assert.equal(JSON.stringify((await h.db.query('SELECT * FROM gma_upload_jobs')).rows),before);
 }finally{await h.close();}
});
