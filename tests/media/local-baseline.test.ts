import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const baselinePath=process.env.MEDIA_LOCAL_BASELINE_SQL??path.resolve('infrastructure/media-local/baseline.sql');
// Test-double only. The deployable baseline never creates Supabase Auth objects.
const testAuth=`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 INSERT INTO auth.users VALUES('${OWNER}'),('${OTHER}');`;
const migrations=[
 '20261005_upload_engine_v2.sql','20261006_upload_engine_r2_first.sql','20261007_r2_capacity.sql',
 '202610080001_media_provider_neutral.sql','202610080002_media_commands.sql',
 '202610080003_media_publish_lifecycle.sql','2026100800031_media_title_lifecycle.sql',
 '202610080004_media_delivery_security.sql','202610080005_media_coordination.sql','202610080006_media_gateway.sql',
 '202610080007_media_gateway_grants.sql','202610080008_title_writes_server_only.sql',
];

async function fixture():Promise<PGlite>{
 const db=new PGlite();
 try{
  await db.exec(testAuth);
  await db.exec(await readFile(baselinePath,'utf8'));
  for(const migration of migrations) await db.exec(await readFile(path.resolve('supabase/migrations',migration),'utf8'));
  await db.exec(`INSERT INTO profiles(id,display_name) VALUES('${OWNER}','A'),('${OTHER}','B');
   INSERT INTO creator_profiles(user_id,creator_name,studio_name) VALUES('${OWNER}','Creator A','Studio A');
   INSERT INTO sub_profiles(id,user_id,name,avatar_id,color) VALUES('p_${OWNER}','${OWNER}','A','profile_01','#22B16B');
   INSERT INTO creator_public_profiles(slug,user_id,nombre,titulos) VALUES('fixture-creator','${OWNER}','A',ARRAY['fixture-legacy']);
   INSERT INTO artistas(slug,name) VALUES('fixture-creator','A'); INSERT INTO colecciones(slug,name) VALUES('drama','Drama');
   INSERT INTO peliculas(slug,title,creator_user_id,r2_video_url,thumbnail_url,status,file_size_bytes,youtube_url,source_page)
   VALUES('fixture-legacy','Legacy','${OWNER}','http://127.0.0.1:4319/fixtures/legacy.mp4','http://127.0.0.1:4319/fixtures/legacy.poster.webp','published',100,NULL,'fixture'),
         ('fixture-private','Private','${OWNER}',NULL,NULL,'unpublished',NULL,NULL,'fixture');
   INSERT INTO peliculas_artistas SELECT p.id,a.id FROM peliculas p CROSS JOIN artistas a WHERE p.slug='fixture-legacy';
   INSERT INTO peliculas_colecciones SELECT p.id,c.id FROM peliculas p CROSS JOIN colecciones c WHERE p.slug='fixture-legacy';
   INSERT INTO view_history(user_id,profile_id,pelicula_id,last_position)
     SELECT '${OWNER}','p_${OWNER}',id,2 FROM peliculas WHERE slug='fixture-legacy';`);
  return db;
 }catch(error){await db.close();throw error;}
}

test('local baseline requires real Auth-owned objects and never creates them',async()=>{
 const sql=await readFile(baselinePath,'utf8');
 assert.doesNotMatch(sql,/CREATE\s+(?:SCHEMA\s+auth|ROLE\s+(?:anon|authenticated|service_role)|TABLE\s+auth\.users|FUNCTION\s+auth\.uid)/i);
 assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDROP\s+TABLE\b/i);
 const db=new PGlite();try{await assert.rejects(db.exec(sql),/MEDIA_LOCAL_AUTH_STACK_REQUIRED/);}finally{await db.close();}
});

test('actual catalog/Studio/profile/progress queries and numeric FKs fit local baseline',async()=>{
 const db=await fixture();try{
  const catalogue=await db.query<{slug:string;youtube_url:string|null;thumbnail_url:string;created_at:string;name:string}>(`
   SELECT p.slug,p.youtube_url,p.thumbnail_url,p.created_at,c.name,a.name AS artist
   FROM peliculas p JOIN peliculas_colecciones pc ON pc.pelicula_id=p.id JOIN colecciones c ON c.id=pc.coleccion_id
   JOIN peliculas_artistas pa ON pa.pelicula_id=p.id JOIN artistas a ON a.id=pa.artista_id
   WHERE p.status='published' OR p.status IS NULL ORDER BY p.created_at DESC`);
  assert.equal(catalogue.rows.length,1);assert.equal(catalogue.rows[0]?.slug,'fixture-legacy');
  await db.query('SELECT creator_name,studio_name,bio,location,role,avatar_url,social_links FROM creator_profiles WHERE user_id=$1',[OWNER]);
  await db.query('SELECT slug,title,synopsis,year,duration,genre,language,r2_poster_url,created_at,status FROM peliculas WHERE creator_user_id=$1',[OWNER]);
  await db.query('SELECT display_name,avatar_color FROM profiles WHERE id=$1',[OWNER]);
  await db.query('SELECT id,name,avatar_id,color,is_kids,require_pin,pin,autoplay FROM sub_profiles WHERE user_id=$1 ORDER BY created_at',[OWNER]);
  await db.query('SELECT slug,approval_score FROM film_scores');
  const film=(await db.query<{id:number}>('SELECT id FROM peliculas WHERE slug=$1',['fixture-legacy'])).rows[0]!;
  await db.query(`INSERT INTO view_history(user_id,profile_id,pelicula_id,last_position,completed)
   VALUES($1,$2,$3,7,true) ON CONFLICT(user_id,profile_id,pelicula_id)
   DO UPDATE SET last_position=EXCLUDED.last_position,completed=EXCLUDED.completed`,[OWNER,`p_${OWNER}`,film.id]);
  const progress=await db.query<{pelicula_id:number;last_position:number;completed:boolean}>(
   'SELECT pelicula_id,last_position,completed,last_watched_at FROM view_history WHERE user_id=$1 AND profile_id=$2',[OWNER,`p_${OWNER}`]);
  assert.equal(progress.rows.length,1);assert.equal(progress.rows[0]?.last_position,7);assert.equal(progress.rows[0]?.completed,true);
  const fk=await db.query<{relation:string;target:string}>(`SELECT conrelid::regclass::text AS relation,confrelid::regclass::text AS target
   FROM pg_constraint WHERE contype='f' AND conrelid IN('peliculas_artistas'::regclass,'peliculas_colecciones'::regclass)`);
  assert.equal(fk.rows.length,4);
 }finally{await db.close();}
});

test('local fixture RLS separates private profiles/progress while retaining public catalog and creator pages',async()=>{
 const db=await fixture();try{
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[OTHER]);await db.exec('SET ROLE authenticated');
  assert.equal((await db.query('SELECT id FROM profiles WHERE id=$1',[OWNER])).rows.length,0);
  assert.equal((await db.query('SELECT id FROM sub_profiles WHERE user_id=$1',[OWNER])).rows.length,0);
  assert.equal((await db.query('SELECT pelicula_id FROM view_history WHERE user_id=$1',[OWNER])).rows.length,0);
  assert.equal((await db.query('SELECT slug FROM peliculas')).rows.length,1);
  assert.equal((await db.query('SELECT slug FROM creator_public_profiles')).rows.length,1);
  await assert.rejects(db.query('INSERT INTO profiles(id,display_name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name',[OWNER,'Intruder']),/row-level security/);
  await assert.rejects(db.query('SELECT * FROM gma_media_local_fixture'),/permission denied/);
  await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[OWNER]);await db.exec('SET ROLE authenticated');
  assert.equal((await db.query('SELECT slug FROM peliculas')).rows.length,2);
  await assert.rejects(db.query('INSERT INTO peliculas(slug,title,creator_user_id,status) VALUES($1,$2,$3,$4)',['bypass','Bypass',OWNER,'published']),/permission denied/);
  await assert.rejects(db.query('UPDATE peliculas SET status=$1 WHERE creator_user_id=$2',['published',OWNER]),/permission denied/);
  await assert.rejects(db.query('DELETE FROM peliculas WHERE creator_user_id=$1',[OWNER]),/permission denied/);
 }finally{await db.close();}
});

test('fixture inventory enables the local gate once and preserves neutral reservations on reseed',async()=>{
 const db=await fixture();try{
  const initial=await db.query<{result:{legacy_bytes:number;inventory_verified:boolean}}>('SELECT gma_media_local_inventory() AS result');
  assert.equal(initial.rows[0]?.result.legacy_bytes,100);assert.equal(initial.rows[0]?.result.inventory_verified,true);
  await db.exec("UPDATE gma_upload_quota SET used_bytes=used_bytes+10,reserved_bytes=50 WHERE account_key='global'");
  await db.query('SELECT gma_media_local_inventory()');
  const quotas=await db.query<{used_bytes:number;reserved_bytes:number}>("SELECT used_bytes,reserved_bytes FROM gma_upload_quota WHERE account_key='global'");
  assert.equal(quotas.rows[0]?.used_bytes,110);assert.equal(quotas.rows[0]?.reserved_bytes,50);
  await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT gma_media_local_inventory()'),/permission denied/);await db.exec('RESET ROLE');
  await db.exec("UPDATE peliculas SET file_size_bytes=101 WHERE slug='fixture-legacy'");
  await assert.rejects(db.query('SELECT gma_media_local_inventory()'),/MEDIA_LOCAL_INVENTORY_CHANGED/);
  await db.exec("UPDATE peliculas SET r2_video_url='https://remote.example/video.mp4' WHERE slug='fixture-legacy'");
  await assert.rejects(db.query('SELECT gma_media_local_inventory()'),/MEDIA_LOCAL_INVENTORY_UNVERIFIED/);
 }finally{await db.close();}
});
