import assert from 'node:assert/strict';
import test from 'node:test';
import { gatewayCapToken } from '../../lib/media/delivery-token';

test('una ruta propia relativa (/api/media/<id>) no lleva token de pasarela y no falla', () => {
  assert.equal(gatewayCapToken('/api/media/0b3c8f0e-5d1a-4a55-9a4e-2f7f3c1d9e11'), null);
  assert.equal(gatewayCapToken('/api/titles/mi-obra/legacy-fallback'), null);
});

test('una dirección de la pasarela con ?cap= devuelve su token', () => {
  assert.equal(gatewayCapToken('https://media.example.com/hls/abc/master.m3u8?cap=tok123&x=1'), 'tok123');
});

test('una dirección absoluta sin token devuelve null', () => {
  assert.equal(gatewayCapToken('https://pub-1234.r2.dev/portada.webp'), null);
});

test('una dirección absoluta mal formada sigue siendo un error (no se oculta)', () => {
  assert.throws(() => gatewayCapToken('esto no es una url'));
});
