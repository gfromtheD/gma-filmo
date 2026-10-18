import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDraft, type UploadDraft } from '@/lib/studio/upload-draft';
import { engineMetadata, fichaFromDraft, mapSlot, serverLimitProblem } from '@/lib/studio-media/mapping';
import { createMediaEngine, type MediaEngineDeps } from '@/lib/studio-media/media-engine';
import { createTitleLifecycle, TitleActionUnavailable } from '@/lib/studio-media/title-lifecycle';
import { fichaSchema } from '@/lib/media/ficha';
import type { ManagedDraftDetail, ManagedEnvelope } from '@/lib/uploads/managed-browser';

const DRAFT_ID = '00000000-0000-4000-8000-000000000001';
const draftFixture = (patch: Partial<UploadDraft> = {}): UploadDraft => ({
  ...emptyDraft(), title: 'Yasha', synopsisShort: 'Corta', synopsisLong: 'Larga', releaseYear: 2025, language: 'es',
  categories: ['Ficción'], genres: ['Drama'], team: [{ name: 'Ana', role: 'Dirección' }],
  extras: [{ kind: 'video', file: null }, { kind: 'fotograma', file: null }],
  srtSubtitles: [{ language: 'en', file: null }], ...patch,
});

function envelope(role: string, status: string, n = 1, extra: Partial<ManagedEnvelope['asset']> = {}): ManagedEnvelope {
  const id = `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
  return {
    version: 1, draftRevision: 3,
    session: { sessionId: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`, mediaId: id, draftId: DRAFT_ID, role, slot: role, language: null, state: status === 'ready' ? 'uploaded' : 'uploading', revision: 2, transferGeneration: 1 },
    asset: { mediaId: id, status, revision: 1, processingProgress: null, deliveryUrl: status === 'ready' ? `/api/media/${id}` : null, error: null, ...extra },
  } as unknown as ManagedEnvelope;
}

function fakeDeps(overrides: Partial<MediaEngineDeps> = {}) {
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  const uploads: Array<{ role: string; language?: string; sessionId?: string }> = [];
  const detail = { version: 1, draft: { id: DRAFT_ID, purpose: 'title', state: 'draft', revision: 3, titleId: null, metadata: {}, createdAt: '', updatedAt: '' }, uploads: [] as ManagedEnvelope[] } as unknown as ManagedDraftDetail;
  const deps: MediaEngineDeps = {
    ownerId: async () => 'owner-1',
    getDraft: async () => detail,
    async uploadAsset(input) {
      uploads.push({ role: input.role, language: input.language, sessionId: input.sessionId });
      input.onProgress?.(50); input.onState?.('Validando y procesando');
      const env = envelope(input.role, 'ready', uploads.length);
      (detail.uploads as ManagedEnvelope[]).push(env);
      input.onEnvelope?.(env);
      return env;
    },
    saveMetadata: async () => ({ ...detail.draft, revision: 4 }),
    async api<T>(path: string, method?: string, body?: unknown) {
      calls.push({ path, method, body });
      if (path.endsWith('/ficha') && !method) return { ficha: null } as T;
      if (path.endsWith('/ficha')) return { ficha: { revision: ((body as { revision: number }).revision) + 1 } } as T;
      if (path === '/api/titles') return { title: { slug: 'yasha' } } as T;
      return envelope('main', 'ready') as T;
    },
    newKey: () => '00000000-0000-4000-8000-00000000ffff',
    ...overrides,
  };
  return { deps, calls, uploads, detail };
}

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: name.endsWith('.mp4') ? 'video/mp4' : 'image/png' });

test('mapeo explícito de huecos de Windows a roles del motor', () => {
  const d = draftFixture({ srtSubtitles: [{ language: 'en', file: null }, { language: 'en', file: null }] });
  assert.deepEqual(mapSlot(d, 'video'), { supported: true, role: 'main' });
  assert.deepEqual(mapSlot(d, 'trailer'), { supported: true, role: 'trailer' });
  assert.deepEqual(mapSlot(d, 'poster'), { supported: true, role: 'poster_v' });
  assert.deepEqual(mapSlot(d, 'banner'), { supported: true, role: 'poster_h' });
  assert.deepEqual(mapSlot(d, 'extra:0'), { supported: true, role: 'extras' });
  assert.equal(mapSlot(d, 'extra:1').supported, false, 'extras de imagen: decisión pendiente');
  assert.equal(mapSlot(d, 'srt:0').supported, false, 'dos SRT del mismo idioma');
  assert.deepEqual(mapSlot(draftFixture(), 'srt:0'), { supported: true, role: 'subtitles', language: 'en' });
});

test('los límites del servidor mandan sobre los de la pasarela (tráiler 1 GB, vídeo 4 GB)', () => {
  assert.match(serverLimitProblem('trailer', 2 * 1024 ** 3) ?? '', /1 GB/);
  assert.equal(serverLimitProblem('main', 2 * 1024 ** 3), null);
  assert.match(serverLimitProblem('poster_v', 11 * 1024 ** 2) ?? '', /10 MB/);
});

test('la ficha conserva todos los campos y pasa la validación del servidor; el motor recibe sus 5 campos', () => {
  const d = draftFixture({ awards: [{ festival: 'Sitges', award: 'Selección' }], themes: ['Memoria'], ai: { used: true, note: 'Fondos' } });
  const { ficha } = fichaFromDraft(d, slot => (slot === 'extra:0' ? '00000000-0000-4000-8000-000000000099' : null));
  assert.equal(fichaSchema.safeParse(ficha).success, true);
  assert.deepEqual(ficha.awards, d.awards);
  assert.deepEqual(ficha.extras, [{ kind: 'video', mediaId: '00000000-0000-4000-8000-000000000099' }, { kind: 'fotograma', mediaId: null }]);
  assert.deepEqual(engineMetadata(d), { title: 'Yasha', synopsis: 'Larga', year: '2025', genre: 'Drama', language: 'es' });
});

test('mediaEngine sube con el rol correcto, avisa del procesado y devuelve la identidad del medio', async () => {
  const { deps, uploads } = fakeDeps();
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture() });
  let processing = false; const progress: number[] = [];
  const asset = await engine.uploadAsset({ slot: 'srt:0', rule: 'subtitle', file: file('en.srt') }, p => progress.push(p), undefined, () => { processing = true; });
  assert.equal(asset.status, 'done');
  assert.equal(processing, true);
  assert.deepEqual(progress, [50]);
  assert.deepEqual(uploads[0], { role: 'subtitles', language: 'en', sessionId: undefined });
  assert.ok((asset as { mediaId?: string }).mediaId);
});

test('mediaEngine no envía al servidor huecos sin soporte ni archivos por encima del límite real', async () => {
  const { deps, uploads } = fakeDeps();
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture() });
  assert.equal((await engine.uploadAsset({ slot: 'extra:1', rule: 'image', file: file('foto.png') }, () => undefined)).status, 'error');
  const big = { name: 'trailer.mp4', size: 2 * 1024 ** 3, type: 'video/mp4' } as File;
  assert.equal((await engine.uploadAsset({ slot: 'trailer', rule: 'video', file: big }, () => undefined)).status, 'error');
  assert.equal(uploads.length, 0);
});

test('abortar solo detiene el navegador; cancelar llama al servidor con la revisión de la sesión', async () => {
  const aborting = fakeDeps({ async uploadAsset() { throw new DOMException('Interrumpido', 'AbortError'); } });
  const engine = createMediaEngine(aborting.deps, { getDraft: () => draftFixture() });
  await assert.rejects(engine.uploadAsset({ slot: 'video', rule: 'video', file: file('a.mp4') }, () => undefined), { name: 'AbortError' });
  assert.equal(aborting.calls.length, 0, 'ninguna cancelación implícita en el servidor');

  const { deps, calls } = fakeDeps();
  const e2 = createMediaEngine(deps, { getDraft: () => draftFixture() });
  await e2.uploadAsset({ slot: 'video', rule: 'video', file: file('a.mp4') }, () => undefined);
  await e2.cancelAsset('video');
  assert.equal(calls.at(-1)?.method, 'POST');
  assert.match(calls.at(-1)!.path, /\/api\/uploads\/.+\/cancel$/);
  assert.deepEqual(calls.at(-1)!.body, { revision: 2 });
});

test('submit por defecto guarda metadatos y ficha pero NO publica (revisión editorial pendiente)', async () => {
  const { deps, calls } = fakeDeps();
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture() });
  const result = await engine.submit(draftFixture({ acceptedTerms: true }));
  assert.equal(result.status, 'queued');
  assert.ok(calls.some(c => c.method === 'PUT' && c.path.endsWith('/ficha')));
  assert.ok(!calls.some(c => c.path === '/api/titles'));
});

test('submit en modo directo publica con draft_id, revisión y main_media_id cuando todo está listo', async () => {
  const { deps, calls } = fakeDeps();
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture(), publishMode: 'direct' });
  await engine.uploadAsset({ slot: 'video', rule: 'video', file: file('a.mp4') }, () => undefined);
  const result = await engine.submit(draftFixture({ acceptedTerms: true }));
  assert.deepEqual(result, { status: 'published', slug: 'yasha', message: 'Tu título se ha publicado.' });
  const publish = calls.find(c => c.path === '/api/titles')!;
  assert.deepEqual(Object.keys(publish.body as object).sort(), ['draft_id', 'main_media_id', 'revision']);
});

test('ciclo de vida de títulos: sin motor solo existe el borrado histórico; con motor, revisión e idempotencia', async () => {
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  const api = async <T,>(path: string, method?: string, body?: unknown) => { calls.push({ path, method, body }); return { title: { id: 1, slug: 's', status: 'unpublished', mediaRevision: 4, deletionState: 'pending' }, accepted: true } as T; };
  const off = createTitleLifecycle({ api, engineEnabled: false, newKey: () => 'k' });
  assert.deepEqual(await off.remove('mi corto'), { accepted: true, deletionState: 'done' });
  assert.deepEqual(calls.at(-1), { path: '/api/titles/mi%20corto', method: 'DELETE', body: undefined });
  await assert.rejects(off.unpublish('s', 1), TitleActionUnavailable);

  const on = createTitleLifecycle({ api, engineEnabled: true, newKey: () => '00000000-0000-4000-8000-0000000000aa' });
  await on.unpublish('s', 3);
  assert.deepEqual(calls.at(-1), { path: '/api/titles/s/unpublish', method: 'POST', body: { revision: 3, idempotency_key: '00000000-0000-4000-8000-0000000000aa' } });
  assert.deepEqual(await on.remove('s', 4), { accepted: true, deletionState: 'pending' });
  await assert.rejects(on.remove('s'), /TITLE_REVISION_REQUIRED/);
});
