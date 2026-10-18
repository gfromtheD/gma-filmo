import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertLocalSeedOptions, seedLocal, MEDIA_LOCAL_PROJECT_ID, MEDIA_LOCAL_SUPABASE_URL, type LocalSeedOptions } from '../../scripts/media/local-seed';

const options:LocalSeedOptions={url:MEDIA_LOCAL_SUPABASE_URL,projectId:MEDIA_LOCAL_PROJECT_ID,
 serviceRoleKey:'local-test-service-key',anonKey:'local-test-anon-key',password:'Local-Test-Password-2026'};
const reply=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('seed rejects remote, credentials in URL, wrong local project and weak credentials before I/O',()=>{
 for(const url of ['https://production.supabase.co','http://localhost:54341','http://127.0.0.1:54342',
  'http://admin:password@127.0.0.1:54341','http://127.0.0.1:54341/?remote=true']){
  assert.throws(()=>assertLocalSeedOptions({...options,url}),/MEDIA_LOCAL_ONLY/);
 }
 assert.throws(()=>assertLocalSeedOptions({...options,projectId:'remote-linked-project'}),/MEDIA_LOCAL_ONLY/);
 assert.throws(()=>assertLocalSeedOptions({...options,password:'short'}),/MEDIA_LOCAL_CREDENTIALS_REQUIRED/);
 assert.doesNotThrow(()=>assertLocalSeedOptions(options));
});

test('seed validates the private fixture marker before Auth or catalog mutations',async()=>{
 const calls:string[]=[];
 const transport:typeof fetch=async(input,init)=>{
  calls.push(`${init?.method??'GET'} ${new URL(String(input)).pathname}`);
  return reply([{project_id:'other-project'}]);
 };
 await assert.rejects(seedLocal({...options,fetch:transport}),/MEDIA_LOCAL_FIXTURE_REQUIRED/);
 assert.deepEqual(calls,['GET /rest/v1/gma_media_local_fixture']);
});

test('seed refuses to take over an existing email without its fixture metadata',async()=>{
 const calls:string[]=[];
 const transport:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(`${init?.method??'GET'} ${url.pathname}`);
  if(url.pathname==='/rest/v1/gma_media_local_fixture')return reply([{project_id:MEDIA_LOCAL_PROJECT_ID}]);
  return reply({users:[{id:'11111111-1111-4111-8111-111111111111',email:'gma.creator-a@example.invalid',user_metadata:{}}]});
 };
 await assert.rejects(seedLocal({...options,fetch:transport}),/MEDIA_LOCAL_USER_COLLISION/);
 assert.deepEqual(calls,['GET /rest/v1/gma_media_local_fixture','GET /auth/v1/admin/users']);
});

test('seed contract double is idempotent by emails/slugs and checks signIn/profile/catalog calls',async()=>{
 // This is a contract double, not certification of Supabase Auth/PostgREST.
 const users:Record<string,unknown>[]=[];
 const tables=new Map<string,Record<string,unknown>[]>();
 const calls:string[]=[];let nextId=1;
 const bytes=(await readFile('tests/media/fixtures/hls/legacy.mp4')).length;
 const transport:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,MEDIA_LOCAL_SUPABASE_URL);assert.equal(init?.redirect,'error');
  const method=init?.method??'GET';calls.push(`${method} ${url.pathname}`);
  const body=init?.body?JSON.parse(String(init.body)) as unknown:null;
  if(url.pathname==='/rest/v1/gma_media_local_fixture')return reply([{project_id:MEDIA_LOCAL_PROJECT_ID}]);
  if(url.pathname==='/auth/v1/admin/users'&&method==='GET')return reply({users});
  if(url.pathname==='/auth/v1/admin/users'&&method==='POST'){
   const value=body as Record<string,unknown>;const suffix=String(nextId++).padStart(12,'0');
   const user={...value,id:`11111111-1111-4111-8111-${suffix}`};users.push(user);return reply(user);
  }
  if(url.pathname.startsWith('/auth/v1/admin/users/')&&method==='PUT'){
   const user=users.find(value=>value.id===url.pathname.split('/').at(-1));assert.ok(user);return reply(user);
  }
  if(url.pathname==='/auth/v1/token'){
   const value=body as Record<string,unknown>;const user=users.find(entry=>entry.email===value.email);assert.ok(user);
   return reply({user,access_token:`contract-token-${String(user.id)}`});
  }
  if(url.pathname==='/rest/v1/rpc/gma_media_local_inventory')return reply({project_id:MEDIA_LOCAL_PROJECT_ID,inventory_verified:true,legacy_bytes:bytes});
  const table=url.pathname.split('/').at(-1)!;
  const rows=tables.get(table)??[];tables.set(table,rows);
  if(method==='POST'){
   assert.ok(Array.isArray(body));const conflicts=(url.searchParams.get('on_conflict')??'id').split(',');
   const written:Record<string,unknown>[]=[];
   for(const value of body as Record<string,unknown>[]){
    let row=rows.find(entry=>conflicts.every(key=>entry[key]===value[key]));
    if(!row){row={...value};if(!('id'in row)&&['peliculas','artistas','colecciones'].includes(table))row.id=rows.length+1;rows.push(row);}
    else Object.assign(row,value);
    written.push(row);
   }
   return reply(written);
  }
  if(table==='film_scores')return reply([{slug:'media-local-legacy-mp4',approval_score:null}]);
  const headers=new Headers(init?.headers);
  const token=headers.get('authorization')?.replace('Bearer contract-token-','');
  let filtered=rows.filter(row=>{
   for(const [key,value] of url.searchParams)if(value.startsWith('eq.')&&String(row[key])!==value.slice(3))return false;
   if(['profiles','sub_profiles','view_history','creator_profiles'].includes(table)&&row[table==='profiles'?'id':'user_id']!==token)return false;
   return true;
  });
  if(table==='peliculas')filtered=filtered.map(row=>({...row,peliculas_colecciones:[{colecciones:{name:'Drama',slug:'drama'}}],
   peliculas_artistas:[{artistas:{name:'Creador local A',slug:'media-local-creator-a',r2_photo_url:null}}]}));
  return reply(filtered);
 };
 const first=await seedLocal({...options,fetch:transport});
 const second=await seedLocal({...options,fetch:transport});
 assert.deepEqual(first,second);assert.equal(users.length,3);assert.equal(tables.get('peliculas')?.length,1);
 assert.equal(tables.get('profiles')?.length,3);assert.equal(tables.get('sub_profiles')?.length,3);
 assert.equal(tables.get('creator_profiles')?.length,2);assert.equal(tables.get('creator_public_profiles')?.length,2);
 assert.equal(tables.get('view_history')?.length,6);assert.equal(first.legacyBytes,bytes);
 assert.equal(calls.filter(call=>call==='POST /auth/v1/token').length,6);
 assert.equal(calls.filter(call=>call==='POST /auth/v1/admin/users').length,3);
 assert.equal(calls.filter(call=>call.startsWith('PUT /auth/v1/admin/users/')).length,0,'idempotent reseed must not revoke existing Auth sessions');
 assert.ok(first.users.every(user=>user.subProfileId===`p_${user.id}`&&user.primaryProfileId===''));
});
