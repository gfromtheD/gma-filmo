import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { authenticateLocal } from '../../responsive/local-auth';
test.beforeEach(async ({page,request})=>{await authenticateLocal(page,request);});

const draftId = '33333333-3333-4333-8333-333333333333';
const mainSession = '77777777-7777-4777-8777-777777777777';
const mediaId = '66666666-6666-4666-8666-666666666666';
const avatarDraftId = '88888888-8888-4888-8888-888888888888';
const avatarSessionId = '99999999-9999-4999-8999-999999999999';
const avatarMediaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('Studio local Mock uploads through uploadx and publishes only the READY main media UUID', async ({ page }) => {
  const bytes = Buffer.from('local mock video fixture');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const draft = { id: draftId, purpose: 'title', state: 'draft', revision: 0, titleId: null, metadata: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let envelope: Record<string, unknown> | null = null;
  let publishBody: Record<string, unknown> | null = null;
  let tokenRefreshes = 0;
  let draftListRequests = 0;
  const makeEnvelope = (status: 'received' | 'ready') => ({
    version: 1,
    session: { sessionId: mainSession, mediaId, draftId, role: 'main', slot: 'main', language: null,
      state: status === 'ready' ? 'uploaded' : 'uploading', revision: 1, transferGeneration: 1, expectedBytes: bytes.length,
      sourceSha256: sha, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), receivedBytes: status === 'ready' ? bytes.length : 0,
      transferProgress: status === 'ready' ? 100 : 0, fileName: 'main.mp4', contentType: 'video/mp4' },
    asset: { mediaId, status, role: 'main', durationSeconds: status === 'ready' ? 90 : null,
      receivedBytes: status === 'ready' ? bytes.length : 0, revision: status === 'ready' ? 2 : 0, processingGeneration: 1,
      processingProgress: status === 'ready' ? 100 : 0, deliveryUrl: null, error: null,
      metadata: { syntheticPlayback: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    draftRevision: draft.revision,
    ...(status === 'received' ? { transfer: { protocol: 'uploadx', url: `http://127.0.0.1:4319/transfer/${mainSession}`,
      headers: { Authorization: 'Bearer local-capability' }, chunkSize: 8 * 1024 * 1024, offset: 0, totalBytes: bytes.length,
      expiresAt: new Date(Date.now() + 600_000).toISOString() } } : {}),
  });

  await page.route('http://127.0.0.1:54341/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) tokenRefreshes++;
    if (url.pathname.includes('/auth/')) return route.continue();
    return route.fulfill({json:[]});
  });
  await page.route('http://127.0.0.1:4319/transfer/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:3219', 'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type, content-range',
    } });
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataBuffer()).toEqual(bytes);
    return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3219' } });
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let json: unknown = {};
    if (path === '/api/upload-drafts' && method === 'GET') {
      draftListRequests++;
      if (draftListRequests === 1) return route.fulfill({ status: 401, json: { error: 'expired access token' } });
      json = { version: 1, drafts: [draft] };
    }
    else if (path === `/api/upload-drafts/${draftId}` && method === 'GET') json = { version: 1, draft, uploads: envelope ? [envelope] : [] };
    else if (path === `/api/upload-drafts/${draftId}` && method === 'PATCH') {
      const body = route.request().postDataJSON() as { revision: number; metadata: Record<string, unknown> };
      expect(body.revision).toBe(draft.revision);
      draft.metadata = body.metadata;
      draft.revision++;
      if (envelope) envelope = { ...envelope, draftRevision: draft.revision };
      json = { version: 1, draft };
    } else if (path === '/api/uploads' && method === 'POST') {
      const body = route.request().postDataJSON() as { role: string; sha256: string; idempotency_key: string };
      expect(body.role).toBe('main');
      expect(body.sha256).toBe(sha);
      expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
      envelope = makeEnvelope('received');
      json = envelope;
    } else if (path === `/api/uploads/${mainSession}/complete`) {
      expect(route.request().postDataJSON()).toEqual({ generation: 1 });
      envelope = makeEnvelope('ready');
      json = envelope;
    } else if (path === `/api/uploads/${mainSession}`) json = envelope;
    else if (path === '/api/titles' && method === 'POST') {
      publishBody = route.request().postDataJSON() as Record<string, unknown>;
      json = { title: { id: 1, slug: 'mock-title', status: 'published', mediaRevision: 1, deletionState: 'none' } };
    }
    return route.fulfill({ status: path === '/api/titles' ? 201 : 200, json });
  });

  const response = await page.goto('/creadores/responsive-fixture?view=studio-upload&managed=1');
  await expect(page.locator('[data-ready="studio-upload"]')).toBeVisible();
  await expect.poll(() => tokenRefreshes).toBe(1);
  expect(response?.headers()['content-security-policy']).toContain('http://127.0.0.1:4319');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'main.mp4', mimeType: 'video/mp4', buffer: bytes });
  await expect(page.getByText('Reproducción de prueba local')).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder('p. ej. Marea alta').fill('Mock neutral');
  await page.getByRole('button', { name: 'Continuar' }).click();
  const publish = page.getByRole('button', { name: 'Publicar en GMA Filmo' });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect.poll(() => publishBody).not.toBeNull();
  expect(publishBody).toEqual({ draft_id: draftId, revision: draft.revision, main_media_id: mediaId });
  expect(Object.keys(publishBody ?? {}).sort()).toEqual(['draft_id', 'main_media_id', 'revision']);
});

test('Studio restores durable processing after reload without treating it as an upload error', async ({ page }) => {
  const processingDraft = { id: draftId, purpose: 'title', state: 'draft', revision: 2, titleId: null, metadata: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const processingEnvelope = { version: 1,
    session: { sessionId: mainSession, mediaId, draftId, role: 'main', slot: 'main', language: null, state: 'uploaded', revision: 2,
      transferGeneration: 1, expectedBytes: 1024, sourceSha256: 'a'.repeat(64), expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      receivedBytes: 1024, transferProgress: 100, fileName: 'restored-main.mp4', contentType: 'video/mp4' },
    asset: { mediaId, status: 'processing', role: 'main', durationSeconds: null, receivedBytes: 1024, revision: 3,
      processingGeneration: 1, processingProgress: 45, deliveryUrl: null, error: null, metadata: { syntheticPlayback: true },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, draftRevision: 2 };
  await page.route('http://127.0.0.1:54341/**', route => {
    if (route.request().url().includes('/auth/')) return route.continue();
    return route.fulfill({json:[]});
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/upload-drafts' && route.request().method() === 'GET') return route.fulfill({ json: { version: 1, drafts: [processingDraft] } });
    if (path === `/api/upload-drafts/${draftId}`) return route.fulfill({ json: { version: 1, draft: processingDraft, uploads: [processingEnvelope] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/creadores/responsive-fixture?view=studio-upload&managed=1');
  await expect(page.getByText('Procesamiento en curso').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Procesamiento en curso').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
});

test('Studio profile sends its avatar through the neutral local auxiliary provider', async ({ page }) => {
  const bytes = Buffer.from('mock avatar image');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const draft = { id: avatarDraftId, purpose: 'avatar', state: 'draft', revision: 0, titleId: null, metadata: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let envelope: Record<string, unknown> | null = null;
  let avatarPublished = false;
  const readyEnvelope = () => ({ version: 1, session: { sessionId: avatarSessionId, mediaId: avatarMediaId, draftId: avatarDraftId,
    role: 'avatar', slot: 'avatar', language: null, state: 'uploaded', revision: 1, transferGeneration: 1, expectedBytes: bytes.length,
    sourceSha256: sha, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), receivedBytes: bytes.length, transferProgress: 100,
    fileName: 'avatar.png', contentType: 'image/png' }, asset: { mediaId: avatarMediaId, status: 'ready', role: 'avatar',
    durationSeconds: null, receivedBytes: bytes.length, revision: 2, processingGeneration: 1, processingProgress: 100,
    deliveryUrl: null, error: null, metadata: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    draftRevision: draft.revision });
  await page.route('http://127.0.0.1:54341/**', route => {
    if (route.request().url().includes('/auth/')) return route.continue();
    return route.fulfill({json:[]});
  });
  await page.route('http://127.0.0.1:4319/transfer/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:3219', 'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type, content-range',
    } });
    expect(route.request().postDataBuffer()).toEqual(bytes);
    return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3219' } });
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let json: unknown = {};
    if (path === '/api/upload-drafts' && method === 'POST') json = { version: 1, draft };
    else if (path === `/api/upload-drafts/${avatarDraftId}` && method === 'GET') json = { version: 1, draft, uploads: envelope ? [envelope] : [] };
    else if (path === '/api/uploads' && method === 'POST') {
      const body = route.request().postDataJSON() as { role: string; sha256: string };
      expect(body.role).toBe('avatar');
      expect(body.sha256).toBe(sha);
      envelope = { ...readyEnvelope(), asset: { ...readyEnvelope().asset, status: 'received', deliveryUrl: null },
        session: { ...readyEnvelope().session, state: 'uploading', receivedBytes: 0, transferProgress: 0 },
        transfer: { protocol: 'uploadx', url: `http://127.0.0.1:4319/transfer/${avatarSessionId}`,
          headers: { Authorization: 'Bearer local-capability' }, chunkSize: 8 * 1024 * 1024, offset: 0, totalBytes: bytes.length,
          expiresAt: new Date(Date.now() + 600_000).toISOString() } };
      json = envelope;
    } else if (path === `/api/uploads/${avatarSessionId}/complete`) { envelope = readyEnvelope(); json = envelope; }
    else if (path === `/api/uploads/${avatarSessionId}`) json = envelope;
    else if (path === `/api/upload-drafts/${avatarDraftId}/avatar`) { avatarPublished = true; json = { asset: { mediaId: avatarMediaId } }; }
    return route.fulfill({ json });
  });
  await page.goto('/creadores/responsive-fixture?view=studio-profile');
  await expect(page.locator('[data-ready="studio-profile"]')).toBeVisible();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: bytes });
  await expect.poll(() => avatarPublished).toBe(true);
  await expect(page.locator(`img[src="/api/media/${avatarMediaId}"]`).first()).toBeVisible();
});

test('Studio keeps retired and pending-delete titles visible with lifecycle-safe actions', async ({ page }) => {
  await page.route('http://127.0.0.1:54341/**', route => {
    if (route.request().url().includes('/auth/')) return route.continue();
    return route.fulfill({json:[]});
  });
  await page.goto('/creadores/responsive-fixture?view=studio-titles');
  await expect(page.locator('[data-ready="studio-titles"]')).toBeVisible();
  await page.getByRole('button', { name: /Retirados/ }).click();
  await expect(page.getByText('Película retirada de fixture').first()).toBeVisible();
  await page.getByRole('button', { name: 'Opciones de Película retirada de fixture' }).click();
  await expect(page.getByRole('button', { name: 'Republicar' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Borrado pendiente/ }).click();
  await expect(page.getByText('Película con borrado pendiente').first()).toBeVisible();
  await page.getByRole('button', { name: 'Opciones de Película con borrado pendiente' }).click();
  await expect(page.getByRole('button', { name: 'Republicar' })).toHaveCount(0);
});
