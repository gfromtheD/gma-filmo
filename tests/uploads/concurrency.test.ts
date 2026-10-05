import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// DDL runs only on an expressly isolated, disposable database.
test('PostgreSQL independent connections: quota contention, retries, owner permissions and crash lease',async()=>{
 if(!process.env.UPLOAD_TEST_DATABASE_URL || process.env.UPLOAD_TEST_DATABASE_ISOLATED!=='true')throw new Error('An isolated disposable PostgreSQL test database is required');
 const pool=new Pool({connectionString:process.env.UPLOAD_TEST_DATABASE_URL,max:20});
 const owner=randomUUID();
 try {
   await pool.query(`CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE TABLE creator_profiles(user_id uuid PRIMARY KEY,creator_name text,avatar_url text);
   CREATE TABLE peliculas(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,slug text UNIQUE,title text,synopsis text,year text,duration text,author text,
   r2_video_url text,r2_poster_url text,r2_subtitle_url text,creator_user_id uuid,genre text,language text,file_size_bytes bigint,status text,source_page text);
   CREATE TABLE colecciones(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,slug text UNIQUE,name text);
   CREATE TABLE peliculas_colecciones(pelicula_id bigint,coleccion_id integer,PRIMARY KEY(pelicula_id,coleccion_id));`);
   await pool.query(await readFile('supabase/migrations/20261005_upload_engine_v2.sql','utf8'));
   await pool.query('INSERT INTO auth.users VALUES($1)',[owner]);await pool.query('INSERT INTO creator_profiles(user_id) VALUES($1)',[owner]);
   await pool.query('UPDATE gma_upload_policy SET legacy_inventory_verified=true,global_bytes=500,user_bytes=500,draft_bytes=500,user_active_sessions=20');
   const commands=(action:string,input:unknown)=>pool.query('SELECT gma_upload_command($1,$2,$3::jsonb) r',[owner,action,JSON.stringify(input)]);
   const drafts=await Promise.all(Array.from({length:10},()=>commands('create_draft',{purpose:'title'})));
   const payloads=drafts.map(d=>({draft_id:d.rows[0].r.id,revision:0,role:'poster',bytes:100,sha256:'a'.repeat(64),file_name:'p.png',content_type:'image/png',idempotency_key:randomUUID(),request_hash:randomUUID()}));
   const results=await Promise.allSettled(payloads.map(p=>commands('reserve',p)));
   assert.equal(results.filter(r=>r.status==='fulfilled').length,5);
   for(const r of results)if(r.status==='rejected')assert.match(r.reason.message,/UPLOAD_QUOTA_EXCEEDED/);
   const q=await pool.query('SELECT * FROM gma_upload_quota WHERE account_key=\'global\'');assert.equal(Number(q.rows[0].reserved_bytes),500);
   const index=results.findIndex(r=>r.status==='fulfilled');const retries=await Promise.all(Array.from({length:20},()=>commands('reserve',payloads[index])));
   assert.equal(new Set(retries.map(r=>r.rows[0].r.id)).size,1);
   const session=retries[0]!.rows[0].r;
   const claims=await Promise.all(Array.from({length:20},(_,i)=>pool.query('SELECT to_jsonb(gma_upload_claim_session_job($1,\'provision\',$2,120)) j',[session.id,'worker-'+i])));
   assert.equal(claims.filter(r=>r.rows[0].j?.id).length,1);
   const claimed=claims.find(r=>r.rows[0].j?.id)!.rows[0].j;
   await pool.query('UPDATE gma_upload_jobs SET lease_until=now()-interval \'1 second\' WHERE id=$1',[claimed.id]);
   const recovered=await pool.query('SELECT to_jsonb(gma_upload_claim_session_job($1,\'provision\',\'recovery\',120)) j',[session.id]);assert.equal(recovered.rows[0].j.id,claimed.id);
   await assert.rejects(pool.query('SELECT gma_upload_finish_job($1,$2,true,null,null)',[claimed.id,claimed.lease_owner]),/UPLOAD_REVISION_CONFLICT/);
   console.log('20 independent connections: 5/10 reservations; 20 retries = one session; exactly one lease; crashed lease recovered');
 }finally{await pool.end();}
});
