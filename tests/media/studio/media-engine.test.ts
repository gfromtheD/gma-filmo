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
  assert.deepEqual(mapSlot(d, 'extra:1'), { supported: true, role: 'extra_image' }, 'los extras de imagen van al motor con su propio rol');
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
  assert.equal((await engine.uploadAsset({ slot: 'extra:7', rule: 'image', file: file('foto.png') }, () => undefined)).status, 'error', 'un extra que no existe en el borrador no se envía');
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

// ── Hueco ocupado por una subida anterior (UPLOAD_SLOT_OCCUPIED) ─────────────────────────────────────────────────────

/** Simula que el servidor libera el hueco al cancelar (la función `cancel` borra la fila del borrador al instante). */
function withServerSlots(h: ReturnType<typeof fakeDeps>) {
  const base = h.deps.api.bind(h.deps);
  h.deps.api = (async (path: string, method?: string, body?: unknown) => {
    const cancel = /\/api\/uploads\/([^/]+)\/cancel$/.exec(path);
    if (cancel) (h.detail.uploads as ManagedEnvelope[]).splice(0, h.detail.uploads.length, ...h.detail.uploads.filter(u => u.session.sessionId !== cancel[1]));
    return base(path, method, body);
  }) as MediaEngineDeps['api'];
  return h;
}

test('un hueco ocupado por una subida muerta de una sesión anterior se libera y la subida sigue', async () => {
  const h = withServerSlots(fakeDeps());
  const dead = envelope('poster_h', 'received', 7);
  (h.detail.uploads as ManagedEnvelope[]).push(dead);
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  const asset = await engine.uploadAsset({ slot: 'banner', rule: 'image', file: file('banner.png') }, () => undefined);
  assert.equal(asset.status, 'done');
  const cancel = h.calls.find(c => c.path.endsWith('/cancel'));
  assert.ok(cancel, 'se canceló la subida que ocupaba el hueco');
  assert.equal(cancel!.path, `/api/uploads/${dead.session.sessionId}/cancel`);
  assert.deepEqual(cancel!.body, { revision: dead.session.revision });
  assert.equal(h.uploads.length, 1);
  assert.equal(h.uploads[0]!.role, 'poster_h');
});

test('otros huecos del borrador no se tocan al subir a uno concreto', async () => {
  const h = withServerSlots(fakeDeps());
  (h.detail.uploads as ManagedEnvelope[]).push(envelope('main', 'ready', 1), envelope('poster_h', 'received', 7));
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  await engine.uploadAsset({ slot: 'poster', rule: 'image', file: file('cartel.png') }, () => undefined);
  assert.equal(h.calls.filter(c => c.path.endsWith('/cancel')).length, 0, 'el cartel (poster_v) no ocupa nada: no se cancela ni el vídeo ni el banner');
});

test('una subida del mismo hueco que esta página puede reanudar no se cancela', async () => {
  const h = withServerSlots(fakeDeps({}));
  const live = { ...envelope('main', 'uploading', 3), session: { ...envelope('main', 'uploading', 3).session, state: 'uploading' } } as unknown as ManagedEnvelope;
  h.deps.uploadAsset = async input => {
    h.uploads.push({ role: input.role, language: input.language, sessionId: input.sessionId });
    if (!h.detail.uploads.includes(live)) (h.detail.uploads as ManagedEnvelope[]).push(live); // el servidor crea la sesión en la primera subida
    input.onEnvelope?.(live);
    return live;
  };
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  await engine.uploadAsset({ slot: 'video', rule: 'video', file: file('a.mp4') }, () => undefined); // la primera vez la registra
  await engine.uploadAsset({ slot: 'video', rule: 'video', file: file('a.mp4') }, () => undefined); // la segunda la reanuda
  assert.equal(h.calls.filter(c => c.path.endsWith('/cancel')).length, 0);
  assert.equal(h.uploads[1]!.sessionId, live.session.sessionId);
});

test('los extras tienen hueco propio por subida: nunca se cancela otro extra', async () => {
  const h = withServerSlots(fakeDeps());
  (h.detail.uploads as ManagedEnvelope[]).push(envelope('extras', 'ready', 5));
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  await engine.uploadAsset({ slot: 'extra:0', rule: 'video', file: file('extra.mp4') }, () => undefined);
  assert.equal(h.calls.filter(c => c.path.endsWith('/cancel')).length, 0);
});

test('si el servidor no deja liberar el hueco, el usuario ve el motivo y no se sube nada', async () => {
  const h = fakeDeps();
  (h.detail.uploads as ManagedEnvelope[]).push(envelope('poster_h', 'received', 7));
  h.deps.api = (async () => { throw new Error('UPLOAD_ASSET_IN_USE'); }) as MediaEngineDeps['api'];
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  const asset = await engine.uploadAsset({ slot: 'banner', rule: 'image', file: file('banner.png') }, () => undefined);
  assert.equal(asset.status, 'error');
  assert.match(String(asset.error), /UPLOAD_ASSET_IN_USE/);
  assert.equal(h.uploads.length, 0);
});

// ── Etapas de la subida (comprobar → subir → procesar) y espera del procesado ─────────────────────────────────────────

test('las etapas llegan en orden y la comprobación informa de su avance', async () => {
  const h = fakeDeps();
  h.deps.uploadAsset = async input => {
    input.onState?.('Comprobando identidad');
    input.onHashProgress?.(0.5);
    input.onState?.('Transfiriendo');
    input.onProgress?.(40);
    input.onState?.('Validando y procesando');
    return envelope(input.role, 'ready', 1);
  };
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  const phases: Array<[string, number | undefined]> = [];
  let processing = 0;
  await engine.uploadAsset({ slot: 'video', rule: 'video', file: file('peli.mp4') }, () => undefined, undefined, () => { processing += 1; }, (phase, percent) => phases.push([phase, percent]));
  assert.deepEqual(phases, [['checking', 0], ['checking', 50], ['uploading', 0], ['processing', undefined]]);
  assert.equal(processing, 1, 'el aviso antiguo de «procesando» se mantiene');
});

test('un vídeo espera horas a que el servidor lo convierta; una imagen, el plazo normal', async () => {
  const waits: Record<string, number | undefined> = {};
  const h = fakeDeps();
  h.deps.uploadAsset = async input => { waits[input.role] = input.processingWaitMs; return envelope(input.role, 'ready', 1); };
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  await engine.uploadAsset({ slot: 'video', rule: 'video', file: file('peli.mp4') }, () => undefined);
  await engine.uploadAsset({ slot: 'trailer', rule: 'video', file: file('trailer.mp4') }, () => undefined);
  await engine.uploadAsset({ slot: 'poster', rule: 'image', file: file('cartel.png') }, () => undefined);
  assert.equal(waits.main, 6 * 60 * 60 * 1000);
  assert.equal(waits.trailer, 6 * 60 * 60 * 1000);
  assert.equal(waits.poster_v, undefined, 'las imágenes no cambian el plazo por defecto');
});

// ── Enviar con subidas canceladas o sustituidas en la lista del servidor ──────────────────────────────────────────────

/** Una subida que el usuario canceló o sustituyó: el servidor la sigue listando, con su archivo ya «borrado». */
function cancelled(role: string, n: number): ManagedEnvelope {
  const e = envelope(role, 'ready', n);
  return { ...e, session: { ...e.session, state: 'cancelled' }, asset: { ...e.asset, status: 'deleted', deliveryUrl: null } } as unknown as ManagedEnvelope;
}

test('enviar con subidas canceladas en la lista publica: solo cuentan las que siguen en uso', async () => {
  const { deps, detail, calls } = fakeDeps();
  (detail.uploads as ManagedEnvelope[]).push(cancelled('main', 8), cancelled('poster_h', 9), envelope('main', 'ready', 1), envelope('poster_h', 'ready', 2));
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture(), publishMode: 'direct' });
  const result = await engine.submit(draftFixture());
  assert.equal(result.status, 'published', JSON.stringify(result));
  assert.ok(calls.some(c => c.path === '/api/titles'), 'se llamó a publicar');
});

test('enviar sigue avisando si una subida en uso aún se procesa, aunque haya canceladas', async () => {
  const { deps, detail, calls } = fakeDeps();
  (detail.uploads as ManagedEnvelope[]).push(cancelled('main', 8), envelope('main', 'ready', 1), envelope('trailer', 'processing', 3));
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture(), publishMode: 'direct' });
  const result = await engine.submit(draftFixture());
  assert.equal(result.status, 'error');
  assert.match(result.message, /todavía se está procesando/);
  assert.ok(!calls.some(c => c.path === '/api/titles'), 'no se publicó');
});

test('la subida cancelada no ocupa el hueco ni hace falta cancelarla otra vez al volver a subir', async () => {
  const { deps, detail, calls, uploads } = fakeDeps();
  (detail.uploads as ManagedEnvelope[]).push(cancelled('poster_h', 9));
  const engine = createMediaEngine(deps, { getDraft: () => draftFixture() });
  await engine.uploadAsset({ slot: 'banner', rule: 'image', file: file('banner.png') }, () => undefined);
  assert.equal(uploads.length, 1);
  assert.equal(calls.filter(c => c.path.endsWith('/cancel')).length, 0);
});

// ── Extras de imagen ──────────────────────────────────────────────────────────────────────────────────────────────────

test('un extra de imagen se sube con su propio rol y no cancela el vídeo ni otras imágenes', async () => {
  const h = fakeDeps();
  // En el servidor ya hay otro extra de imagen y uno de vídeo: cada extra tiene su hueco propio.
  (h.detail.uploads as ManagedEnvelope[]).push(envelope('extra_image', 'ready', 5), envelope('extras', 'ready', 6), envelope('main', 'ready', 1));
  const engine = createMediaEngine(h.deps, { getDraft: () => draftFixture() });
  const asset = await engine.uploadAsset({ slot: 'extra:1', rule: 'image', file: file('fotograma.png') }, () => undefined);
  assert.equal(asset.status, 'done');
  assert.equal(h.uploads.at(-1)!.role, 'extra_image');
  assert.equal(h.calls.filter(c => c.path.endsWith('/cancel')).length, 0);
});

test('los tres tipos de extra de la ficha (fotograma, póster y vídeo) tienen hueco en el motor', () => {
  const d = draftFixture({ extras: [{ kind: 'fotograma', file: null }, { kind: 'poster', file: null }, { kind: 'video', file: null }] });
  assert.deepEqual(['extra:0', 'extra:1', 'extra:2'].map(s => (mapSlot(d, s) as { role?: string }).role), ['extra_image', 'extra_image', 'extras']);
});

test('las imágenes de extras respetan el límite de 10 MB del servidor', () => {
  assert.equal(serverLimitProblem('extra_image', 5 * 1024 ** 2), null);
  assert.ok(serverLimitProblem('extra_image', 11 * 1024 ** 2));
});
