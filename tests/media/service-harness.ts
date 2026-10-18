import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { database, OWNER } from './database';
import { serviceRepository } from './service-fixture';
import { MediaService } from '../../lib/media/service';
import { MediaProviderRegistry } from '../../lib/media/registry';
import { MockMediaProvider } from '../../lib/media/providers/mock';
import { mockJobProcessor } from '../../lib/media/jobs';
import { MockMediaStorage } from '../../lib/media/mock-storage';
export async function serviceHarness(bytes=Buffer.from('durable local bytes')) {
  const db=await database();await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');
  const repo=serviceRepository(db);const root=await mkdtemp(path.join(os.tmpdir(),'gma-service-'));
  const storage=new MockMediaStorage(root);const provider=new MockMediaProvider(storage,repo);
  const registry=new MediaProviderRegistry({mock:()=>provider,r2:()=>{throw new Error('R2_NOT_EXPECTED');},stream:()=>{throw new Error('STREAM_NOT_EXPECTED');},peertube:()=>{throw new Error('PEERTUBE_NOT_EXPECTED');}},()=> 'mock');
  const service=new MediaService(repo,registry,{now:()=>Date.now()},{get:()=>mockJobProcessor(storage,{now:()=>Date.now(),async wait(){}})});
  const draft=await repo.uploadCommand(OWNER,'create_draft',{purpose:'title'}) as {id:string;revision:number};
  const input={draft_id:draft.id,revision:draft.revision,role:'main',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),file_name:'film.mp4',content_type:'video/mp4',idempotency_key:randomUUID()};
  const reserved=await service.reserve(OWNER,input); const id=reserved.result.session.sessionId;
  return {db,repo,root,storage,provider,registry,service,input,id,bytes,async ingest() {
    const ctx=await service.context(id,OWNER);await repo.claimTransfer(OWNER,id,1,'writer-test');
    await provider.writeChunk(await service.context(id,OWNER),{startByte:0,endByte:bytes.length-1,sha256:input.sha256,bytes});
    await db.query('SELECT gma_media_transfer_release($1,$2,1,$3,1)',[OWNER,id,'writer-test']);
  },async close(){await db.close();await rm(root,{recursive:true,force:true});}};
}
