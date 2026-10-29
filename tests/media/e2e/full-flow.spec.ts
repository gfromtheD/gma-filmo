import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Pool } from 'pg';

const repository = process.cwd();
const workspace = path.join(repository, 'work/media-local');
const localProjectId = 'gma-filmo-media-local';
const allowedOrigins = new Set(['http://127.0.0.1:4318', 'http://127.0.0.1:4319', 'http://127.0.0.1:54341']);

function parseLocalEnvironment(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) throw new Error('MEDIA_E2E_ENV_INVALID');
    const value: unknown = JSON.parse(line.slice(index + 1));
    if (typeof value !== 'string') throw new Error('MEDIA_E2E_ENV_INVALID');
    values[line.slice(0, index)] = value;
  }
  return values;
}

test('E01 real creator login → Studio upload → READY → publish → catalogue → HLS decode', async ({ page, request }) => {
  const envPath = path.join(repository, '.env.media.local');
  const ownerPath = path.join(workspace, 'fixture-owner.json');
  const [ownerStat, envStat] = await Promise.all([lstat(ownerPath), lstat(envPath)]);
  if (ownerStat.isSymbolicLink() || envStat.isSymbolicLink() || (envStat.mode & 0o777) !== 0o600)
    throw new Error('MEDIA_E2E_LOCAL_FIXTURE_UNSAFE');
  const owner = JSON.parse(await readFile(ownerPath, 'utf8')) as { projectId?: string; repository?: string; fixtureId?: string; envSha256?: string };
  const envContent = await readFile(envPath, 'utf8');
  if (owner.projectId !== localProjectId || owner.repository !== repository ||
    createHash('sha256').update(envContent).digest('hex') !== owner.envSha256)
    throw new Error('MEDIA_E2E_LOCAL_FIXTURE_UNOWNED');
  const env = parseLocalEnvironment(envContent);
  if (env.MEDIA_LOCAL_PROJECT_ID !== localProjectId || env.UPLOAD_ENVIRONMENT !== 'local' ||
    env.MEDIA_MOCK_ENABLED !== 'true' || env.PEERTUBE_PROVIDER_ENABLED !== 'false' ||
    env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54341') throw new Error('MEDIA_E2E_LOCAL_ONLY');
  const credentialPath = path.join(workspace, 'credentials.json');
  const credentialStat = await lstat(credentialPath);
  if (credentialStat.isSymbolicLink() || (credentialStat.mode & 0o777) !== 0o600) throw new Error('MEDIA_E2E_CREDENTIALS_PRIVATE');
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as { projectId?: string; fixtureId?: string; password?: string };
  if (credentials.projectId !== localProjectId || credentials.fixtureId !== owner.fixtureId || !credentials.password)
    throw new Error('MEDIA_E2E_CREDENTIALS_INVALID');
  const dbUrl = new URL(env.SUPABASE_DB_URL ?? '');
  if (dbUrl.hostname !== '127.0.0.1' || dbUrl.port !== '54342') throw new Error('MEDIA_E2E_LOCAL_DB_REQUIRED');
  const actor = process.env.MEDIA_E2E_ACTOR ?? 'creator-a';
  if (!['creator-a','creator-b'].includes(actor)) throw new Error('MEDIA_E2E_LOCAL_ACTOR_REQUIRED');
  const email = `gma.${actor}@example.invalid`;
  const baseline = new Pool({ connectionString: dbUrl.href, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const activeDrafts = await baseline.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.gma_upload_drafts d
       WHERE d.owner_id=(SELECT id FROM auth.users WHERE email=$1) AND d.state='draft'`, [email]);
    if (activeDrafts.rows[0]?.count !== '0') throw new Error('MEDIA_E2E_CREATOR_DRAFTS_MUST_BE_EMPTY');
  } finally { await baseline.end(); }
  const title = `E2E local ${randomUUID().slice(0, 8)}`;
  const externalRequests: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['data:', 'blob:', 'about:'].includes(url.protocol)) return route.continue();
    if (url.protocol !== 'http:' || !allowedOrigins.has(url.origin)) {
      externalRequests.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'El lugar para descubrir, compartir, sentir y disfrutar cine.' })).toBeVisible();
  await page.waitForTimeout(800); // The landing hero is server-rendered; allow React to hydrate before clicking.
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar con tu correo' }).click();
  await page.getByPlaceholder('Correo electrónico').fill(email);
  await page.getByPlaceholder('Contraseña').fill(credentials.password);
  await page.locator('form').getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/perfiles(?:\?|$)/, { timeout: 30_000 });

  await page.goto('/perfiles?next=%2Fmi-estudio');
  await page.getByRole('button', { name: new RegExp(`Entrar como Creador local ${actor==='creator-a'?'A':'B'}`) }).click();
  await expect(page).toHaveURL(/\/mi-estudio$/);
  await page.getByRole('button', { name: 'Subir', exact: true }).click();
  await expect(page.locator('input[type=file]').first()).toBeAttached();
  const videoPath = path.join(repository, 'tests/media/fixtures/hls/legacy.mp4');
  await page.locator('input[type=file]').first().setInputFiles(videoPath);
  await expect(page.getByText('Reproducción de prueba local')).toBeVisible({ timeout: 90_000 });

  // Studio advances to Details as soon as the main asset reaches READY.
  const titleInput = page.getByPlaceholder('p. ej. Marea alta');
  if (!await titleInput.isVisible()) await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await titleInput.fill(title);
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const publish = page.getByRole('button', { name: 'Publicar en GMA Filmo' });
  await expect(publish).toBeEnabled();
  const publication = page.waitForResponse(response => new URL(response.url()).pathname === '/api/titles'
    && response.request().method() === 'POST', { timeout: 20_000 });
  await publish.click();
  expect((await publication).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Mis títulos', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: `Abrir ${title}`, exact: true })).toBeVisible({ timeout: 30_000 });

  const db = new Pool({ connectionString: dbUrl.href, max: 1, connectionTimeoutMillis: 5_000 });
  let slug = '';
  let mediaId = '';
  let titleId = '';
  try {
    const selected = await db.query<{ id: string; slug: string; main_media_id: string; state: string; provider: string }>(
      `SELECT p.id,p.slug,pub.main_media_id,a.state,a.provider
       FROM public.peliculas p
       JOIN public.gma_upload_publications pub ON pub.title_id=p.id
       JOIN public.gma_media_assets a ON a.id=pub.main_media_id
       WHERE p.title=$1 AND p.creator_user_id=(SELECT id FROM auth.users WHERE email=$2)
       ORDER BY p.created_at DESC LIMIT 1`, [title, email]);
    expect(selected.rowCount).toBe(1);
    const row = selected.rows[0]!;
    expect(row.state).toBe('ready');
    expect(row.provider).toBe('mock');
    slug = row.slug;
    mediaId = row.main_media_id;
    titleId = row.id;
    const ledger = await db.query<{ account_key: string; event: string }>(
      `SELECT account_key,event FROM public.gma_upload_ledger WHERE session_id IN
       (SELECT id FROM public.gma_upload_sessions WHERE asset_id=$1) ORDER BY account_key,event`, [mediaId]);
    const accounts = new Set(ledger.rows.map(entry => entry.account_key));
    expect(accounts.size).toBeGreaterThanOrEqual(2);
    for (const account of accounts) {
      expect(ledger.rows.filter(entry => entry.account_key === account && entry.event === 'reserve')).toHaveLength(1);
      expect(ledger.rows.filter(entry => entry.account_key === account && entry.event === 'confirm')).toHaveLength(1);
    }
  } finally {
    await db.end();
  }

  await page.goto('/cortos', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible({ timeout: 30_000 });
  await page.goto(`/ver/${slug}`, { waitUntil: 'domcontentloaded' });
  const video = page.locator('video').first();
  await expect(video).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 45_000 }).toBeGreaterThanOrEqual(2);
  await video.evaluate((element: HTMLVideoElement) => { element.muted = true; return element.play(); });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5);
  await video.evaluate((element: HTMLVideoElement) => { element.currentTime = Math.min(4, element.duration / 2); });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 10_000 }).toBeGreaterThan(1);

  const sourceResponse = await request.get(`http://127.0.0.1:4318/api/titles/${slug}/playback`);
  expect(sourceResponse.status()).toBe(200);
  const sourceValue = await sourceResponse.json() as { url?: string };
  if (!sourceValue.url) throw new Error('MEDIA_E2E_PLAYBACK_URL_MISSING');
  const oldCapabilityUrl = new URL(sourceValue.url, page.url());
  if (!allowedOrigins.has(oldCapabilityUrl.origin)) throw new Error('MEDIA_E2E_PLAYBACK_ORIGIN_INVALID');

  // Exercise title lifecycle through Studio UI and real product APIs.
  await page.goto('/mi-estudio', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Mis títulos', exact: true }).click();
  const titleOptions = page.getByRole('button', { name: `Opciones de ${title}`, exact: true });
  await expect(titleOptions).toBeVisible({ timeout: 30_000 });
  const unpublish = page.waitForResponse(response => new URL(response.url()).pathname === `/api/titles/${slug}/unpublish`
    && response.request().method() === 'POST');
  await titleOptions.click();
  await page.getByRole('button', { name: 'Despublicar', exact: true }).click();
  expect((await unpublish).status()).toBe(200);
  await expect(page.getByRole('button', { name: /Retirados/ })).toBeVisible();
  expect((await request.get(`http://127.0.0.1:4318/api/titles/${slug}/playback`)).status()).toBe(404);
  expect([401, 403, 404]).toContain((await request.get(oldCapabilityUrl.href)).status());

  await titleOptions.click();
  const republish = page.waitForResponse(response => new URL(response.url()).pathname === `/api/titles/${slug}/republish`
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Republicar', exact: true }).click();
  expect((await republish).status()).toBe(200);
  expect((await request.get(`http://127.0.0.1:4318/api/titles/${slug}/playback`)).status()).toBe(200);

  await titleOptions.click();
  const deletion = page.waitForResponse(response => new URL(response.url()).pathname === `/api/titles/${slug}`
    && response.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  expect((await deletion).status()).toBe(202);
  await expect(page.getByRole('button', { name: /Borrado pendiente/ })).toBeVisible();
  expect((await request.get(`http://127.0.0.1:4318/api/titles/${slug}/playback`)).status()).toBe(404);
  const lifecycleDb = new Pool({ connectionString: dbUrl.href, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    let deleted = false;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const state = await lifecycleDb.query<{ state: string; delete_state: string }>(
        `SELECT a.state,p.media_delete_state AS delete_state FROM public.gma_media_assets a
         JOIN public.gma_title_media_versions v ON v.snapshot->'media' @> jsonb_build_array(jsonb_build_object('asset_id',a.id::text))
         JOIN public.peliculas p ON p.id=v.title_id WHERE a.id=$1 ORDER BY v.created_at DESC LIMIT 1`, [mediaId]);
      if (state.rows[0]?.state === 'deleted' && state.rows[0]?.delete_state === 'done') { deleted = true; break; }
      // The delete command removes live title_media references; the durable title remains queryable by slug.
      const titleState = await lifecycleDb.query<{ status: string; delete_state: string }>(
        `SELECT status,media_delete_state AS delete_state FROM public.peliculas WHERE slug=$1`, [slug]);
      if (titleState.rows[0]?.delete_state === 'done') { deleted = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    expect(deleted, 'executor must complete durable deletion').toBe(true);
    const ledger = await lifecycleDb.query<{ account_key: string; event: string }>(
      `SELECT account_key,event FROM public.gma_upload_ledger WHERE session_id IN
       (SELECT id FROM public.gma_upload_sessions WHERE asset_id=$1) ORDER BY account_key,event`, [mediaId]);
    const accounts = new Set(ledger.rows.map(entry => entry.account_key));
    expect(accounts.size).toBeGreaterThanOrEqual(2);
    for (const account of accounts) expect(ledger.rows.filter(entry => entry.account_key === account && entry.event === 'release')).toHaveLength(1);
  } finally { await lifecycleDb.end(); }
  expect(externalRequests).toEqual([]);
  expect(Number(titleId)).toBeGreaterThan(0);
  expect(mediaId).toMatch(/^[0-9a-f-]{36}$/i);
});
