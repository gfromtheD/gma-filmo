import assert from 'node:assert/strict';
import test from 'node:test';
import { PROVISION_GIVE_UP_MS, provisioningNeverBound } from '@/lib/media/stale-provision';

const NOW = Date.parse('2026-10-22T20:00:00.000Z');
const created = (msAgo: number) => new Date(NOW - msAgo).toISOString();

test('un provisioning sin archivo atado y pasado el plazo se da por limpio', () => {
  assert.equal(provisioningNeverBound({ privateState: {}, providerData: { provision_started: true }, createdAt: created(PROVISION_GIVE_UP_MS + 1000), now: NOW }), true);
});

test('dentro del plazo todavía puede estar en curso: se espera', () => {
  assert.equal(provisioningNeverBound({ privateState: {}, providerData: { provision_started: true }, createdAt: created(10 * 60_000), now: NOW }), false);
});

test('si el proveedor ya tiene un archivo atado (uploadId) nunca se da por limpio', () => {
  assert.equal(provisioningNeverBound({ privateState: { uploadId: 'abc' }, providerData: { provision_started: true }, createdAt: created(5 * PROVISION_GIVE_UP_MS), now: NOW }), false);
});

test('la creación pendiente con la respuesta perdida también caduca', () => {
  assert.equal(provisioningNeverBound({ privateState: { creation_pending: true }, providerData: {}, createdAt: created(PROVISION_GIVE_UP_MS + 1), now: NOW }), true);
});

test('sin señal de provisioning iniciado no se asume nada', () => {
  assert.equal(provisioningNeverBound({ privateState: {}, providerData: {}, createdAt: created(5 * PROVISION_GIVE_UP_MS), now: NOW }), false);
});

test('una fecha de creación ilegible no se interpreta como caducada', () => {
  assert.equal(provisioningNeverBound({ privateState: {}, providerData: { provision_started: true }, createdAt: 'no-es-fecha', now: NOW }), false);
});
