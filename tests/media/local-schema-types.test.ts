import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Tables } from '../../types/database';

const publicProfile = {
  slug: true, user_id: true, nombre: true, foto_perfil: true, imagen_portada: true, nacionalidad: true,
  bio: true, redes_sociales: true, donacion_paypal: true, donacion_patreon: true, donacion_bitcoin: true, titulos: true,
} satisfies Record<keyof Tables<'creator_public_profiles'>, true>;
const gatewayGrant = {
  token_hash: true, asset_id: true, generation: true, owner_id: true, draft_id: true, title_slug: true,
  audience: true, expires_at: true, created_at: true,
} satisfies Record<keyof Tables<'gma_media_gateway_grants'>, true>;
const localMarker = {
  id: true, project_id: true, inventory_seeded: true, inventory_bytes: true,
} satisfies Record<keyof Tables<'gma_media_local_fixture'>, true>;

test('typed local fixture and gateway grant columns match their SQL sources', async () => {
  const [baseline, grants, titleWrites] = await Promise.all([
    readFile('infrastructure/media-local/baseline.sql', 'utf8'),
    readFile('supabase/migrations/202610080007_media_gateway_grants.sql', 'utf8'),
    readFile('supabase/migrations/202610080008_title_writes_server_only.sql', 'utf8'),
  ]);
  const profileSql = /CREATE TABLE public\.creator_public_profiles\s*\(([\s\S]*?)\n\);/i.exec(baseline)?.[1];
  const markerSql = /CREATE TABLE public\.gma_media_local_fixture\s*\(([\s\S]*?)\n\);/i.exec(baseline)?.[1];
  const grantSql = /CREATE TABLE IF NOT EXISTS public\.gma_media_gateway_grants\s*\(([\s\S]*?)\n\);/i.exec(grants)?.[1];
  assert.ok(profileSql); assert.ok(markerSql); assert.ok(grantSql);
  assert.match(titleWrites, /REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+public\.peliculas\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
  for (const name of Object.keys(publicProfile)) assert.match(profileSql, new RegExp(`\\b${name}\\b`));
  for (const name of Object.keys(localMarker)) assert.match(markerSql, new RegExp(`\\b${name}\\b`));
  for (const name of Object.keys(gatewayGrant)) assert.match(grantSql, new RegExp(`\\b${name}\\b`));
});
