import assert from 'node:assert/strict';
import test from 'node:test';
import { auxiliaryDeletionDeadline, SIGNED_URL_GRACE_MS } from '@/lib/media/providers/deletion-deadline';

const NOW = Date.parse('2026-10-22T19:00:00.000Z');
const HOUR = 3600_000;

test('una imagen ya subida espera a que caduque su URL firmada (+1 h), no a la sesión de 24 h', () => {
  const session = new Date(NOW + 23 * HOUR).toISOString();
  const urlExpiry = new Date(NOW - 20 * 60_000).toISOString(); // ya caducó hace 20 min
  assert.equal(auxiliaryDeletionDeadline(session, urlExpiry, NOW), NOW + SIGNED_URL_GRACE_MS);
});

test('una URL todavía vigente retrasa el borrado hasta su caducidad más el margen', () => {
  const session = new Date(NOW + 23 * HOUR).toISOString();
  const urlExpiry = new Date(NOW + 30 * 60_000).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, urlExpiry, NOW), NOW + 30 * 60_000 + SIGNED_URL_GRACE_MS);
});

test('nunca espera más que la propia sesión', () => {
  const session = new Date(NOW + 10 * 60_000).toISOString();
  const urlExpiry = new Date(NOW + 50 * 60_000).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, urlExpiry, NOW), NOW + 10 * 60_000);
});

test('sin dato fiable de la URL se mantiene el plazo conservador de la sesión', () => {
  const session = new Date(NOW + 23 * HOUR).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, undefined, NOW), NOW + 23 * HOUR);
  assert.equal(auxiliaryDeletionDeadline(session, 'no-es-una-fecha', NOW), NOW + 23 * HOUR);
});

test('una sesión ya caducada no exige esperar nada', () => {
  const session = new Date(NOW - HOUR).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, undefined, NOW), NOW);
});
