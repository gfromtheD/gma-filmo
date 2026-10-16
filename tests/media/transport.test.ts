import {test} from 'node:test';import assert from 'node:assert/strict';
import {serviceHarness} from './service-harness';import {OWNER} from './database';
import {transportGenerationSchema,transportRetrySchema,transportResumeSchema} from '../../lib/media/contracts';
import {respond,jsonBody,owner} from '../../lib/uploads/http';
test('4.6 transport generation/protocol guards and bounded invalid body/auth errors',async()=>{
 const h=await serviceHarness();try{
 assert.ok((await h.service.transfer(OWNER,h.id,1)).transfer);
 await assert.rejects(h.service.transfer(OWNER,h.id,2),/UPLOAD_REVISION_CONFLICT/);
 await assert.rejects(h.service.parts(OWNER,h.id),error=>error instanceof Error && 'code' in error && error.code==='UPLOAD_PROTOCOL_UNSUPPORTED');
 await assert.rejects(h.service.part(OWNER,h.id,1,1),error=>error instanceof Error && 'code' in error && error.code==='UPLOAD_PROTOCOL_UNSUPPORTED');
 for(const schema of [transportGenerationSchema,transportRetrySchema,transportResumeSchema])assert.equal(schema.safeParse({provider:'r2'}).success,false);
 const invalid=await respond(()=>jsonBody(new Request('http://localhost',{method:'POST',body:'invalid'})));assert.equal(invalid.status,400);const payload=await invalid.json();assert.equal(payload.error.code,'UPLOAD_INVALID_INPUT');assert.ok(payload.requestId);
 const oversized=await respond(()=>jsonBody(new Request('http://localhost',{method:'POST',body:JSON.stringify({title:'é'.repeat(13000)})})));assert.equal(oversized.status,400);
 const unauthorized=await respond(()=>owner(new Request('http://localhost')));assert.equal(unauthorized.status,401);
 }finally{await h.close();}
});
