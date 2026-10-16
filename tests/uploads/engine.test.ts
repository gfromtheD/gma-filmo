import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {database,command,OWNER,OTHER} from './database';
import {streamObservation,verifyStreamSignature,StreamProvider} from '../../lib/uploads/stream';
import {normalizeSubtitles} from '../../lib/uploads/auxiliary';
import {clientState,moveQueueItem,sameSource} from '../../lib/uploads/client-models';
import type {UploadDraft,UploadSession} from '../../lib/uploads/types';
const SHA='a'.repeat(64);
async function setup(){const db=await database();await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified=true');return db;}
async function draft(db:Awaited<ReturnType<typeof database>>,purpose='title'){return command<UploadDraft>(db,'create_draft',{purpose});}
async function reserve(db:Awaited<ReturnType<typeof database>>,d:UploadDraft,role='main',bytes=100,key=randomUUID()){
 return command<UploadSession>(db,'reserve',{draft_id:d.id,revision:d.revision,role,bytes,video_provider:'stream',sha256:SHA,file_name:'movie.mp4',content_type:'video/mp4',idempotency_key:key,request_hash:key});
}
async function ready(db:Awaited<ReturnType<typeof database>>,s:UploadSession){
 await command(db,'bind',{session_id:s.id,provider_ref:randomUUID(),provider_data:{}});
 return command(db,'observe',{session_id:s.id,state:'ready',received_bytes:s.expected_input_bytes,duration_seconds:100,pct_complete:100,ready_to_stream:true,delivery_path:s.provider==='r2'?'/api/media/'+s.asset_id:undefined});
}
test('migration additive, inventory gate and legacy preserved',async()=>{const db=await database();try{
 const d=await draft(db);await assert.rejects(reserve(db,d),/UPLOAD_LEGACY_INVENTORY_REQUIRED/);
 const rows=await db.query<{r2_video_url:string;playback_kind:string}>('SELECT * FROM peliculas WHERE slug=\'legacy\'');
 assert.equal(rows.rows[0]?.r2_video_url,'https://legacy.example/video.mp4');assert.equal(rows.rows[0]?.playback_kind,'legacy');
}finally{await db.close();}});
test('SUB-R02 atomic draft/owner quota rejects concurrent approvals beyond cap',async()=>{const db=await setup();try{
 const d=await draft(db);const results=await Promise.allSettled([reserve(db,d,'main',4*1024**3),reserve(db,d,'main',4*1024**3)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const current=await command<UploadDraft>(db,'update_draft',{draft_id:d.id,revision:1,metadata:{title:'Test'}});
 await reserve(db,current,'extras',1024**3);current.revision++;
 await reserve(db,current,'trailer',1024**3);current.revision++;
 await db.exec('UPDATE gma_upload_policy SET user_active_sessions=10');
 await assert.rejects(reserve(db,current,'intro',1),/UPLOAD_QUOTA_EXCEEDED/);
 const q=await db.query<{reserved_bytes:number}>('SELECT reserved_bytes FROM gma_upload_quota WHERE account_key=$1',['draft:'+d.id]);assert.equal(Number(q.rows[0]?.reserved_bytes),6*1024**3);
}finally{await db.close();}});
test('SUB-R03 errors fail closed; owner, idempotency, source identity',async()=>{const db=await setup();try{
 const d=await draft(db),key=randomUUID(),s=await reserve(db,d,'main',100,key);
 const retry=await reserve(db,d,'main',100,key);assert.equal(s.id,retry.id);
 await assert.rejects(command(db,'reserve',{draft_id:d.id,revision:1,role:'main',bytes:100,sha256:SHA,file_name:'movie',content_type:'video/mp4',idempotency_key:key,request_hash:'changed'}),/UPLOAD_IDEMPOTENCY_CONFLICT/);
 await assert.rejects(command(db,'cancel',{session_id:s.id},OTHER),/UPLOAD_NOT_FOUND/);
 await assert.rejects(command(db,'reserve',{draft_id:d.id,revision:1,role:'trailer',bytes:100,file_name:'file',content_type:'video/mp4',idempotency_key:randomUUID(),request_hash:'x'}),/UPLOAD_INVALID_INPUT/);
 assert.equal(sameSource(s,SHA,100),true);assert.equal(sameSource(s,'b'.repeat(64),100),false);
}finally{await db.close();}});
test('ready requires tus receipt, duration and numeric pctComplete 100; duplicate observations confirm once',async()=>{const db=await setup();try{
 const d=await draft(db),s=await reserve(db,d);
 await command(db,'bind',{session_id:s.id,provider_ref:randomUUID(),provider_data:{}});
 for(const data of [{received_bytes:99,duration_seconds:100,pct_complete:100,ready_to_stream:true},{received_bytes:100,pct_complete:100,ready_to_stream:true},{received_bytes:100,duration_seconds:100,pct_complete:99,ready_to_stream:true}]){
   await assert.rejects(command(db,'observe',{session_id:s.id,state:'ready',...data}),/UPLOAD_INVALID_INPUT/);
 }
 const data={session_id:s.id,state:'ready',received_bytes:100,duration_seconds:100,pct_complete:100,ready_to_stream:true};
 await command(db,'observe',data);await command(db,'observe',data);
 const q=await db.query<{used_bytes:number;reserved_bytes:number}>('SELECT * FROM gma_upload_quota WHERE account_key=\'global\'');assert.equal(Number(q.rows[0]?.used_bytes),100);assert.equal(Number(q.rows[0]?.reserved_bytes),0);
}finally{await db.close();}});
test('cancel/late response race retains ref, no early quota release, cleanup exactly once',async()=>{const db=await setup();try{
 const d=await draft(db),s=await reserve(db,d,'poster',100);
 await command(db,'cancel',{session_id:s.id});
 const late=await command<UploadSession>(db,'bind',{session_id:s.id,provider_ref:'ingest',provider_data:{}});assert.equal(late.state,'cancelling');
 await assert.rejects(command(db,'delete_confirmed',{session_id:s.id,absent:true}),/UPLOAD_CLEANUP_UNCONFIRMED/);
 await db.query('UPDATE gma_upload_sessions SET expires_at=now()-interval \'1 second\' WHERE id=$1',[s.id]);
 await command(db,'delete_confirmed',{session_id:s.id,absent:true});await command(db,'delete_confirmed',{session_id:s.id,absent:true});
 const q=await db.query<{reserved_bytes:number}>('SELECT * FROM gma_upload_quota WHERE account_key=\'global\'');assert.equal(Number(q.rows[0]?.reserved_bytes),0);
}finally{await db.close();}});
test('publication ready gate, full roles, repeat request, edit, retire and legacy compatibility',async()=>{const db=await setup();try{
 const d=await draft(db);const main=await reserve(db,d);d.revision++;
 const poster=await reserve(db,d,'poster_h');d.revision++;
 await assert.rejects(command(db,'publish',{draft_id:d.id,revision:d.revision,request_hash:'p'}),/UPLOAD_MEDIA_NOT_READY/);
 await ready(db,main);await ready(db,poster);
 await command(db,'update_draft',{draft_id:d.id,revision:d.revision,metadata:{title:'Film',genre:'Drama'}});d.revision++;
 const title=await command<{id:number;slug:string;media_revision:number}>(db,'publish',{draft_id:d.id,revision:d.revision,request_hash:'p'});
 assert.deepEqual(await command(db,'publish',{draft_id:d.id,revision:0,request_hash:'p'}),title);
 const media=await db.query('SELECT * FROM gma_title_media WHERE title_id=$1',[title.id]);assert.equal(media.rows.length,2);
 await assert.rejects(command(db,'cancel',{session_id:main.id}),/UPLOAD_ASSET_IN_USE/);
 await command(db,'edit_title',{slug:title.slug,revision:0,metadata:{title:'Changed',genre:'Terror'}});
 await assert.rejects(command(db,'edit_title',{slug:title.slug,revision:0,metadata:{title:'Stale'}}),/UPLOAD_REVISION_CONFLICT/);
 await command(db,'retire',{slug:title.slug});
 const original=await db.query('SELECT * FROM peliculas WHERE slug=\'legacy\'');assert.equal(original.rows.length,1);
}finally{await db.close();}});
test('owner may read their media session; foreign owner and authenticated writes/private state remain denied',async()=>{const db=await setup();try{
 const d=await draft(db);await reserve(db,d);
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${OTHER}'`);
 assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length,0);
 await db.exec(`SET request.jwt.claim.sub='${OWNER}'`);assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length,1);
 await assert.rejects(db.query('SELECT * FROM gma_media_provider_private'),/permission denied/);
 await assert.rejects(command(db,'cancel',{session_id:randomUUID()}),/permission denied/);
 await assert.rejects(db.query('UPDATE gma_media_assets SET state=\'ready\''),/permission denied/);
 await db.exec('RESET ROLE');
}finally{await db.close();}});
test('jobs exclusive claim, lease fencing, webhook replay dedupe',async()=>{const db=await setup();try{
 const d=await draft(db),s=await reserve(db,d);
 const result=await db.query<{j:{id:string}}>('SELECT to_jsonb(gma_upload_claim_session_job($1,\'provision\',\'worker-a\',120)) j',[s.id]);const job=result.rows[0]!.j;
 const other=await db.query<{j:unknown}>('SELECT to_jsonb(gma_upload_claim_session_job($1,\'provision\',\'worker-b\',120)) j',[s.id]);assert.equal(other.rows[0]?.j,null);
 await assert.rejects(db.query('SELECT gma_upload_finish_job($1,\'worker-b\',true,null,null)',[job.id]),/UPLOAD_REVISION_CONFLICT/);
 await db.query('SELECT gma_upload_finish_job($1,\'worker-a\',true,null,null)',[job.id]);
 await command(db,'bind',{session_id:s.id,provider_ref:'provider1234567890',provider_data:{}});
 const first=await db.query<{ok:boolean}>('SELECT gma_upload_event(\'digest\',\'provider1234567890\') ok');assert.equal(first.rows[0]?.ok,true);
 const replay=await db.query<{ok:boolean}>('SELECT gma_upload_event(\'digest\',\'provider1234567890\') ok');assert.equal(replay.rows[0]?.ok,false);
}finally{await db.close();}});
test('Stream status, authenticated raw-body events, conservative recovery',async()=>{
 assert.equal(streamObservation({uid:'test',readyToStream:true,status:{state:'ready',pctComplete:'100'}}).state,'ready');
 assert.equal(streamObservation({uid:'test',readyToStream:true,status:{state:'ready',pctComplete:'99'}}).state,'processing');
 const raw=Buffer.from('{"uid":"sample"}'),time=String(Math.floor(Date.now()/1000));const sig=createHmac('sha256','secret').update(time+'.').update(raw).digest('hex');
 assert.equal(verifyStreamSignature(raw,`time=${time},sig1=${sig}`,'secret'),true);assert.equal(verifyStreamSignature(Buffer.from('modified'),`time=${time},sig1=${sig}`,'secret'),false);
 assert.equal(verifyStreamSignature(raw,`time=1,sig1=${sig}`,'secret'),false);
 const calls:string[]=[];const provider=new StreamProvider({accountId:'a'.repeat(32),streamToken:'test',streamCustomer:'test'},async(url)=>{calls.push(String(url));throw new Error('lost');});
 await assert.rejects(provider.provision({id:randomUUID(),owner_id:OWNER,expected_input_bytes:10,max_duration_seconds:100,expires_at:new Date().toISOString()} as UploadSession),/STREAM_NETWORK_UNCERTAIN/);assert.equal(calls.length,1);
});
test('queue preserves roles, cancellation wins, subtitles parse UTF8 and timing',()=>{
 const items=[{role:'main',id:1},{role:'trailer',id:2}];assert.deepEqual(moveQueueItem(items,0,1),[items[1],items[0]]);
 assert.equal(clientState({state:'cancelling'} as never,{state:'ready'} as never),'cancelling');
 assert.match(normalizeSubtitles(Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nHola')).toString(),/^WEBVTT/);
 assert.throws(()=>normalizeSubtitles(Buffer.from('junk')),/SUBTITLE_INVALID/);
 assert.throws(()=>normalizeSubtitles(Buffer.from('00:00:02.000 --> 00:00:01.000\nBad')),/SUBTITLE_INVALID/);
});

test('replacement publication preserves the historical MP4 and fences stale metadata',async()=>{const db=await setup();try{
 await db.query('UPDATE peliculas SET creator_user_id=$1 WHERE slug=\'legacy\'',[OWNER]);
 const d=await command<UploadDraft>(db,'create_draft',{purpose:'title',title_slug:'legacy'}),s=await reserve(db,d);d.revision++;
 await ready(db,s);await command(db,'update_draft',{draft_id:d.id,revision:d.revision,metadata:{title:'New version'}});d.revision++;
 const title=await command<{slug:string;r2_video_url:string;playback_kind:string}>(db,'publish',{draft_id:d.id,revision:d.revision,request_hash:'replacement'});
 assert.equal(title.slug,'legacy');assert.equal(title.r2_video_url,'https://legacy.example/video.mp4');assert.equal(title.playback_kind,'stream');
 const stale=await command<UploadDraft>(db,'create_draft',{purpose:'title',title_slug:'legacy'}),next=await reserve(db,stale);stale.revision++;
 await ready(db,next);await command(db,'edit_title',{slug:'legacy',revision:1,metadata:{title:'Updated meanwhile'}});
 await assert.rejects(command(db,'publish',{draft_id:stale.id,revision:stale.revision,request_hash:'stale'}),/UPLOAD_REVISION_CONFLICT/);
}finally{await db.close();}});
test('account deletion keeps ownership until confirmed provider cleanup, then removes durable rows',async()=>{const db=await setup();try{
 const d=await draft(db),s=await reserve(db,d);
 await command(db,'delete_account',{});
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[OWNER]),/foreign key/);
 await assert.rejects(command(db,'purge_account',{}),/UPLOAD_CLEANUP_UNCONFIRMED/);
 await db.query('UPDATE gma_upload_sessions SET expires_at=now()-interval \'1 second\' WHERE id=$1',[s.id]);
 await command(db,'delete_confirmed',{session_id:s.id,absent:true});await command(db,'purge_account',{});
 await db.query('DELETE FROM auth.users WHERE id=$1',[OWNER]);
 assert.equal((await db.query('SELECT * FROM gma_upload_sessions WHERE owner_id=$1',[OWNER])).rows.length,0);
}finally{await db.close();}});
test('unpublished metadata is hidden by restrictive RLS; public legacy titles remain visible',async()=>{const db=await setup();try{
 await db.query('INSERT INTO peliculas(slug,title,status,creator_user_id) VALUES(\'private\',\'Hidden\',\'unpublished\',$1)',[OWNER]);
 await db.exec('SET ROLE anon');const publicRows=await db.query<{slug:string}>('SELECT slug FROM peliculas');assert.deepEqual(publicRows.rows.map(r=>r.slug),['legacy']);await db.exec('RESET ROLE');
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${OWNER}'`);assert.equal((await db.query('SELECT slug FROM peliculas')).rows.length,2);await db.exec('RESET ROLE');
}finally{await db.close();}});
test('observing Stream during an interrupted transfer must not mark it uploaded',async()=>{const db=await setup();try{
 const d=await draft(db),s=await reserve(db,d);
 await command(db,'bind',{session_id:s.id,provider_ref:randomUUID(),provider_data:{uploadUrl:'https://example.invalid/tus'}});
 await command(db,'observe',{session_id:s.id,state:'processing',received_bytes:null,duration_seconds:null});
 const result=await db.query<{state:string}>('SELECT state FROM gma_upload_sessions WHERE id=$1',[s.id]);assert.equal(result.rows[0]?.state,'uploading');
 await command(db,'pause',{session_id:s.id,paused:true});await command(db,'pause',{session_id:s.id,paused:false});
 assert.equal(clientState({...s,state:'uploading'} as never,{state:'processing'} as never),'uploading');
}finally{await db.close();}});
test('subtitles have distinct language slots and reordering preserves asset roles',async()=>{const db=await setup();try{
 const d=await draft(db),first=await reserve(db,d,'subtitles');d.revision++;
 await command(db,'label_subtitle',{session_id:first.id,revision:d.revision,language:'es'});d.revision++;
 const second=await reserve(db,d,'subtitles');d.revision++;
 await assert.rejects(command(db,'label_subtitle',{session_id:second.id,revision:d.revision,language:'es'}),/UPLOAD_SLOT_OCCUPIED/);
 await command(db,'label_subtitle',{session_id:second.id,revision:d.revision,language:'en'});d.revision++;
 await command(db,'reorder',{draft_id:d.id,revision:d.revision,asset_id:first.asset_id,position:1});
 const rows=await db.query<{role:string;language:string}>('SELECT role,language FROM gma_draft_media WHERE draft_id=$1 ORDER BY language',[d.id]);
 assert.deepEqual(rows.rows,[{role:'subtitles',language:'en'},{role:'subtitles',language:'es'}]);
}finally{await db.close();}});
test('a missing quota policy fails closed instead of permitting unbounded reservations',async()=>{const db=await setup();try{
 const d=await draft(db);await db.exec('DELETE FROM gma_upload_policy');await assert.rejects(reserve(db,d),/UPLOAD_POLICY_UNAVAILABLE/);
 assert.equal((await db.query('SELECT * FROM gma_upload_sessions')).rows.length,0);
}finally{await db.close();}});
test('retiring a legacy title abandons its pending replacement and preserves the MP4',async()=>{const db=await setup();try{
 await db.query('UPDATE peliculas SET creator_user_id=$1 WHERE slug=\'legacy\'',[OWNER]);
 const d=await command<UploadDraft>(db,'create_draft',{purpose:'title',title_slug:'legacy'});
 await command(db,'retire',{slug:'legacy'});
 const rows=await db.query<{state:string}>('SELECT state FROM gma_upload_drafts WHERE id=$1',[d.id]);assert.equal(rows.rows[0]?.state,'abandoned');
 const film=await db.query<{r2_video_url:string;status:string}>('SELECT * FROM peliculas WHERE slug=\'legacy\'');assert.equal(film.rows[0]?.status,'unpublished');assert.equal(film.rows[0]?.r2_video_url,'https://legacy.example/video.mp4');
}finally{await db.close();}});
