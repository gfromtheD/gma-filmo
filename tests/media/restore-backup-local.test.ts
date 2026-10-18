import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRestoreDatabase, assertRestorePort, restoreSavedBackupLocal } from '../../scripts/media/restore-backup-local';

test('V.1 restore cannot target fixture ports, existing databases or unapproved execution', async () => {
  for (const value of [4318, 4319, 54341, 54342, 54343, 54344, 54345, 54346, 22, 0, NaN, 65536]) assert.throws(() => assertRestorePort(value));
  assertRestorePort(55001);
  for (const value of ['postgres', 'production', 'rollback_copy', 'v1_source; DROP DATABASE postgres']) assert.throws(() => assertRestoreDatabase(value));
  assertRestoreDatabase('v1_source');
  const previous = process.env.MEDIA_RESTORE_BACKUP_AUTHORIZED;
  delete process.env.MEDIA_RESTORE_BACKUP_AUTHORIZED;
  try { await assert.rejects(restoreSavedBackupLocal(), /V1_RESTORE_EXPLICIT_AUTHORIZATION_REQUIRED/); }
  finally { if (previous === undefined) delete process.env.MEDIA_RESTORE_BACKUP_AUTHORIZED; else process.env.MEDIA_RESTORE_BACKUP_AUTHORIZED = previous; }
});
