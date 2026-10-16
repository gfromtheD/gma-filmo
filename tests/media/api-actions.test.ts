import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import ts from 'typescript';
import {serviceHarness} from './service-harness';import {OWNER} from './database';import * as contracts from '../../lib/media/contracts';import * as uploadContracts from '../../lib/uploads/contracts';import {respond,jsonBody} from '../../lib/uploads/http';import {UploadError} from '../../lib/uploads/repository';
test('4.6 API status/auth/strict bodies and generation use real neutral service, no provider branching',async()=>{
 const h=await serviceHarness();try{
 const source=await readFile('app/api/uploads/[id]/[action]/route.ts','utf8');
 assert.doesNotMatch(source,/R2VideoProvider|StreamProvider|PeerTube|provider\s*===|\.provider\s*===/);
 const module={exports:{} as {POST:(req:Request,ctx:{params:{id:string;action:string}})=>Promise<Response>}};
 const mocks:Record<string,unknown>={'zod':{z:(await import('zod')).z},'@/lib/uploads/http':{respond,jsonBody,engineGate:()=>{},owner:async(req:Request)=>{if(req.headers.get('Authorization')!=='Bearer local-valid')throw new UploadError('UPLOAD_UNAUTHORIZED',401);return OWNER;}},'@/lib/uploads/contracts':uploadContracts,'@/lib/uploads/repository':{UploadError},'@/lib/media/contracts':contracts,'@/lib/media/service':{MediaService:class{constructor(){return h.service;}}}};
 vm.runInNewContext(ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),{exports:module.exports,module,require:(name:string)=>{if(!(name in mocks))throw Error('Unexpected import '+name);return mocks[name];},Response});
 const post=(action:string,body:unknown,token='local-valid')=>module.exports.POST(new Request('http://localhost/api',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:{id:h.id,action}});
 assert.equal((await post('transfer',{generation:1},'invalid')).status,401);assert.equal((await post('transfer',{generation:0})).status,400);
 assert.equal((await post('transfer',{generation:1,provider:'r2'})).status,400);assert.equal((await post('transfer',{generation:2})).status,409);
 const mismatch=await post('resume',{sha256:'0'.repeat(64),bytes:h.bytes.length,revision:(await h.repo.session(h.id)).revision});assert.equal(mismatch.status,400);
 assert.equal((await post('parts',{})).status,409);assert.equal((await post('unknown',{})).status,404);
 const initial=await post('transfer',{generation:1});assert.equal(initial.status,200);const envelope=await initial.json();assert.equal(envelope.version,1);assert.equal(envelope.session.sessionId,h.id);
 await h.ingest();assert.equal((await post('complete',{generation:1})).status,202);await h.service.tick(1);await h.service.tick(1,true);assert.equal((await post('complete',{generation:1})).status,200);
 }finally{await h.close();}
});
