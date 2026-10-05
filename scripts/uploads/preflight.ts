import { Client } from 'pg';
import { getUploadConfig,getStreamConfig,requiredEnv } from '../../lib/uploads/config';
import {S3Client,GetBucketCorsCommand,GetBucketLifecycleConfigurationCommand} from '@aws-sdk/client-s3';
const configKeys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','UPLOAD_ENVIRONMENT','UPLOAD_R2_PRIVATE_BUCKET','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_STREAM_API_TOKEN','CLOUDFLARE_STREAM_CUSTOMER_CODE','CLOUDFLARE_STREAM_WEBHOOK_SECRET','CLOUDFLARE_STREAM_SIGNING_KEY_ID','CLOUDFLARE_STREAM_SIGNING_KEY_PEM','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','UPLOAD_EXECUTOR_SECRET','SUPABASE_DB_URL','VIDEO_WORK_DIR','VIDEO_SANDBOX','VIDEO_PROVIDER'];
async function main(){
 const report:Record<string,unknown>={admissionEnabled:process.env.UPLOAD_ENGINE_V2==='true',browserEnabled:process.env.NEXT_PUBLIC_UPLOAD_ENGINE_V2==='true',provider:process.env.VIDEO_PROVIDER??'r2',processingEnabled:process.env.VIDEO_PROCESSING_ENABLED==='true',streamRequired:process.env.VIDEO_PROVIDER==='stream',variables:Object.fromEntries(configKeys.map(key=>{try{requiredEnv(key);return [key,'present (not authenticated)'];}catch{return[key,'missing'];}}))};
 try{getUploadConfig();report.config='valid';}catch(e){report.config=e instanceof Error?e.message:'invalid';}
 if(process.env.SUPABASE_DB_URL){const db=new Client({connectionString:requiredEnv('SUPABASE_DB_URL')});try {
 await db.connect();await db.query('BEGIN READ ONLY');
 report.columns=(await db.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND (table_name IN ('peliculas','creator_profiles','colecciones','peliculas_colecciones') OR table_name LIKE 'gma_%') ORDER BY table_name,ordinal_position`)).rows;
 report.constraints=(await db.query(`SELECT conrelid::regclass::text table_name,conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid IN (to_regclass('public.peliculas'),to_regclass('public.creator_profiles')) OR conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'gma_%')`)).rows;
 report.rls=(await db.query(`SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND (tablename LIKE 'gma_%' OR tablename IN ('peliculas','creator_profiles'))`)).rows;
 report.enginePolicy=(await db.query('SELECT * FROM gma_upload_policy')).rows;
 report.videoMetrics=(await db.query('SELECT transfer_state,media_state,count(*),sum(original_bytes) original_bytes,sum(processed_bytes) processed_bytes FROM gma_video_metrics GROUP BY transfer_state,media_state')).rows;
 report.processingAttempts=(await db.query('SELECT state,count(*),sum(processing_ms) processing_ms,sum(temporary_bytes) temporary_bytes FROM gma_processing_attempts GROUP BY state')).rows;
 report.jobCounts=(await db.query('SELECT state,count(*) FROM gma_upload_jobs GROUP BY state')).rows;
 await db.query('ROLLBACK');
 }catch(e){report.database=e instanceof Error?e.message:'unavailable';}finally{await db.end();}}
 if(process.env.UPLOAD_PREFLIGHT_PROVIDERS==='true'){
 try {
 const config=getUploadConfig();const s3=new S3Client({region:'auto',endpoint:'https://'+config.accountId+'.r2.cloudflarestorage.com',credentials:{accessKeyId:requiredEnv('R2_ACCESS_KEY_ID'),secretAccessKey:requiredEnv('R2_SECRET_ACCESS_KEY')}});
 report.r2Cors=(await s3.send(new GetBucketCorsCommand({Bucket:config.bucket}))).CORSRules;
 report.r2Lifecycle=(await s3.send(new GetBucketLifecycleConfigurationCommand({Bucket:config.bucket}))).Rules;
 if(process.env.STREAM_PROVIDER_ENABLED==='true'){
 const stream=getStreamConfig();
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+config.accountId+'/stream/webhook',{headers:{Authorization:'Bearer '+stream.streamToken},signal:AbortSignal.timeout(15000)});
 // Never print webhook signing secrets returned by the provider.
 const data=await response.json() as {result?:{notificationUrl?:string};success?:boolean};
 report.streamWebhook={httpStatus:response.status,success:data.success,url:data.result?.notificationUrl};}
 else report.stream='optional, disabled';
 }catch(e){report.providers=e instanceof Error?e.message:'unavailable';}
 }
 console.log(JSON.stringify(report,null,2));
}
void main();
