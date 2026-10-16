import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteLegacyTitle } from '@/lib/media/legacy-title-writes';

function fakeClient(row: unknown, deleteError: { message: string } | null = null) {
  const deleted: string[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      delete: () => ({ eq: async (_c: string, slug: string) => { deleted.push(slug); return { error: deleteError }; } }),
    }),
  };
  return { client, deleted };
}

test('el borrado histórico solo borra títulos del propietario', async () => {
  const own = fakeClient({ id: 1, creator_user_id: 'u1' });
  assert.deepEqual(await deleteLegacyTitle('u1', 'mi-corto', own.client as never), { status: 200, body: { ok: true } });
  assert.deepEqual(own.deleted, ['mi-corto']);

  const other = fakeClient({ id: 1, creator_user_id: 'u2' });
  assert.equal((await deleteLegacyTitle('u1', 'ajeno', other.client as never)).status, 403);
  assert.deepEqual(other.deleted, []);
});

test('título inexistente → 404 y error de borrado → 500 sin éxito falso', async () => {
  assert.equal((await deleteLegacyTitle('u1', 'nada', fakeClient(null).client as never)).status, 404);
  const failing = fakeClient({ id: 1, creator_user_id: 'u1' }, { message: 'boom' });
  assert.deepEqual(await deleteLegacyTitle('u1', 'x', failing.client as never), { status: 500, body: { error: 'boom' } });
});
