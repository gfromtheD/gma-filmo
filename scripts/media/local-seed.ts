import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CREATOR_GENRES } from '@/lib/genres';

export const MEDIA_LOCAL_PROJECT_ID = 'gma-filmo-media-local';
export const MEDIA_LOCAL_SUPABASE_URL = 'http://127.0.0.1:54341';
const FIXTURE_SLUG = 'media-local-legacy-mp4';
const FIXTURE_PREFIX = 'http://127.0.0.1:4319/fixtures/';

export interface LocalSeedOptions {
  url: string;
  projectId: string;
  serviceRoleKey: string;
  anonKey: string;
  password: string;
  fixtureDirectory?: string;
  fetch?: typeof fetch;
}
export interface LocalSeedUser {
  role: 'creator-a' | 'creator-b' | 'viewer';
  id: string;
  email: string;
  primaryProfileId: '';
  subProfileId: string;
}
export interface LocalSeedResult {
  projectId: typeof MEDIA_LOCAL_PROJECT_ID;
  users: LocalSeedUser[];
  legacySlug: string;
  legacyNumericId: number;
  legacyBytes: number;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  return value;
}
function uuid(value: unknown): string {
  const result = string(value);
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(result)) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  return result;
}

export function assertLocalSeedOptions(options: LocalSeedOptions): void {
  const url = new URL(options.url);
  if (url.origin !== MEDIA_LOCAL_SUPABASE_URL || url.pathname !== '/' || url.search || url.hash
    || url.username || url.password || options.projectId !== MEDIA_LOCAL_PROJECT_ID) throw new Error('MEDIA_LOCAL_ONLY');
  if (!options.serviceRoleKey || !options.anonKey || options.password.length < 16) throw new Error('MEDIA_LOCAL_CREDENTIALS_REQUIRED');
}

export async function seedLocal(options: LocalSeedOptions): Promise<LocalSeedResult> {
  assertLocalSeedOptions(options);
  const transport = options.fetch ?? fetch;
  async function request(relative: string, key: string, bearer: string, init: RequestInit = {}): Promise<unknown> {
    const url = new URL(relative, MEDIA_LOCAL_SUPABASE_URL);
    if (url.origin !== MEDIA_LOCAL_SUPABASE_URL || !/^\/(?:auth\/v1|rest\/v1)\//.test(url.pathname)) throw new Error('MEDIA_LOCAL_ONLY');
    const response = await transport(url, {
      ...init, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) throw new Error(`MEDIA_LOCAL_HTTP_${response.status}`);
    if (response.status === 204) return null;
    return response.json() as Promise<unknown>;
  }
  const admin = (relative: string, init?: RequestInit) => request(relative, options.serviceRoleKey, options.serviceRoleKey, init);
  const marker = array(await admin('/rest/v1/gma_media_local_fixture?select=project_id&id=eq.true'));
  if (marker.length !== 1 || object(marker[0]).project_id !== MEDIA_LOCAL_PROJECT_ID) throw new Error('MEDIA_LOCAL_FIXTURE_REQUIRED');

  async function upsert(table: string, rows: unknown[], conflict: string): Promise<unknown[]> {
    return array(await admin(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows),
    }));
  }
  const existing: Record<string, unknown>[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = object(await admin(`/auth/v1/admin/users?page=${page}&per_page=100`));
    const users = array(result.users).map(object);
    existing.push(...users);
    if (users.length < 100) break;
    if (page === 10) throw new Error('MEDIA_LOCAL_USER_LIST_LIMIT');
  }
  const definitions = [
    { role: 'creator-a', email: 'gma.creator-a@example.invalid', name: 'Creador local A', color: '#22B16B' },
    { role: 'creator-b', email: 'gma.creator-b@example.invalid', name: 'Creador local B', color: '#3B82F6' },
    { role: 'viewer', email: 'gma.viewer@example.invalid', name: 'Espectador local', color: '#8B5CF6' },
  ] as const;
  const resultUsers: LocalSeedUser[] = [];
  const tokens = new Map<string, string>();
  for (const definition of definitions) {
    let found = existing.find(user => user.email === definition.email);
    if (found) {
      if (object(found.user_metadata).media_local_project !== MEDIA_LOCAL_PROJECT_ID) throw new Error('MEDIA_LOCAL_USER_COLLISION');
      // A restart verifies the existing credential below; resetting the same password revokes real browser sessions.
    } else {
      found = object(await admin('/auth/v1/admin/users', {
        method: 'POST', body: JSON.stringify({ email: definition.email, password: options.password, email_confirm: true,
          user_metadata: { media_local_project: MEDIA_LOCAL_PROJECT_ID, display_name: definition.name } }),
      }));
    }
    const id = uuid(found.id);
    const subProfileId = `p_${id}`;
    await upsert('profiles', [{ id, display_name: definition.name, avatar_color: definition.color }], 'id');
    await upsert('sub_profiles', [{ id: subProfileId, user_id: id, name: 'Perfil local', avatar_id: 'profile_01',
      color: definition.color, is_kids: false, require_pin: false, pin: null, autoplay: true }], 'id');
    if (definition.role !== 'viewer') {
      await upsert('creator_profiles', [{ user_id: id, creator_name: definition.name,
        studio_name: `Estudio local ${definition.role === 'creator-a' ? 'A' : 'B'}`, bio: 'Fixture local GMA',
        status: 'active', location: 'Local', role: 'Director', avatar_url: `${FIXTURE_PREFIX}legacy.poster.webp`, social_links: {} }], 'user_id');
      await upsert('creator_public_profiles', [{ slug: `media-local-${definition.role}`, user_id: id,
        nombre: definition.name, foto_perfil: `${FIXTURE_PREFIX}legacy.poster.webp`,
        bio: 'Fixture local GMA', redes_sociales: [], titulos: definition.role === 'creator-a' ? [FIXTURE_SLUG] : [] }], 'slug');
    }
    const login = object(await request('/auth/v1/token?grant_type=password', options.anonKey, options.anonKey, {
      method: 'POST', body: JSON.stringify({ email: definition.email, password: options.password }),
    }));
    if (uuid(object(login.user).id) !== id) throw new Error('MEDIA_LOCAL_AUTH_ID_MISMATCH');
    tokens.set(definition.role, string(login.access_token));
    resultUsers.push({ role: definition.role, id, email: definition.email, primaryProfileId: '', subProfileId });
  }
  const creatorA = resultUsers.find(user => user.role === 'creator-a');
  if (!creatorA) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  const genres = await upsert('colecciones', CREATOR_GENRES.map(genre => ({ slug: genre.slug, name: genre.label })), 'slug');
  const drama = genres.map(object).find(genre => genre.slug === 'drama');
  if (!drama) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  const artist = object((await upsert('artistas', [{ slug: 'media-local-creator-a', name: 'Creador local A',
    bio: 'Fixture local GMA', r2_photo_url: `${FIXTURE_PREFIX}legacy.poster.webp` }], 'slug'))[0]);
  const fixture = await readFile(path.join(options.fixtureDirectory ?? path.resolve('tests/media/fixtures/hls'), 'legacy.mp4'));
  const title = object((await upsert('peliculas', [{ slug: FIXTURE_SLUG, title: 'Película legacy local',
    synopsis: 'Vídeo sintético para regresión MP4', year: '2026', duration: '0:12', author: 'Creador local A',
    r2_video_url: `${FIXTURE_PREFIX}legacy.mp4`, r2_poster_url: `${FIXTURE_PREFIX}legacy.poster.webp`,
    thumbnail_url: `${FIXTURE_PREFIX}legacy.poster.webp`, r2_subtitle_url: `${FIXTURE_PREFIX}legacy.es.vtt`,
    creator_user_id: creatorA.id, genre: 'Cortometraje', language: 'es', file_size_bytes: fixture.length,
    status: 'published', source_page: 'media-local-fixture', playback_kind: 'legacy' }], 'slug'))[0]);
  const titleId = Number(title.id);
  if (!Number.isSafeInteger(titleId) || titleId <= 0) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
  await upsert('peliculas_colecciones', [{ pelicula_id: titleId, coleccion_id: drama.id }], 'pelicula_id,coleccion_id');
  await upsert('peliculas_artistas', [{ pelicula_id: titleId, artista_id: artist.id }], 'pelicula_id,artista_id');
  for (const user of resultUsers) {
    await upsert('view_history', [{ user_id: user.id, profile_id: '', pelicula_id: titleId, last_position: 0, completed: false },
      { user_id: user.id, profile_id: user.subProfileId, pelicula_id: titleId, last_position: 2, completed: false }], 'user_id,profile_id,pelicula_id');
  }
  const inventory = object(await admin('/rest/v1/rpc/gma_media_local_inventory', { method: 'POST', body: '{}' }));
  if (inventory.project_id !== MEDIA_LOCAL_PROJECT_ID || inventory.inventory_verified !== true
    || Number(inventory.legacy_bytes) !== fixture.length) throw new Error('MEDIA_LOCAL_INVENTORY_INVALID');

  // These are actual Auth/PostgREST calls; failures are never hidden by UI interception.
  for (const user of resultUsers) {
    const bearer = tokens.get(user.role);
    if (!bearer) throw new Error('MEDIA_LOCAL_RESPONSE_INVALID');
    const own = async (relative: string) => array(await request(relative, options.anonKey, bearer));
    if ((await own(`/rest/v1/profiles?select=display_name,avatar_color&id=eq.${user.id}`)).length !== 1
      || (await own(`/rest/v1/sub_profiles?select=id,name,avatar_id,color,is_kids,require_pin,pin,autoplay&user_id=eq.${user.id}&order=created_at.asc`)).length !== 1
      || (await own(`/rest/v1/view_history?select=pelicula_id,last_position,completed,last_watched_at&user_id=eq.${user.id}&profile_id=eq.${user.subProfileId}`)).length !== 1) {
      throw new Error('MEDIA_LOCAL_PROFILE_QUERY_FAILED');
    }
    if (user.role !== 'creator-a' && (await own(`/rest/v1/profiles?select=id&id=eq.${creatorA.id}`)).length !== 0) throw new Error('MEDIA_LOCAL_OWNERSHIP_FAILED');
    if (user.role !== 'viewer' && (await own(`/rest/v1/creator_profiles?select=creator_name,studio_name,bio,location,role,avatar_url,social_links&user_id=eq.${user.id}`)).length !== 1) throw new Error('MEDIA_LOCAL_CREATOR_QUERY_FAILED');
  }
  const catalogue = array(await request('/rest/v1/peliculas?select=*,peliculas_colecciones(colecciones(name,slug)),peliculas_artistas(artistas(name,slug,r2_photo_url))&slug=eq.media-local-legacy-mp4&or=(status.eq.published,status.is.null)', options.anonKey, options.anonKey));
  const catalogueTitle = object(catalogue[0]);
  if (catalogue.length !== 1 || array(catalogueTitle.peliculas_colecciones).length !== 1
    || array(catalogueTitle.peliculas_artistas).length !== 1) throw new Error('MEDIA_LOCAL_CATALOG_QUERY_FAILED');
  if (array(await request('/rest/v1/film_scores?select=slug,approval_score&slug=eq.media-local-legacy-mp4', options.anonKey, options.anonKey)).length !== 1
    || array(await request('/rest/v1/creator_public_profiles?select=*&slug=eq.media-local-creator-a', options.anonKey, options.anonKey)).length !== 1) {
    throw new Error('MEDIA_LOCAL_CATALOG_QUERY_FAILED');
  }
  return { projectId: MEDIA_LOCAL_PROJECT_ID, users: resultUsers, legacySlug: FIXTURE_SLUG, legacyNumericId: titleId, legacyBytes: fixture.length };
}

async function main(): Promise<void> {
  if (process.env.UPLOAD_ENVIRONMENT !== 'local' || process.env.MEDIA_MOCK_ENABLED !== 'true'
    || process.env.PEERTUBE_PROVIDER_ENABLED === 'true') throw new Error('MEDIA_LOCAL_ONLY');
  const result = await seedLocal({ url: process.env.SUPABASE_URL ?? '',
    projectId: process.env.MEDIA_LOCAL_PROJECT_ID ?? '', serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', password: process.env.MEDIA_LOCAL_TEST_PASSWORD ?? '' });
  await mkdir(path.resolve('work/media-local'), { recursive: true });
  await writeFile(path.resolve('work/media-local/seed.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log('MEDIA_LOCAL_SEED_VERIFIED');
}
if (path.basename(process.argv[1] ?? '') === 'local-seed.ts') {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error && /^MEDIA_LOCAL_[A-Z_0-9]+$/.test(error.message) ? error.message : 'MEDIA_LOCAL_SEED_FAILED');
    process.exitCode = 1;
  });
}
