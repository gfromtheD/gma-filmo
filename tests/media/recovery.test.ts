import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {gatewayHarness} from './gateway-fixture';import {OWNER} from './database';
test('5.2 restart + orphan fsync/SQL recovery + pause/resume retain immutable chunks',async()=>{
 const h=await gatewayHarness(Buffer.from('abcdef'));try{
 const put=(start:number,body:string)=>fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes ${start}-${start+body.length-1}/6`},body});
 assert.equal((await put(0,'abc')).status,308);
 let session=await h.repo.session(h.id);await h.service.pause(OWNER,h.id,session.revision);
 await h.restart();session=await h.repo.session(h.id);await h.service.resume(OWNER,h.id,h.input.sha256,6,session.revision);
 // Simulate process dying after immutable disk write and before SQL commit.
 await h.storage.writeChunk({sessionId:h.id,assetId:session.asset_id,generation:1,fence:session.transfer_fence+1,startByte:3,endByte:5,expectedBytes:6,sha256:createHash('sha256').update('def').digest('hex'),bytes:Buffer.from('def')});
 await h.restart();const resumed=await fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':'bytes */6','Content-Length':'0'}});
 assert.equal(resumed.status,308);assert.equal(resumed.headers.get('range'),'bytes=0-2');
 assert.equal((await put(3,'def')).status,200);assert.equal((await h.repo.transferChunks(h.id,1)).length,2);
 await h.service.complete(OWNER,h.id,1);await h.service.tick(10,true);assert.equal((await h.service.context(h.id)).asset.state,'ready');
 }finally{await h.close();}
});
test('5.2 lost final HTTP response survives process restart without duplicating receipt/reservation',async()=>{
 const h=await gatewayHarness();try{
 await h.db.query("UPDATE gma_media_provider_private SET private_state=private_state||'{\"mockScenario\":\"upload-response-lost\"}'::jsonb WHERE session_id=$1",[h.id]);
 await assert.rejects(fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes 0-${h.bytes.length-1}/${h.bytes.length}`},body:h.bytes}));
 const state=await h.repo.privateState(h.id);assert.ok(state.provisional_receipt);await h.restart();
 const response=await fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes */${h.bytes.length}`,'Content-Length':'0'}});assert.equal(response.status,200);
 assert.deepEqual((await h.repo.privateState(h.id)).provisional_receipt,state.provisional_receipt);
 const count=await h.db.query<{count:number}>('SELECT count(*)::int count FROM gma_upload_sessions');assert.equal(count.rows[0]?.count,1);
 }finally{await h.close();}
});
test('5.2 failed original assembly removes temporary files before retry',async()=>{
 const {readdir,unlink}=await import('node:fs/promises');const path=await import('node:path');const h=await gatewayHarness();try{
 await h.ingest();const originalOffset=h.storage.offset.bind(h.storage);let removed=false;
 h.storage.offset=async(id,generation)=>{const result=await originalOffset(id,generation);if(!removed){removed=true;await unlink(result.chunks[0]!.filePath);}return result;};
 const session=await h.repo.session(h.id);await assert.rejects(h.storage.complete(h.id,session.asset_id,1,h.bytes.length,h.input.sha256));
 const entries=await readdir(path.join(h.root,h.id,'g1'));assert.equal(entries.some(name=>name.startsWith('.complete-')),false);
 }finally{await h.close();}
});
