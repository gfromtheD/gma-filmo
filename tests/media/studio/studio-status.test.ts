import assert from 'node:assert/strict';
import test from 'node:test';
import { toStudioTitleStatus } from '@/lib/studio-media/title-status';

test('owner Studio status mapper preserves legacy and lifecycle states with deletion precedence', () => {
  assert.equal(toStudioTitleStatus(null, 'none'), 'publicado');
  assert.equal(toStudioTitleStatus('published', 'none'), 'publicado');
  assert.equal(toStudioTitleStatus('unpublished', 'none'), 'retirado');
  assert.equal(toStudioTitleStatus('draft', 'none'), 'borrador');
  assert.equal(toStudioTitleStatus('review', 'none'), 'revision');
  assert.equal(toStudioTitleStatus('rejected', 'none'), 'rechazado');
  assert.equal(toStudioTitleStatus('published', 'pending'), 'borrado_pendiente');
  assert.equal(toStudioTitleStatus('published', 'done'), 'eliminado');
});

test('unknown persisted status is diagnosed and maps to the safe review state', () => {
  const observed: string[] = [];
  assert.equal(toStudioTitleStatus('future-state', 'none', value => observed.push(value)), 'revision');
  assert.deepEqual(observed, ['future-state']);
});
