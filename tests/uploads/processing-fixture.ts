import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {database} from './database';
import {UploadRepository} from '../../lib/uploads/repository';
import type {UploadSession,MediaAsset} from '../../lib/uploads/types';
import type {ProcessingStorage} from '../../lib/uploads/processing-worker';
export function fixtureRepository(db:Awaited<ReturnType<typeof database>>,loseReadyResponse=false) {
 return {
  session:async(id:string)=>(await db.query<UploadSession>('SELECT * FROM gma_upload_sessions WHERE id=$1',[id])).rows[0]!,
  asset:async(id:string)=>(await db.query<MediaAsset>('SELECT * FROM gma_media_assets WHERE id=$1',[id])).rows[0]!,
  video:async(owner:string,action:string,input:unknown)=>{
   const result=(await db.query<{r:unknown}>('SELECT gma_video_command($1,$2,$3::jsonb) r',[owner,action,JSON.stringify(input)])).rows[0]!.r;
   if(action==='ready'&&loseReadyResponse){loseReadyResponse=false;throw new Error('SQL committed but response lost');}return result;
  },
  jobLease:async(id:string)=>(await db.query('SELECT state,lease_owner,lease_until FROM gma_upload_jobs WHERE id=$1',[id])).rows[0]??null,
  claimSession:async(id:string|null,kind:string|null,worker:string)=>(await db.query<{j:unknown}>('SELECT to_jsonb(gma_upload_claim_session_job($1,$2,$3,120)) j',[id,kind,worker])).rows[0]!.j,
  finishJob:async(id:string,worker:string,success:boolean,error?:string,retry?:string)=>{await db.query('SELECT gma_upload_finish_job($1,$2,$3,$4,$5)',[id,worker,success,error??null,retry??null]);}
 } as unknown as UploadRepository;
}
export class MemoryProcessingStorage implements ProcessingStorage {
 objects=new Map<string,Buffer>();deleted:string[]=[];constructor(private s:UploadSession,private source:Buffer){this.objects.set(s.object_key!,source);}
 async verifyObject(){return {complete:true,receivedBytes:this.source.length,etag:'source-etag'};}
 async read(key:string){const buffer=this.objects.get(key)!;return {Body:(async function*(){for(let i=0;i<buffer.length;i+=1024*64)yield buffer.subarray(i,i+1024*64);})()};}
 async retainOriginal(s:UploadSession){const key='media/'+s.asset_id+'/original/source';this.objects.set(key,this.source);return key;}
 async put(key:string,body:Uint8Array){this.objects.set(key,Buffer.from(body));}
 async verifyOutput(key:string,size:number,sha:string){const body=this.objects.get(key)!;assert.equal(body.length,size);assert.equal(createHash('sha256').update(body).digest('hex'),sha);}
 async deletePrefix(prefix:string){this.deleted.push(prefix);for(const key of this.objects.keys())if(key.startsWith(prefix))this.objects.delete(key);}
}
