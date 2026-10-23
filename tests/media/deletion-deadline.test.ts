import assert from 'node:assert/strict';
import test from 'node:test';
import { auxiliaryDeletionDeadline, signedUrlExpiry, SIGNED_URL_SKEW_MS } from '@/lib/media/providers/deletion-deadline';

const NOW = Date.parse('2026-10-22T19:00:00.000Z');
const HOUR = 3600_000;
const amzDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const url = (signedAt: number, seconds: number) =>
  `https://acct.r2.cloudflarestorage.com/bucket/ingest/x?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=${amzDate(signedAt)}&X-Amz-Expires=${seconds}&X-Amz-Signature=abc`;

test('lee la caducidad exacta de la URL firmada', () => {
  assert.equal(signedUrlExpiry(url(NOW, 3600)), NOW + HOUR);
  assert.equal(signedUrlExpiry('no-es-url'), null);
  assert.equal(signedUrlExpiry(undefined), null);
});

test('una imagen subida hace horas se confirma al instante, no a las 24 h de la sesión', () => {
  const session = new Date(NOW + 9 * HOUR).toISOString();
  const deadline = auxiliaryDeletionDeadline(session, url(NOW - 15 * HOUR, 3600), NOW);
  assert.ok(deadline <= NOW);
});

test('una URL todavía vigente retrasa el borrado hasta su caducidad más el margen de reloj', () => {
  const session = new Date(NOW + 23 * HOUR).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, url(NOW - 30 * 60_000, 3600), NOW), NOW + 30 * 60_000 + SIGNED_URL_SKEW_MS);
});

test('nunca espera más que la propia sesión', () => {
  const session = new Date(NOW + 10 * 60_000).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, url(NOW, 3600), NOW), NOW + 10 * 60_000);
});

test('sin una URL legible se mantiene el plazo conservador de la sesión', () => {
  const session = new Date(NOW + 23 * HOUR).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, undefined, NOW), NOW + 23 * HOUR);
  assert.equal(auxiliaryDeletionDeadline(session, 'https://x.example/sin-firma', NOW), NOW + 23 * HOUR);
});

test('una sesión ya caducada no exige esperar nada', () => {
  const session = new Date(NOW - HOUR).toISOString();
  assert.equal(auxiliaryDeletionDeadline(session, undefined, NOW), NOW);
});
