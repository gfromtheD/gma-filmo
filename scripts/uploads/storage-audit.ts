import {Client} from 'pg';
import {ListObjectsV2Command,ListMultipartUploadsCommand} from '@aws-sdk/client-s3';
import {getUploadConfig,requiredEnv} from '../../lib/uploads/config';
import {R2VideoProvider} from '../../lib/uploads/r2-video';
import {classifyStorage,type StoredObject} from '../../lib/uploads/storage-inventory';
import type {UploadSession,MediaAsset} from '../../lib/uploads/types';
async function main(){
 const config=getUploadConfig(),r2=new R2VideoProvider(config.bucket),db=new Client({connectionString:requiredEnv('SUPABASE_DB_URL')});
 await db.connect();try {
  await db.query('BEGIN READ ONLY');
  const sessions=(await db.query<UploadSession>("SELECT * FROM gma_upload_sessions WHERE provider='r2' AND max_duration_seconds>0")).rows;
  const assets=(await db.query<MediaAsset>("SELECT * FROM gma_media_assets WHERE provider='r2' AND role IN ('main','trailer','intro','extras')")).rows;
  const active=(await db.query<{output_prefix:string}>("SELECT pa.output_prefix FROM gma_processing_attempts pa JOIN gma_upload_jobs j ON j.id=pa.job_id WHERE j.state='running' AND j.lease_until>now() AND j.attempts=pa.attempt")).rows.map(p=>p.output_prefix);
  const objects:StoredObject[]=[];
  for(const prefix of ['ingest/','media/']){let token:string|undefined;do {
   const page=await r2.client.send(new ListObjectsV2Command({Bucket:config.bucket,Prefix:prefix,ContinuationToken:token}),{abortSignal:AbortSignal.timeout(30000)});
   for(const o of page.Contents??[])if(o.Key)objects.push({key:o.Key,bytes:o.Size??0});
   if(!page.IsTruncated)break;if(!page.NextContinuationToken)throw new Error('R2_INVENTORY_PAGINATION');token=page.NextContinuationToken;
  }while(true);}
  let open=0,keyMarker:string|undefined,uploadIdMarker:string|undefined;do {
   const page=await r2.client.send(new ListMultipartUploadsCommand({Bucket:config.bucket,Prefix:'ingest/',KeyMarker:keyMarker,UploadIdMarker:uploadIdMarker}),{abortSignal:AbortSignal.timeout(30000)});
   open+=(page.Uploads??[]).length;if(!page.IsTruncated)break;if(!page.NextKeyMarker)throw new Error('R2_INVENTORY_PAGINATION');keyMarker=page.NextKeyMarker;uploadIdMarker=page.NextUploadIdMarker;
  }while(true);
  const quota=(await db.query(`SELECT q.account_key,q.reserved_bytes,COALESCE(sum(l.bytes) FILTER(WHERE NOT s.quota_confirmed AND NOT s.quota_released),0) expected_reserved_bytes,
   q.used_bytes,COALESCE(sum(l.bytes) FILTER(WHERE s.quota_confirmed AND NOT s.quota_released),0) v2_used_bytes
   FROM gma_upload_quota q LEFT JOIN gma_upload_ledger l ON l.account_key=q.account_key AND l.event='reserve'
   LEFT JOIN gma_upload_sessions s ON s.id=l.session_id GROUP BY q.account_key,q.reserved_bytes,q.used_bytes`)).rows;
  console.log(JSON.stringify({...classifyStorage(sessions,assets,objects,active),openMultiparts:open,quota,
   note:'Read-only; snapshots may race transfers. Recheck findings. Used-byte differences can include verified legacy inventory. Never mass-delete historical objects.'},null,2));
  await db.query('ROLLBACK');
 }finally{await db.end();}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'STORAGE_AUDIT_FAILED');process.exitCode=1;});
