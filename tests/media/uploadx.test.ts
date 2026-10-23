import {test} from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gatewayHarness} from './gateway-fixture';import {OWNER} from './database';
import {parseContentRange} from '../../lib/media/gateway/spool';
import {MediaError} from '../../lib/media/errors';
test('5.2 strict uploadx Content-Range bounds and inclusive end',()=>{
 assert.deepEqual(parseContentRange('bytes */10',10),{query:true});assert.deepEqual(parseContentRange('bytes 0-9/10',10),{query:false,start:0,end:9,size:10});
 for(const value of ['bytes 0-10/10','bytes 2-1/10','bytes 0-9/11','bytes 0-16777216/20000000','garbage'])assert.throws(()=>parseContentRange(value,10));
});
test('5.2 real HTTP zero offset, contiguous chunks, duplicate, full SHA and one receipt',async()=>{
 const h=await gatewayHarness(Buffer.from('abcdef'));try{
 const query=()=>fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':'bytes */6','Content-Length':'0'}});
 const zero=await query();assert.equal(zero.status,308);assert.equal(zero.headers.get('range'),null);
 const put=(start:number,body:string)=>fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes ${start}-${start+body.length-1}/6`},body});
 assert.equal((await put(0,'abc')).status,308);assert.equal((await query()).headers.get('range'),'bytes=0-2');
 assert.equal((await put(0,'abc')).status,308);assert.equal((await put(0,'xyz')).status,409);
 assert.equal((await put(4,'ef')).status,409);assert.equal((await put(3,'def')).status,200);
 assert.equal((await query()).status,200);assert.equal((await query()).headers.get('range'),'bytes=0-5');
 const state=await h.repo.privateState(h.id);assert.ok(state.provisional_receipt);assert.equal((await h.repo.transferChunks(h.id,1)).length,2);
 const completed=await h.storage.complete(h.id,(await h.repo.session(h.id)).asset_id,1,6,createHash('sha256').update('abcdef').digest('hex'));assert.equal(completed.size,6);
 assert.equal((await fetch(h.url,{method:'HEAD',headers:h.headers})).status,404);
 assert.equal((await fetch(h.url,{method:'PUT',headers:{'Content-Range':'bytes */6'}})).status,401);
 }finally{await h.close();}
});
test('5.2 disk shortage rejects before bytes are committed; HTTP bad size/auth fail closed',async()=>{
 const h=await gatewayHarness(undefined,{diskCheck:async()=>{throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE',{status:507});}});try{
 const response=await fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes 0-${h.bytes.length-1}/${h.bytes.length}`},body:h.bytes});assert.equal(response.status,507);
 assert.equal((await h.storage.offset(h.id,1)).offset,0);assert.equal((await h.repo.transferChunks(h.id,1)).length,0);
 }finally{await h.close();}
});
test('5.2 final full SHA mismatch never stores a receipt',async()=>{
 const h=await gatewayHarness();try{const response=await fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes 0-${h.bytes.length-1}/${h.bytes.length}`},body:Buffer.alloc(h.bytes.length,42)});
 assert.equal(response.status,400);assert.equal((await h.repo.privateState(h.id)).provisional_receipt,undefined);
 }finally{await h.close();}
});
test('5.2 SQL fencing prevents late writer private receipt after takeover',async()=>{
 const h=await gatewayHarness();try{
 const first=await h.repo.claimTransfer(OWNER,h.id,1,'first');await h.db.exec('UPDATE gma_upload_sessions SET transfer_lease_until=now()-interval \'1 second\'');
 const second=await h.repo.claimTransfer(OWNER,h.id,1,'second');assert.ok(second.fence>first.fence);
 await assert.rejects(h.repo.gatewayState(OWNER,h.id,1,'first',first.fence,{finalization_pending:true}),/UPLOAD_LEASE_LOST/);
 await h.repo.releaseTransfer(OWNER,h.id,1,'second',second.fence);
 }finally{await h.close();}
});
test('5.2 real HTTP auxiliary PUT validates full SHA and uses the dedicated endpoint',async()=>{
 const previous=process.env.MEDIA_AUXILIARY_PROVIDER;process.env.MEDIA_AUXILIARY_PROVIDER='mock';
 const h=await gatewayHarness();try{
 const draft=await h.repo.uploadCommand(OWNER,'create_draft',{purpose:'title'}) as {id:string;revision:number};const bytes=Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000\nHola\n');
 const result=await h.service.reserve(OWNER,{draft_id:draft.id,revision:draft.revision,role:'subtitles',language:'es',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),file_name:'es.vtt',content_type:'text/vtt',idempotency_key:crypto.randomUUID()});
 const id=result.result.session.sessionId;const context=await h.service.context(id);const grant=h.issuer.issue({sessionId:id,assetId:context.asset.id,generation:1,scope:'upload',method:'PUT',namespace:`transfer/${id}/1/`,expectedBytes:bytes.length,ttlSeconds:900});
 const response=await fetch(`${h.origin}/auxiliary/${id}`,{method:'PUT',headers:{Authorization:`Bearer ${grant.token}`,'Content-Type':'text/vtt'},body:bytes});assert.equal(response.status,200);
 await h.service.complete(OWNER,id,1);await h.service.tick(10,true);assert.equal((await h.service.context(id)).asset.state,'ready');
 }finally{await h.close();if(previous===undefined)delete process.env.MEDIA_AUXILIARY_PROVIDER;else process.env.MEDIA_AUXILIARY_PROVIDER=previous;}
});
test('5.2 HTTP elects one in-flight writer and rejects concurrent upload without overwriting',async()=>{
 let enter=()=>{},release=()=>{};const entered=new Promise<void>(r=>{enter=r;});const wait=new Promise<void>(r=>{release=r;});
 const h=await gatewayHarness(undefined,{diskCheck:async()=>{enter();await wait;}});try{
 const first=fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes 0-${h.bytes.length-1}/${h.bytes.length}`},body:h.bytes});await entered;
 const second=await fetch(h.url,{method:'PUT',headers:{...h.headers,'Content-Range':`bytes */${h.bytes.length}`,'Content-Length':'0'}});assert.equal(second.status,409);
 release();assert.equal((await first).status,200);assert.equal((await h.repo.transferChunks(h.id,1)).length,1);
 }finally{release();await h.close();}
});
test('trozos de hasta 32 MiB: el límite exacto entra y uno más grande no',()=>{
 const total=40_000_000;
 assert.deepEqual(parseContentRange(`bytes 0-${32*1024*1024-1}/${total}`,total),{query:false,start:0,end:32*1024*1024-1,size:32*1024*1024});
 assert.throws(()=>parseContentRange(`bytes 0-${32*1024*1024}/${total}`,total));
});
