import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { localDatabase, localEnvironment } from './local-tools';
import type { Pool } from 'pg';

export function safeLegacyReference(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const identity = createHash('sha256').update(value).digest('hex');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { identity, origin: null, path: null, eligible: false };
    return { identity, origin: url.origin, path: url.pathname, eligible: true };
  } catch { return { identity, origin: null, path: null, eligible: false }; }
}

/** Repeatable snapshot with PostgreSQL enforcing read-only, not merely a convention. */
export async function legacyInventory(db: Pool) {
  const connection = await db.connect();
  try {
    await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const titles = await connection.query<{ title: Record<string, unknown>; main_media_id: string | null }>(
      `SELECT to_jsonb(p) AS title, pub.main_media_id FROM peliculas p
       LEFT JOIN gma_upload_publications pub ON pub.title_id=p.id ORDER BY p.id`);
    const media = await connection.query<{ state: string; count: string }>('SELECT state,count(*)::text AS count FROM gma_media_assets GROUP BY state ORDER BY state');
    const orphans = await connection.query<{ id: string; state: string }>(
      `SELECT a.id,a.state FROM gma_media_assets a WHERE a.state NOT IN ('deleted','deleting')
       AND NOT EXISTS(SELECT 1 FROM gma_draft_media m WHERE m.asset_id=a.id)
       AND NOT EXISTS(SELECT 1 FROM gma_title_media m WHERE m.asset_id=a.id) ORDER BY a.id`);
    const sessionIds=new Set((await connection.query<{id:string}>('SELECT id FROM gma_upload_sessions')).rows.map(r=>r.id));
    const assetIds=new Set((await connection.query<{id:string}>('SELECT id FROM gma_media_assets')).rows.map(r=>r.id));
    const root=path.resolve('work/media-local/storage');
    const transfers=(await readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&entry.name!=='assets').map(entry=>entry.name);
    const assets=await readdir(path.join(root,'assets')).catch((error:unknown)=>{
      if(error && typeof error==='object' && 'code'in error && error.code==='ENOENT')return [];
      throw error;
    });
    await connection.query('COMMIT');
    return { version: 1, environment: 'local', readOnly: true, titles: titles.rows.map(({ title, main_media_id }) => ({
      id: title.id, slug: title.slug, ownerId: title.creator_user_id, status: title.status,
      playbackKind: title.playback_kind ?? 'legacy', mainMediaId: main_media_id,
      references: Object.fromEntries(Object.entries(title).filter(([key,value]) => typeof value === 'string' && /(?:video|trailer|subtitle|sprite|poster).*url$|^video_url$/.test(key))
        .map(([key,value])=>[key,safeLegacyReference(value)])),
    })), mediaStates: media.rows, orphanMedia: orphans.rows,
      orphanTransferDirectories:transfers.filter(id=>!sessionIds.has(id)),orphanAssetDirectories:assets.filter(id=>!assetIds.has(id)) };
  } catch (error) { await connection.query('ROLLBACK'); throw error; }
  finally { connection.release(); }
}
async function main() {
  if (process.argv.slice(2).some(a=>a!=='--read-only')) throw new Error('MEDIA_INVENTORY_READ_ONLY_REQUIRED');
  const db = localDatabase(await localEnvironment());
  try { console.log(JSON.stringify(await legacyInventory(db), null, 2)); } finally { await db.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) void main().catch(()=>{console.error('MEDIA_LEGACY_INVENTORY_FAILED');process.exitCode=1;});
