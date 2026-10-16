import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { database, OWNER } from './database';
import { serviceRepository } from './service-fixture';
import { MediaService } from '../../lib/media/service';
import { MediaProviderRegistry } from '../../lib/media/registry';
import { MockMediaProvider } from '../../lib/media/providers/mock';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import type { ProviderUploadContext } from '../../lib/media/provider';

async function setup() {
  const db=await database(); await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
  const repo=serviceRepository(db); const root=await mkdtemp(path.join(os.tmpdir(),'gma-reserve-'));
  const draft=await repo.uploadCommand(OWNER,'create_draft',{purpose:'title'}) as {id:string;revision:number};
  const input={draft_id:draft.id,revision:draft.revision,role:'main',bytes:100,sha256:'a'.repeat(64),file_name:'film.mp4',content_type:'video/mp4',idempotency_key:randomUUID()};
  return {db,repo,root,input};
}
function registry(provider: MockMediaProvider, defaultProvider: () => 'mock' | 'r2') {
  const factory=()=>provider; return new MediaProviderRegistry({mock:factory,r2:()=>{throw new Error('R2_MUST_STAY_LAZY');},stream:factory,peertube:factory},defaultProvider);
}
test('4.1 durable reserve replay keeps provider and identity before default validation', async () => {
  const f=await setup(); const old=process.env.MEDIA_AUXILIARY_PROVIDER; process.env.MEDIA_AUXILIARY_PROVIDER='mock';
  try {
    const provider=new MockMediaProvider(new MockMediaStorage(f.root),f.repo); let selected:'mock'|'r2'='mock';
    const service=new MediaService(f.repo,registry(provider,()=>selected));
    const first=await service.reserve(OWNER,f.input); selected='r2';
    const replay=await service.reserve(OWNER,{...f.input,revision:99});
    assert.equal(first.created,true); assert.equal(replay.created,false); assert.equal(replay.result.session.sessionId,first.result.session.sessionId);
    assert.equal((await f.repo.session(first.result.session.sessionId)).provider,'mock');
    assert.equal((await f.db.query('SELECT * FROM gma_upload_sessions')).rows.length,1);
    await assert.rejects(service.reserve(OWNER,{...f.input,bytes:101}),/UPLOAD_IDEMPOTENCY_CONFLICT/);
  } finally { if(old===undefined)delete process.env.MEDIA_AUXILIARY_PROVIDER;else process.env.MEDIA_AUXILIARY_PROVIDER=old;await f.db.close();await rm(f.root,{recursive:true,force:true}); }
});
test('4.1 lost provision response recovers durable Mock identity without a second create', async () => {
  const f=await setup(); process.env.MEDIA_AUXILIARY_PROVIDER='mock'; let creates=0;
  class LostResponseMock extends MockMediaProvider {
    override async provisionUpload(context:ProviderUploadContext): Promise<never> { creates++; await super.provisionUpload(context); throw new Error('RESPONSE_LOST'); }
  }
  try {
    const provider=new LostResponseMock(new MockMediaStorage(f.root),f.repo);const service=new MediaService(f.repo,registry(provider,()=> 'mock'));
    await assert.rejects(service.reserve(OWNER,f.input),/RESPONSE_LOST/);
    const recovered=await service.reserve(OWNER,f.input); assert.equal(recovered.result.session.state,'uploading'); assert.equal(creates,1);
  } finally {delete process.env.MEDIA_AUXILIARY_PROVIDER;await f.db.close();await rm(f.root,{recursive:true,force:true});}
});
test('4.1 concurrent reserve status elects one creation and one idempotent replay',async()=>{
 const {serviceHarness}=await import('./service-harness');const h=await serviceHarness();try{
 const {randomUUID}=await import('node:crypto');const draft=await h.repo.uploadCommand(OWNER,'create_draft',{purpose:'title'}) as {id:string;revision:number};
 const input={...h.input,draft_id:draft.id,revision:draft.revision,idempotency_key:randomUUID()};
 const results=await Promise.all([h.service.reserve(OWNER,input),h.service.reserve(OWNER,input)]);
 assert.deepEqual(results.map(r=>r.created).sort(),[false,true]);assert.equal(results[0]!.result.asset.mediaId,results[1]!.result.asset.mediaId);
 }finally{await h.close();}
});
