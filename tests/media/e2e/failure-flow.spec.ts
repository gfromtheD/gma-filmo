import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { localDatabase, localEnvironment } from '../../../scripts/media/local-tools';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

async function runLocalAction(repository:string,script:string,action:'stop'|'start') {
  await promisify(execFile)(process.execPath,['--import','tsx',script,action],{cwd:repository,timeout:180_000});
}
async function mediaProcessIds(repository:string) {
  const result=await promisify(execFile)('ps',['-axo','pid,command']);
  return result.stdout.split('\n').flatMap(line=>{
    const match=/^\s*(\d+)\s+(.+)$/.exec(line);
    if(!match||!['gateway.ts','executor.ts'].some(name=>match[2]!.includes(path.join(repository,'scripts/media',name))))return [];
    return [{pid:Number(match[1]),kind:match[2]!.includes('/gateway.ts')?'gateway':'executor'}];
  });
}

const video = path.resolve('tests/media/fixtures/hls/legacy.mp4');
const web = 'http://127.0.0.1:4318';
const gateway = 'http://127.0.0.1:4319';

async function enterStudio(page: Page, password: string) {
  await page.goto('/');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Entrar a GMA Filmo' }).click();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continuar con tu correo' }).click();
  await page.getByPlaceholder('Correo electrónico').fill('gma.creator-b@example.invalid');
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.locator('form').getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/perfiles(?:\?|$)/);
  await page.goto('/perfiles?next=%2Fmi-estudio');
  await page.getByRole('button', { name: /Entrar como Creador local B/ }).click();
  await expect(page).toHaveURL(/\/mi-estudio$/);
  await page.getByRole('button', { name: 'Subir', exact: true }).click();
}

/** Network loss is injected only in transport. Every product API, Auth and DB operation is real. */
test('E02 durable lost response → restart gateway/executor → reselection → fail once → retry READY → cancel processing', async ({ page, request }) => {
  test.setTimeout(360_000);
  page.setDefaultTimeout(10_000);
  let environment = await localEnvironment();
  const db = localDatabase(environment);
  const repo = process.cwd(), script = path.join(repo, 'scripts/media/local-stack.ts');
  const before = await db.query<{ id: string; state: string; revision: number }>('SELECT id,state,revision FROM gma_media_assets ORDER BY id');
  const owner = (await db.query<{ id: string }>('SELECT id FROM auth.users WHERE email=$1', ['gma.creator-b@example.invalid'])).rows[0]!.id;
  const active = await db.query("SELECT id FROM gma_upload_drafts WHERE owner_id=$1 AND state='draft'", [owner]);
  expect(active.rowCount, 'test must not adopt preexisting drafts').toBe(0);
  const bytes = await readFile(video), split = Math.floor(bytes.length / 2);
  let first = true, lost = true, sessionId = '', assetId = '', draftId = '';
  let resumedPuts=0;
  const ownDrafts = new Set<string>();
  page.on('response',response=>{
    if(new URL(response.url()).pathname==='/api/upload-drafts' && response.request().method()==='POST' && response.status()===201)
      void response.json().then((value:unknown)=>{
        if(value && typeof value==='object' && 'draft'in value && value.draft && typeof value.draft==='object' && 'id'in value.draft && typeof value.draft.id==='string')ownDrafts.add(value.draft.id);
      }).catch(()=>undefined);
  });
  try {
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['data:', 'blob:', 'about:'].includes(url.protocol) || [web, gateway, 'http://127.0.0.1:54341'].includes(url.origin)) return route.continue();
      return route.abort();
    });
    await page.route(`${gateway}/**`, async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      if(!lost) {
        if(new URL(route.request().url()).pathname===`/transfer/${sessionId}`) {
          expect(route.request().headers()['content-range']).toBe(`bytes ${split}-${bytes.length-1}/${bytes.length}`);
          expect(route.request().postDataBuffer()?.length).toBe(bytes.length-split);resumedPuts++;
        }
        return route.continue();
      }
      if (first) {
        first = false;
        const headers: Record<string,string> = { ...route.request().headers(), 'content-range': `bytes 0-${split - 1}/${bytes.length}` };
        delete headers['content-length'];
        const sent = await request.put(route.request().url(), { headers, data: bytes.subarray(0, split) });
        expect(sent.status()).toBe(308);
        expect(sent.headers().range).toBe(`bytes=0-${split - 1}`);
      }
      await route.abort('connectionreset'); // Commit happened; its response is lost, then the transport remains offline.
    });
    await enterStudio(page, environment.MEDIA_LOCAL_TEST_PASSWORD!);
    console.log('E02 real login and Studio ready');
    await page.locator('input[type=file]').first().setInputFiles(video);
    await expect(page.getByRole('button', { name: 'Continuar legacy.mp4', exact: true })).toBeVisible({ timeout: 60_000 });
    const row = (await db.query<{ id: string; asset_id: string; draft_id: string; received_bytes: string }>(
      'SELECT s.id,s.asset_id,s.draft_id,(SELECT COALESCE(max(c.end_byte)+1,0)::text FROM gma_media_upload_chunks c WHERE c.session_id=s.id AND c.generation=s.transfer_generation AND c.upstream_confirmed) AS received_bytes FROM gma_upload_sessions s JOIN gma_upload_drafts d ON d.id=s.draft_id WHERE d.owner_id=$1 AND d.state=\'draft\' ORDER BY s.created_at DESC LIMIT 1', [owner])).rows[0]!;
    sessionId = row.id; assetId = row.asset_id; draftId = row.draft_id;
    expect(Number(row.received_bytes)).toBe(split);
    await db.query("UPDATE gma_media_provider_private SET private_state=jsonb_set(private_state,'{mockScenario}','\"processing-fails-once\"'::jsonb) WHERE session_id=$1", [sessionId]);
    await db.end();
    console.log('E02 durable half committed; response lost');
    const stateBefore = JSON.parse(await readFile('work/media-local/process-state.json', 'utf8')) as { pid: number };
    const childrenBefore=await mediaProcessIds(repo);
    for(const kind of ['gateway','executor'])expect(childrenBefore.some(child=>child.kind===kind)).toBe(true);
    await runLocalAction(repo, script, 'stop');
    for(const child of childrenBefore)expect(()=>process.kill(child.pid,0)).toThrow();
    await expect(fetch(`${gateway}/health`, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
    await runLocalAction(repo, script, 'start');
    environment = await localEnvironment();
    const stateAfter = JSON.parse(await readFile('work/media-local/process-state.json', 'utf8')) as { pid: number };
    expect(stateAfter.pid).not.toBe(stateBefore.pid); // Supervisor owns gateway and executor; both processes were stopped/recreated.
    const childrenAfter=await mediaProcessIds(repo);
    for(const kind of ['gateway','executor'])expect(childrenAfter.some(child=>child.kind===kind&&!childrenBefore.some(old=>old.pid===child.pid))).toBe(true);
    console.log('E02 actual gateway/executor restart complete');
    lost = false;
    await page.goto('/mi-estudio');
    if(new URL(page.url()).pathname==='/')await enterStudio(page,environment.MEDIA_LOCAL_TEST_PASSWORD!);
    else await page.getByRole('button', { name: 'Subir', exact: true }).click();
    const resume = page.getByRole('button', { name: 'Continuar legacy.mp4', exact: true });
    await expect(resume).toBeVisible();
    console.log('E02 restored same session; reselection available');
    const resumeResponse=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/uploads/${sessionId}/resume`&&response.request().method()==='POST');
    const chooser = page.waitForEvent('filechooser'); await resume.click(); await (await chooser).setFiles(video);
    const resumed=await (await resumeResponse).json() as {transfer:{offset:number};session:{sessionId:string};asset:{mediaId:string}};
    expect(resumed.transfer.offset).toBe(split);expect(resumed.session.sessionId).toBe(sessionId);expect(resumed.asset.mediaId).toBe(assetId);
    const retry = page.getByRole('button', { name: 'Reintentar procesamiento de legacy.mp4', exact: true });
    await expect(retry).toBeVisible({ timeout: 60_000 });
    console.log('E02 observed processing failure once');
    await retry.click();
    await expect(page.getByText('Reproducción de prueba local')).toBeVisible({ timeout: 60_000 });
    const check = localDatabase(environment);
    try {
      const recovered = (await check.query<{ asset_id: string; processing_generation: number; state: string }>(
        'SELECT s.asset_id,a.processing_generation,a.state FROM gma_upload_sessions s JOIN gma_media_assets a ON a.id=s.asset_id WHERE s.id=$1', [sessionId])).rows[0]!;
      expect(recovered.asset_id).toBe(assetId); expect(recovered.state).toBe('ready'); expect(recovered.processing_generation).toBe(2);
      const original = await readFile(path.join('work/media-local/storage', sessionId, 'g1/original.bin'));
      expect(createHash('sha256').update(original).digest('hex')).toBe(createHash('sha256').update(bytes).digest('hex'));
      const ledger = await check.query<{ account_key: string; event: string }>('SELECT account_key,event FROM gma_upload_ledger WHERE session_id=$1', [sessionId]);
      expect(new Set(ledger.rows.map(r=>r.account_key)).size).toBe(3);expect(resumedPuts).toBe(1);
      for (const account of new Set(ledger.rows.map(r => r.account_key))) for (const event of ['reserve','confirm'])
        expect(ledger.rows.filter(r => r.account_key === account && r.event === event)).toHaveLength(1);
    } finally { await check.end(); }
    // Discard only this test draft; then upload again and cancel while the real executor is processing.
    const token = await import('../../../scripts/media/local-tools').then(m=>m.localLogin(environment,'gma.creator-b@example.invalid'));
    expect((await request.delete(`${web}/api/upload-drafts/${draftId}`, {headers:{Authorization:`Bearer ${token}`}})).ok()).toBe(true);
    await page.goto('/mi-estudio');
    await page.getByRole('button', { name: 'Subir', exact: true }).click();
    const completion = page.waitForResponse(r => /\/api\/uploads\/[^/]+\/complete$/.test(new URL(r.url()).pathname));
    await page.locator('input[type=file]').first().setInputFiles(video);
    const completed = await completion; expect([200,202]).toContain(completed.status());
    await expect(page.getByText('Procesamiento en curso').first()).toBeVisible();
    await page.getByRole('button', { name: 'Quitar legacy.mp4', exact: true }).click();
    const cancellation = localDatabase(environment);
    try {
      await expect.poll(async () => (await cancellation.query<{ count: string }>("SELECT count(*)::text AS count FROM gma_media_assets a WHERE a.owner_id=$1 AND a.id<>$2 AND a.state IN ('deleting','deleted')", [owner, assetId])).rows[0]!.count).not.toBe('0');
      await page.waitForTimeout(4000); // An obsolete processing job must not resurrect READY.
      const ownedIds = await cancellation.query<{ id: string; state: string }>('SELECT id,state FROM gma_media_assets WHERE owner_id=$1 AND NOT(id=ANY($2::uuid[]))', [owner, before.rows.map(r=>r.id)]);
      expect(ownedIds.rows).toHaveLength(2);
      expect(ownedIds.rows.every(r=>['deleting','deleted'].includes(r.state))).toBe(true);
      await expect.poll(async()=>(await cancellation.query<{count:number}>("SELECT count(*)::int AS count FROM gma_media_assets WHERE id=ANY($1::uuid[]) AND state='deleted'",[ownedIds.rows.map(r=>r.id)])).rows[0]!.count).toBe(2);
      const finalLedger=await cancellation.query<{session_id:string;account_key:string;event:string}>(
        'SELECT session_id,account_key,event FROM gma_upload_ledger WHERE session_id IN(SELECT id FROM gma_upload_sessions WHERE asset_id=ANY($1::uuid[]))',[ownedIds.rows.map(r=>r.id)]);
      for(const id of new Set(finalLedger.rows.map(r=>r.session_id))) {
        const entries=finalLedger.rows.filter(r=>r.session_id===id);expect(new Set(entries.map(r=>r.account_key)).size).toBe(3);
        for(const account of new Set(entries.map(r=>r.account_key))) {
          for(const event of ['reserve','release'])expect(entries.filter(r=>r.account_key===account&&r.event===event)).toHaveLength(1);
          // Processing cancellation releases a reservation; only the READY asset confirmed usage.
          expect(entries.filter(r=>r.account_key===account&&r.event==='confirm')).toHaveLength(id===sessionId?1:0);
        }
      }
      const preserved = await cancellation.query<{ id: string; state: string; revision: number }>('SELECT id,state,revision FROM gma_media_assets WHERE id=ANY($1::uuid[]) ORDER BY id', [before.rows.map(r=>r.id)]);
      expect(preserved.rows).toEqual(before.rows);
    } finally { await cancellation.end(); }
  } finally {
    // Product owner-auth cleanup, only the drafts created by this test. Never reset the fixture.
    await db.end().catch(()=>undefined);
    if (draftId) ownDrafts.add(draftId);
    if (ownDrafts.size) {
      const token = await import('../../../scripts/media/local-tools').then(m=>m.localLogin(environment,'gma.creator-b@example.invalid'));
      for(const id of ownDrafts) await fetch(`${web}/api/upload-drafts/${id}`, {method:'DELETE',headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
    }
  }
});
