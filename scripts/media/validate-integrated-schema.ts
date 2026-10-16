/**
 * Valida el esquema integrado (Windows + motor del Mac) sobre PGlite: PostgreSQL en proceso, aislado y desechable.
 * No se conecta a ningún Supabase. Uso:
 *   npx tsx scripts/media/validate-integrated-schema.ts [--escenario=remoto|limpio] [--json=<salida>]
 *
 * Escenarios:
 *  - remoto: lo que ocurrirá en el Supabase real, donde las migraciones de Windows (20261013–20261020) ya están
 *    aplicadas a mano: históricas → Windows → motor (orden explícito del Mac).
 *  - limpio: una base nueva aplicando todo por orden de archivo corregido: históricas → motor → Windows.
 *
 * Después comprueba invariantes que afectan a los datos existentes (catálogo visible, extras, comentarios, RLS).
 */
import { PGlite } from '@electric-sql/pglite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'supabase/migrations';
const BASELINE = 'infrastructure/media-local/baseline.sql';

/** Mínimo de Supabase que las migraciones históricas esperan encontrar (Auth, roles y extensiones habituales). */
export const SUPABASE_STUB = `
CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS extensions; CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb, is_anonymous boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
`;

export const HISTORICAL = [
  '20260523_user_activity.sql', '20260524_films_data.sql', '20260524_films_synopses.sql', '20260524_films_years.sql',
  '20260524_ratings_table.sql', '20260524_watchlist_and_ratings.sql', '20260525_profile_isolation.sql',
  '20260526_restore_peliculas.sql', '20260526_rls_hardening.sql', '20260527_fix_film_scores_security_invoker.sql',
  '20260529_review_likes_and_proposals.sql', '20260616_extend_creator_profiles.sql', '20260617_creator_profiles_table.sql',
  '20260617_extend_creator_profiles_v2.sql', '20260619_creator_uploads.sql', '20260707120000_creator_social_links.sql',
  '20260707_creator_avatar_url.sql', '20260712_colecciones_slug_unique.sql', '20260712_creator_genre_collections.sql',
  '20260712_publish_creator_pelicula_rpc.sql',
  // Sin fecha en el nombre: aplicadas a mano en su día; comentarios antes de 20261013 (que depende de ellos).
  'comments_system.sql', 'dm_system.sql',
];

/** Orden explícito del Mac (scripts/media/local-stack.ts): 00031 va DESPUÉS de 0003, aunque por nombre quede antes. */
export const ENGINE = [
  '20261005_upload_engine_v2.sql', '20261006_upload_engine_r2_first.sql', '20261007_r2_capacity.sql',
  '202610080001_media_provider_neutral.sql', '202610080002_media_commands.sql', '202610080003_media_publish_lifecycle.sql',
  '2026100800031_media_title_lifecycle.sql', '202610080004_media_delivery_security.sql', '202610080005_media_coordination.sql',
  '202610080006_media_gateway.sql', '202610080007_media_gateway_grants.sql', '202610080008_title_writes_server_only.sql',
  '20261021000100_gma_draft_ficha.sql',
];

export const WINDOWS = [
  '20261013_comment_reports.sql', '20261015_pelicula_extras.sql', '20261016_comments_profile_id.sql',
  '20261017_profiles_avatar_id.sql', '20261018_comments_community.sql', '20261019_comment_likes_profile_id.sql',
  '20261020_comments_reply_to.sql',
];

interface StepResult { readonly file: string; readonly ok: boolean; readonly error?: string; readonly ms: number }
interface CheckResult { readonly name: string; readonly ok: boolean; readonly detail: string }

async function apply(db: PGlite, files: readonly string[], results: StepResult[]): Promise<boolean> {
  for (const file of files) {
    const started = Date.now();
    try {
      await db.exec(await readFile(path.join(DIR, file), 'utf8'));
      results.push({ file, ok: true, ms: Date.now() - started });
    } catch (error) {
      results.push({ file, ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started });
      return false;
    }
  }
  return true;
}

async function check(db: PGlite, name: string, fn: () => Promise<string>): Promise<CheckResult> {
  try { return { name, ok: true, detail: await fn() }; }
  catch (error) { return { name, ok: false, detail: error instanceof Error ? error.message : String(error) }; }
}

async function asRole<T>(db: PGlite, role: 'anon' | 'authenticated', sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${sub ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`); }
}

export async function invariants(db: PGlite): Promise<CheckResult[]> {
  const owner = '11111111-1111-4111-8111-111111111111', viewer = '33333333-3333-4333-8333-333333333333';
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${owner}','a@example.test'),('${viewer}','v@example.test') ON CONFLICT DO NOTHING;`);
  const out: CheckResult[] = [];
  const cols = async (table: string) => (await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table])).rows.map(r => r.column_name);
  const pelCols = await cols('peliculas');
  const insertCols = ['slug', 'title'].concat(pelCols.includes('status') ? ['status'] : []);
  // Títulos históricos: estado nulo y publicado, como en el catálogo real.
  await db.query(`INSERT INTO peliculas(${insertCols.join(',')}) VALUES('historico-nulo','Histórico'${pelCols.includes('status') ? ',NULL' : ''}),('historico-publicado','Publicado'${pelCols.includes('status') ? ",'published'" : ''})`);
  out.push(await check(db, 'catálogo: anon ve los títulos históricos (status nulo y published)', async () => {
    const n = await asRole(db, 'anon', null, async () => (await db.query<{ n: number }>(`SELECT count(*)::int n FROM peliculas WHERE slug LIKE 'historico-%'`)).rows[0]!.n);
    if (n !== 2) throw new Error(`anon ve ${n} de 2`); return 'anon ve 2 de 2';
  }));
  out.push(await check(db, 'peliculas: anon y authenticated no pueden escribir (202610080008)', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      const denied = await asRole(db, role, role === 'authenticated' ? owner : null, async () => {
        try { await db.query(`UPDATE peliculas SET title='x' WHERE slug='historico-nulo'`); return false; } catch { return true; }
      });
      if (!denied) throw new Error(`${role} puede escribir en peliculas`);
    }
    return 'escritura denegada a anon y authenticated';
  }));
  out.push(await check(db, 'pelicula_extras sigue enlazada a peliculas y legible', async () => {
    const id = (await db.query<{ id: number }>(`SELECT id FROM peliculas WHERE slug='historico-nulo'`)).rows[0]!.id;
    const ec = await cols('pelicula_extras');
    const required = ec.includes('video_url') ? ['pelicula_id', 'title', 'video_url'] : ['pelicula_id', 'title'];
    await db.query(`INSERT INTO pelicula_extras(${required.join(',')}) VALUES(${required.map((_, i) => `$${i + 1}`).join(',')})`,
      required.map(c => (c === 'pelicula_id' ? id : c === 'title' ? 'Making of' : 'https://example.test/x.mp4')));
    return `columnas: ${ec.join(', ')}`;
  }));
  out.push(await check(db, 'motor: columnas nuevas de peliculas con valores por defecto compatibles', async () => {
    const need = ['playback_kind', 'media_revision', 'media_delete_state'];
    const missing = need.filter(c => !pelCols.includes(c)); if (missing.length) throw new Error(`faltan ${missing.join(', ')}`);
    const r = (await db.query<{ playback_kind: string; media_revision: number; media_delete_state: string }>(
      `SELECT playback_kind, media_revision, media_delete_state FROM peliculas WHERE slug='historico-nulo'`)).rows[0]!;
    if (r.playback_kind !== 'legacy' || r.media_revision !== 0 || r.media_delete_state !== 'none') throw new Error(JSON.stringify(r));
    return JSON.stringify(r);
  }));
  out.push(await check(db, 'motor: tablas gma_* sin escritura para authenticated', async () => {
    const t = await db.query<{ table_name: string }>(`SELECT table_name FROM information_schema.table_privileges WHERE grantee='authenticated' AND table_schema='public' AND table_name LIKE 'gma_%' AND privilege_type IN ('INSERT','UPDATE','DELETE')`);
    if (t.rows.length) throw new Error(t.rows.map(r => r.table_name).join(', ')); return 'ninguna';
  }));
  out.push(await check(db, 'borrado de cuenta: delete_account del motor y cascada de Auth con comentarios de Windows', async () => {
    const id = (await db.query<{ id: number }>(`SELECT id FROM peliculas WHERE slug='historico-publicado'`)).rows[0]!.id;
    await db.query(`INSERT INTO profiles(id,display_name) VALUES($1,'A') ON CONFLICT DO NOTHING`, [owner]);
    await db.query(`INSERT INTO creator_profiles(user_id,creator_name) VALUES($1,'A') ON CONFLICT DO NOTHING`, [owner]);
    await db.query(`UPDATE peliculas SET creator_user_id=$1 WHERE id=$2`, [owner, id]);
    const c = await db.query<{ id: number }>(`INSERT INTO comments(pelicula_id,user_id,content) VALUES($1,$2,'hola') RETURNING id`, [id, owner]);
    await db.query(`INSERT INTO comments(pelicula_id,user_id,content,parent_id) VALUES($1,$2,'respuesta',$3)`, [id, viewer, c.rows[0]!.id]);
    await db.query(`SELECT gma_upload_command($1,'delete_account','{}'::jsonb)`, [owner]);
    const t = (await db.query<{ status: string; media_delete_state: string }>(`SELECT status, media_delete_state FROM peliculas WHERE id=$1`, [id])).rows[0]!;
    if (t.status !== 'unpublished' || t.media_delete_state !== 'pending') throw new Error(`título tras delete_account: ${JSON.stringify(t)}`);
    // Último paso de la purga (Auth): debe arrastrar comentarios, likes y denuncias sin romper claves foráneas.
    await db.query(`DELETE FROM peliculas WHERE id=$1`, [id]).catch(() => undefined);
    await db.query(`DELETE FROM auth.users WHERE id=$1`, [owner]);
    const left = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM comments WHERE user_id=$1`, [owner])).rows[0]!.n;
    if (left !== 0) throw new Error(`quedan ${left} comentarios del usuario borrado`);
    return `título → ${t.status}/${t.media_delete_state}; comentarios del usuario borrados en cascada`;
  }));
  return out;
}

type ScenarioName = 'remoto' | 'limpio' | 'nombre';

/** Orden que aplicaría una herramienta que ordena por nombre de archivo (Supabase CLI, `ls`). Diagnóstico: se espera que falle. */
export const BY_FILENAME = [...ENGINE, ...WINDOWS].sort();

async function scenario(name: ScenarioName) {
  const db = new PGlite();
  const steps: StepResult[] = [];
  await db.exec(SUPABASE_STUB);
  // Las migraciones históricas NO reconstruyen el esquema (peliculas, artistas… se crearon desde el panel de Supabase),
  // así que se parte de la baseline reconstruida en el Mac a partir de las consultas reales del código.
  let ok = true;
  try { await db.exec(await readFile(BASELINE, 'utf8')); steps.push({ file: BASELINE, ok: true, ms: 0 }); }
  catch (error) { steps.push({ file: BASELINE, ok: false, error: error instanceof Error ? error.message : String(error), ms: 0 }); ok = false; }
  if (ok && name === 'nombre') ok = await apply(db, BY_FILENAME, steps);
  else {
    if (ok) ok = await apply(db, name === 'remoto' ? WINDOWS : ENGINE, steps);
    if (ok) ok = await apply(db, name === 'remoto' ? ENGINE : WINDOWS, steps);
  }
  const checks = ok ? await invariants(db) : [];
  await db.close();
  return { escenario: name, migraciones_ok: ok, pasos: steps, comprobaciones: checks };
}

async function main() {
  const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
  const wanted = arg('escenario');
  const names = (wanted ? [wanted] : ['remoto', 'limpio', 'nombre']) as ScenarioName[];
  const results = [];
  for (const n of names) results.push(await scenario(n));
  for (const r of results) {
    const note = r.escenario === 'nombre' ? ' (diagnóstico: orden por nombre de archivo, se espera fallo en 2026100800031)' : '';
    console.log(`\n== Escenario ${r.escenario}: migraciones ${r.migraciones_ok ? 'OK' : 'FALLAN'}${note}`);
    for (const s of r.pasos.filter(s => !s.ok)) console.log(`  ✖ ${s.file}: ${s.error}`);
    console.log(`  ${r.pasos.filter(s => s.ok).length}/${r.pasos.length} migraciones aplicadas`);
    for (const c of r.comprobaciones) console.log(`  ${c.ok ? '✔' : '✖'} ${c.name} — ${c.detail}`);
  }
  const out = arg('json'); if (out) await writeFile(out, JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.escenario !== 'nombre').some(r => !r.migraciones_ok || r.comprobaciones.some(c => !c.ok));
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'media', 'validate-integrated-schema.ts'))) void main();
