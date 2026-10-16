/** Restores LOCAL data into a fresh native PostgreSQL cluster; never restores into the live fixture. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, createPrivateKey, createPublicKey, randomUUID } from 'node:crypto';
import { chmod, cp, mkdir, mkdtemp, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Pool, types } from 'pg';
import { localDatabase, localEnvironment } from './local-tools';
import { serviceRepository } from '../../tests/media/service-fixture';
import { MediaService } from '../../lib/media/service';
import { MediaProviderRegistry } from '../../lib/media/registry';
import { MockMediaProvider } from '../../lib/media/providers/mock';
import { MockMediaStorage } from '../../lib/media/mock-storage';
import { mockJobProcessor } from '../../lib/media/jobs';
import { Ed25519MediaCapabilityIssuer } from '../../lib/media/capabilities';
import { createMediaGateway } from '../../lib/media/gateway/server';
import { createGatewayDelivery } from '../../lib/media/gateway/delivery';
import { PlaybackService } from '../../lib/media/playback-service';
import { engineGate } from '../../lib/uploads/http';
import { legacyMediaWritesGate } from '../../lib/media/legacy-writes';

const execute=promisify(execFile);
const tables=['public.peliculas','public.gma_media_assets','public.gma_upload_sessions','public.gma_upload_ledger','public.gma_upload_drafts','public.gma_title_media','public.gma_draft_media','auth.users','auth.identities'];
export async function fingerprint(db:Pool) {
  const result:Record<string,string>={};
  await db.query("SET TIME ZONE 'UTC'");
  for(const table of tables) {
    const rows=await db.query<{ row:unknown }>(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`);
    result[table]=createHash('sha256').update(JSON.stringify(rows.rows)).digest('hex');
  }
  return result;
}
async function securityFingerprint(db:Pool) {
  const permissions=await db.query<{role:string;table_name:string;select:boolean;insert:boolean;update:boolean;delete:boolean}>(
    `SELECT role,table_name,has_table_privilege(role,'public.'||table_name,'SELECT') AS select,
     has_table_privilege(role,'public.'||table_name,'INSERT') AS insert,has_table_privilege(role,'public.'||table_name,'UPDATE') AS update,
     has_table_privilege(role,'public.'||table_name,'DELETE') AS delete
     FROM unnest(ARRAY['anon','authenticated','service_role']) role CROSS JOIN
     unnest(ARRAY['peliculas','gma_media_assets','gma_upload_sessions','gma_media_provider_private','gma_upload_ledger']) AS table_name ORDER BY role,table_name`);
  const functions=await db.query<{role:string;execute:boolean}>(`SELECT role,has_function_privilege(role,'public.gma_media_command(uuid,text,jsonb)','EXECUTE') AS execute
    FROM unnest(ARRAY['anon','authenticated','service_role']) role ORDER BY role`);
  const policies=await db.query(`SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`);
  const rls=await db.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`);
  return {permissions:permissions.rows,functions:functions.rows,policies:policies.rows,rls:rls.rows};
}
async function port() {
  const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const address=probe.address();if(!address||typeof address==='string')throw new Error('LOOPBACK_PORT_REQUIRED');
  await new Promise<void>(resolve=>probe.close(()=>resolve()));return address.port;
}
export async function rollbackLocal() {
  // The disposable native driver must model PostgREST's safe JSON numeric fields.
  const previousInt8=types.getTypeParser(20,'text');
  types.setTypeParser(20,value=>{const number=Number(value);if(!Number.isSafeInteger(number))throw new Error('ROLLBACK_INTEGER_UNSAFE');return number;});
  const environment=await localEnvironment(),source=localDatabase(environment);
  const bin=process.env.PG_BIN_DIR;if(!bin||!path.isAbsolute(bin))throw new Error('LOCAL_PG_BIN_REQUIRED');
  const root=await realpath(process.cwd());await mkdir('work/media-rollback',{recursive:true});
  const copy=await mkdtemp(path.join(root,'work/media-rollback/copy-'));await chmod(copy,0o700);
  const run=async(name:string,args:string[],env:NodeJS.ProcessEnv=process.env)=>{
    try {await execute(path.join(bin,name),args,{env,timeout:120000,maxBuffer:4*1024**2});}
    catch(error:unknown) {
      if(error && typeof error==='object' && 'stderr'in error && typeof error.stderr==='string') {
        const diagnostics=error.stderr.split(/\r?\n/).filter(line=>/^pg_restore: (error|warning):/.test(line));
        await writeFile(path.join(copy,'restore-diagnostics.txt'),diagnostics.join('\n'),{mode:0o600});
      }
      throw new Error(`MEDIA_ISOLATED_${name.toUpperCase()}_FAILED`);
    }
  };
  const original=await fingerprint(source),security=await securityFingerprint(source),sourceUrl=new URL(environment.SUPABASE_DB_URL!);
  const sourceRoles=await source.query<{rolname:string;rolbypassrls:boolean}>("SELECT rolname,rolbypassrls FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname");
  let started=false;
  const cluster=path.join(copy,'postgres'),pgPort=await port();
  const connection=(database:string)=>`postgresql://rollback_owner@127.0.0.1:${pgPort}/${database}`;
  const dump=async(database:string,file:string,sourceLive=false)=>{
    await run('pg_dump',['-h','127.0.0.1','-p',sourceLive?'54342':String(pgPort),'-U',sourceLive?decodeURIComponent(sourceUrl.username):'rollback_owner',
      '-d',database,'-Fc','--no-owner','-n','public','-n','auth','-f',file],
      sourceLive?{...process.env,PGPASSWORD:decodeURIComponent(sourceUrl.password)}:process.env);
    await chmod(file,0o600);
  };
  try {
    await dump('postgres',path.join(copy,'source.dump'),true);
    await cp('work/media-local/storage',path.join(copy,'source-storage'),{recursive:true,errorOnExist:true});
    await cp('work/media-local/keys',path.join(copy,'keys'),{recursive:true,errorOnExist:true});
    await cp('.env.media.local',path.join(copy,'fixture.env'));await chmod(path.join(copy,'fixture.env'),0o600);
    for(const name of ['fixture-owner.json','credentials.json','seed.json']) {
      await cp(path.join('work/media-local',name),path.join(copy,name));await chmod(path.join(copy,name),0o600);
    }
    await cp('work/media-local/supabase',path.join(copy,'supabase-workdir'),{recursive:true,errorOnExist:true});
    assert.deepEqual(await fingerprint(source),original,'source must be stable throughout snapshot capture');
    await run('initdb',['-D',cluster,'-U','rollback_owner','--auth=trust','--no-locale','-E','UTF8']);
    await run('pg_ctl',['-D',cluster,'-l',path.join(copy,'postgres.log'),'-o',`-h 127.0.0.1 -p ${pgPort} -c unix_socket_directories=''`,'-w','start']);started=true;
    const admin=new Pool({connectionString:connection('postgres')});
    try {
      for(const role of sourceRoles.rows) {
        if(!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(role.rolname))throw new Error('RESTORE_ROLE_INVALID');
        if(role.rolname!=='rollback_owner')await admin.query(`CREATE ROLE "${role.rolname}" NOLOGIN${role.rolbypassrls?' BYPASSRLS':''}`);
      }
      await admin.query('CREATE DATABASE rollback_copy');await admin.query('CREATE DATABASE rollback_restored');
    } finally {await admin.end();}
    const restore=async(database:string,file:string)=>{
      if(!['rollback_copy','rollback_restored'].includes(database)||pgPort===54342)throw new Error('RESTORE_ISOLATED_TARGET_REQUIRED');
      const fresh=new Pool({connectionString:connection(database)});
      try {await fresh.query('DROP SCHEMA public');} finally {await fresh.end();}
      await run('pg_restore',['-h','127.0.0.1','-p',String(pgPort),'-U','rollback_owner','-d',database,'--no-owner','--exit-on-error',file]);
    };
    await restore('rollback_copy',path.join(copy,'source.dump'));
    const db=new Pool({connectionString:connection('rollback_copy')});
    try {
      assert.deepEqual(await fingerprint(db),original);
      assert.deepEqual(await securityFingerprint(db),security,'RLS, policies and ACL must survive restoration');
      Object.assign(process.env,{UPLOAD_ENVIRONMENT:'local',UPLOAD_ENGINE_V2:'true',LEGACY_MEDIA_WRITES_ENABLED:'false',MEDIA_MOCK_ENABLED:'true',MEDIA_VIDEO_PROVIDER:'mock',MEDIA_AUXILIARY_PROVIDER:'mock',SUPABASE_URL:'http://127.0.0.1:54341',PEERTUBE_PROVIDER_ENABLED:'false'});
      const owner=(await db.query<{id:string}>('SELECT id FROM auth.users WHERE email=$1',['gma.creator-a@example.invalid'])).rows[0]!.id;
      const repo=serviceRepository(db),storage=new MockMediaStorage(path.join(copy,'source-storage'));
      const privateKey=createPrivateKey(await readFile(path.join(copy,'keys/private.pem'))),publicKey=createPublicKey(privateKey),issuer=new Ed25519MediaCapabilityIssuer(privateKey,'rollback');
      const deps={repository:repo,storage,publicKeys:{rollback:publicKey},origins:['http://127.0.0.1:4318']};
      const gateway=createMediaGateway(deps,createGatewayDelivery(deps,path.resolve('tests/media/fixtures/hls')));
      await new Promise<void>(resolve=>gateway.listen(0,'127.0.0.1',resolve));
      const address=gateway.address();if(!address||typeof address==='string')throw new Error('ROLLBACK_GATEWAY_LOCAL_REQUIRED');
      const origin=`http://127.0.0.1:${address.port}`;
      const provider=new MockMediaProvider(storage,repo,origin,issuer),disabled=()=>{throw new Error('REMOTE_PROVIDER_DISABLED');};
      const registry=new MediaProviderRegistry({mock:()=>provider,r2:disabled,stream:disabled,peertube:disabled},()=> 'mock');
      const service=new MediaService(repo,registry,{now:()=>Date.now()},{get:()=>mockJobProcessor(storage,{now:()=>Date.now(),async wait(){}})});
      try {
        const draft=await repo.uploadCommand(owner,'create_draft',{purpose:'title'}) as {id:string;revision:number};
        const bytes=await readFile('tests/media/fixtures/hls/legacy.mp4'),sha=createHash('sha256').update(bytes).digest('hex');
        const reserved=await service.reserve(owner,{draft_id:draft.id,revision:draft.revision,role:'main',bytes:bytes.length,sha256:sha,file_name:'rollback.mp4',content_type:'video/mp4',idempotency_key:randomUUID()});
        const id=reserved.result.session.sessionId;await repo.claimTransfer(owner,id,1,'rollback-writer');
        await provider.writeChunk(await service.context(id,owner),{startByte:0,endByte:bytes.length-1,sha256:sha,bytes});
        await db.query('SELECT gma_media_transfer_release($1,$2,1,$3,1)',[owner,id,'rollback-writer']);
        await service.complete(owner,id,1);await service.tick(10,true);
        assert.equal((await service.context(id)).asset.state,'ready');
        const sourcePlayback=await new PlaybackService(repo,registry).resolvePreview(reserved.result.asset.mediaId,owner);
        assert.equal(sourcePlayback.kind,'hls');if(sourcePlayback.kind!=='hls')throw new Error('HLS_REQUIRED');
        const snapshot=await fingerprint(db);
        await dump('rollback_copy',path.join(copy,'rollback.dump'));
        await cp(path.join(copy,'source-storage'),path.join(copy,'restored-storage'),{recursive:true,errorOnExist:true});
        process.env.UPLOADS_PAUSED='true';
        assert.throws(()=>engineGate(true),/UPLOAD_ADMISSION_PAUSED/);engineGate(false);
        assert.throws(()=>legacyMediaWritesGate(),/LEGACY_UPLOAD_DISABLED/);
        const read=await service.envelope(owner,id);assert.equal(read.asset.status,'ready');
        assert.equal((await fetch(sourcePlayback.url,{redirect:'error'})).status,200);
        await service.draftMutation(owner,'abandon',{draft_id:draft.id});await service.remove(await service.context(id));
        assert.equal((await service.context(id)).asset.state,'deleted');
        await restore('rollback_restored',path.join(copy,'rollback.dump'));
        const restored=new Pool({connectionString:connection('rollback_restored')});
        try {
          assert.deepEqual(await fingerprint(restored),snapshot,'restore must reproduce title/session/media/quota ledger data');
          assert.deepEqual(await securityFingerprint(restored),security);
          const restoredRepo=serviceRepository(restored),restoredStorage=new MockMediaStorage(path.join(copy,'restored-storage'));
          const restoredDeps={...deps,repository:restoredRepo,storage:restoredStorage};
          const delivery=createMediaGateway(restoredDeps,createGatewayDelivery(restoredDeps,path.resolve('tests/media/fixtures/hls')));
          await new Promise<void>(resolve=>delivery.listen(0,'127.0.0.1',resolve));
          try {
            const at=delivery.address();if(!at||typeof at==='string')throw new Error('RESTORED_GATEWAY_REQUIRED');
            const url=new URL(sourcePlayback.url);url.port=String(at.port);
            assert.equal((await fetch(url,{redirect:'error'})).status,200,'restored grant + indexed HLS files must authorize');
          } finally {delivery.closeAllConnections();await new Promise<void>(resolve=>delivery.close(()=>resolve()));}
        } finally {await restored.end();}
      } finally {gateway.closeAllConnections();await new Promise<void>(resolve=>gateway.close(()=>resolve()));delete process.env.UPLOADS_PAUSED;}
    } finally {await db.end();}
    assert.deepEqual(await fingerprint(source),original,'original live DB must never change');
    const report={isolated:true,originalUnchanged:true,snapshotRestored:true,securityRestored:true,admissionPaused:true,readsAndHls:true,cancel:true,legacyWritesClosed:true,copy:path.relative(root,copy)};
    await writeFile(path.join(copy,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
  } finally {
    await source.end();if(started)await run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);
    types.setTypeParser(20,previousInt8);
    // Keep private copies and verified dumps for explicit recovery/review. Never clean the current fixture.
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))void rollbackLocal().catch((error:unknown)=>{console.error(error instanceof Error?error.message:'MEDIA_ROLLBACK_FAILED');process.exitCode=1;});
