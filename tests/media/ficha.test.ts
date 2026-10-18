import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { database, uploadCommand, OWNER, OTHER } from './database';
import { FichaRepository } from '@/lib/media/ficha-repository';
import { fichaSchema, FICHA_SCHEMA_VERSION, type Ficha } from '@/lib/media/ficha';
import type { PGlite } from '@electric-sql/pglite';

const FICHA: Ficha = {
  originalTitle: 'Yasha', durationMinutes: 14, productionCountry: 'ES', releaseYear: 2025, categories: ['Ficción'],
  ageRating: '12+', firstFilm: true, language: 'es', synopsisShort: 'Corta', synopsisLong: 'Larga', genres: ['Drama'],
  themes: ['Memoria'], team: [{ name: 'Ana', role: 'Dirección' }], awards: [{ festival: 'Sitges', award: 'Selección' }],
  ai: { used: false, note: '' }, allowComments: true, subtitleLanguages: ['en'], extras: [{ kind: 'fotograma', mediaId: null }], acceptedTerms: true,
};

async function setup() {
  const db = await database();
  await db.exec(await readFile('supabase/migrations/20261021000100_gma_draft_ficha.sql', 'utf8'));
  // Cliente RPC mínimo sobre PGlite con la misma forma que supabase-js (data/error).
  const rpc = async (name: string, args: Record<string, unknown>) => {
    try {
      const keys = Object.keys(args);
      const r = await db.query<{ r: unknown }>(`SELECT ${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) AS r`,
        keys.map(k => (typeof args[k] === 'object' && args[k] !== null ? JSON.stringify(args[k]) : args[k])));
      return { data: r.rows[0]!.r, error: null };
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
  };
  return { db, repo: new FichaRepository({ rpc }) };
}

async function draftFor(db: PGlite, owner = OWNER) {
  return (await uploadCommand<{ id: string }>(db, 'create_draft', { purpose: 'title' }, owner)).id;
}

test('el esquema de ficha valida en servidor y rechaza campos desconocidos o fuera de límites', () => {
  assert.equal(fichaSchema.safeParse(FICHA).success, true);
  assert.equal(fichaSchema.safeParse({ ...FICHA, desconocido: 1 }).success, false);
  assert.equal(fichaSchema.safeParse({ ...FICHA, synopsisShort: 'x'.repeat(251) }).success, false);
  assert.equal(fichaSchema.safeParse({ ...FICHA, productionCountry: 'España' }).success, false);
});

test('guardar ficha: CAS por revisión propia, solo el propietario y solo borradores editables', async () => {
  const { db, repo } = await setup();
  try {
    const draft = await draftFor(db);
    const first = await repo.save(OWNER, draft, { revision: 0, schemaVersion: FICHA_SCHEMA_VERSION, ficha: FICHA });
    assert.equal(first.ficha.revision, 1);
    const second = await repo.save(OWNER, draft, { revision: 1, schemaVersion: FICHA_SCHEMA_VERSION, ficha: { ...FICHA, themes: ['Exilio'] } });
    assert.equal(second.ficha.revision, 2);
    await assert.rejects(repo.save(OWNER, draft, { revision: 1, schemaVersion: FICHA_SCHEMA_VERSION, ficha: FICHA }), /UPLOAD_REVISION_CONFLICT/);
    await assert.rejects(repo.save(OTHER, draft, { revision: 2, schemaVersion: FICHA_SCHEMA_VERSION, ficha: FICHA }), /UPLOAD_NOT_FOUND/);
    const stored = (await db.query<{ ficha: Ficha }>('SELECT ficha FROM gma_draft_ficha WHERE draft_id=$1', [draft])).rows[0]!.ficha;
    assert.deepEqual(stored.themes, ['Exilio']);
    assert.deepEqual(stored.team, FICHA.team);
  } finally { await db.close(); }
});

test('la ficha no se publica desde un borrador sin publicar y se copia al título cuando está publicado', async () => {
  const { db, repo } = await setup();
  try {
    const draft = await draftFor(db);
    await repo.save(OWNER, draft, { revision: 0, schemaVersion: FICHA_SCHEMA_VERSION, ficha: FICHA });
    await assert.rejects(repo.publish(OWNER, draft), /UPLOAD_REVISION_CONFLICT/);
    const film = (await db.query<{ id: number }>(`INSERT INTO peliculas(slug,title,creator_user_id,status) VALUES('ficha-ok','Ficha',$1,'published') RETURNING id`, [OWNER])).rows[0]!.id;
    await db.query(`UPDATE gma_upload_drafts SET state='published', title_id=$2 WHERE id=$1`, [draft, film]);
    assert.deepEqual(await repo.publish(OWNER, draft), { pelicula_id: film, copied: true });
    assert.deepEqual(await repo.publish(OWNER, draft), { pelicula_id: film, copied: true }, 'idempotente');
    const copied = (await db.query<{ ficha: Ficha }>('SELECT ficha FROM pelicula_ficha WHERE pelicula_id=$1', [film])).rows[0]!.ficha;
    assert.equal(copied.originalTitle, 'Yasha');
    await assert.rejects(repo.publish(OTHER, draft), /UPLOAD_NOT_FOUND/);
  } finally { await db.close(); }
});

test('RLS: authenticated no escribe fichas y solo lee la suya; anon solo lee fichas de títulos visibles', async () => {
  const { db, repo } = await setup();
  try {
    const draft = await draftFor(db);
    await repo.save(OWNER, draft, { revision: 0, schemaVersion: FICHA_SCHEMA_VERSION, ficha: FICHA });
    const hidden = (await db.query<{ id: number }>(`INSERT INTO peliculas(slug,title,creator_user_id,status) VALUES('oculta','Oculta',$1,'unpublished') RETURNING id`, [OWNER])).rows[0]!.id;
    await db.query(`INSERT INTO pelicula_ficha(pelicula_id,schema_version,ficha) VALUES($1,1,'{}'::jsonb)`, [hidden]);
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${OTHER}',false);`);
    assert.equal((await db.query('SELECT 1 FROM gma_draft_ficha')).rows.length, 0, 'otro usuario no ve la ficha ajena');
    await assert.rejects(db.query(`UPDATE gma_draft_ficha SET revision=99`));
    await db.exec(`RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',false);`);
    assert.equal((await db.query('SELECT 1 FROM pelicula_ficha WHERE pelicula_id=$1', [hidden])).rows.length, 0, 'anon no ve fichas de títulos retirados');
    await db.exec('RESET ROLE;');
  } finally { await db.close(); }
});
