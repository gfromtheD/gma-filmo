import type { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { database as legacyDatabase, command as uploadCommand, OWNER, OTHER } from '../uploads/database';

export { OWNER, OTHER, uploadCommand };
export const mediaMigrations = ['supabase/migrations/202610080002_media_commands.sql','supabase/migrations/202610080003_media_publish_lifecycle.sql','supabase/migrations/2026100800031_media_title_lifecycle.sql','supabase/migrations/202610080004_media_delivery_security.sql','supabase/migrations/202610080005_media_coordination.sql','supabase/migrations/202610080006_media_gateway.sql','supabase/migrations/202610080007_media_gateway_grants.sql','supabase/migrations/202610080008_title_writes_server_only.sql'];

export async function database(): Promise<PGlite> {
  const db = await legacyDatabase();
  try {
    for (const file of mediaMigrations) await db.exec(await readFile(file, 'utf8'));
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function command<T = Record<string, unknown>>(db: PGlite, action: string, payload: unknown, owner = OWNER): Promise<T> {
  const result = await db.query<{ result: T }>('SELECT gma_media_command($1,$2,$3::jsonb) AS result', [owner, action, JSON.stringify(payload)]);
  return result.rows[0]!.result;
}
