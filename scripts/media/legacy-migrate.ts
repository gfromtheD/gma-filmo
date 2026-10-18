import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { localDatabase, localEnvironment } from './local-tools';
import { legacyInventory } from './legacy-inventory';

export function migrationDryRun(inventory: Awaited<ReturnType<typeof legacyInventory>>) {
  return { version: 1, mode: 'dry-run', writes: 0, networkRequests: 0,
    items: inventory.titles.map(title=>({ titleId: title.id, slug: title.slug,
      action: title.mainMediaId ? 'skip-neutral' : 'review-legacy', references: title.references,
      blockers: title.mainMediaId ? [] : ['VPS_REQUIRED','REMOTE_SOURCE_SHA_DURATION_AND_OWNERSHIP_UNVERIFIED'],
      futureMapping: { titleId: title.id, legacyReferenceSha256: Object.values(title.references).map(r=>r?.identity), targetMediaId: null },
      rollback: 'retain original legacy URLs and snapshots; never delete the source before acceptance and backup',
    })) };
}
async function main() {
  const args=process.argv.slice(2);
  if (!args.includes('--dry-run') || args.some(a=>a!=='--dry-run')) throw new Error('MEDIA_MIGRATION_APPLY_DISABLED_PRE_VPS');
  const db=localDatabase(await localEnvironment());
  try { console.log(JSON.stringify(migrationDryRun(await legacyInventory(db)),null,2)); } finally { await db.end(); }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) void main().catch(()=>{console.error('MEDIA_MIGRATION_APPLY_DISABLED_OR_DRY_RUN_FAILED');process.exitCode=1;});
