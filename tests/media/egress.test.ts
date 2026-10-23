import assert from 'node:assert/strict';
import test from 'node:test';
import { bytesEnviados, createEgressMeter, nivelPara } from '../../lib/media/gateway/egress';

const procNetDev = (eth0Tx: number) => `Inter-|   Receive |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 999999999 1 0 0 0 0 0 0 999999999 1 0 0 0 0 0 0
  eth0: 1000 10 0 0 0 0 0 0 ${eth0Tx} 20 0 0 0 0 0 0
`;

test('lee los bytes enviados de la tarjeta de red (sin contar lo)', () => {
  assert.equal(bytesEnviados(procNetDev(5000)), 5000);
});

test('el semáforo sube por umbrales y baja con margen (no oscila en el borde)', () => {
  assert.equal(nivelPara(0.5, 'alta'), 'alta');
  assert.equal(nivelPara(0.8, 'alta'), 'media');
  assert.equal(nivelPara(0.95, 'media'), 'baja');
  assert.equal(nivelPara(0.88, 'baja'), 'baja');   // aún no ha bajado lo bastante
  assert.equal(nivelPara(0.8, 'baja'), 'media');
  assert.equal(nivelPara(0.72, 'media'), 'media'); // margen antes de volver a alta
  assert.equal(nivelPara(0.6, 'media'), 'alta');
});

test('mide la salida en Mbit/s entre dos lecturas y da el nivel', async () => {
  let t = 0, tx = 0;
  const medidor = createEgressMeter({ capacidadMbps: 1000, leer: async () => procNetDev(tx), ahora: () => t });
  await medidor.carga();                 // primera lectura: sin intervalo todavía
  t = 10_000; tx = 10 * 900e6 / 8;       // 900 Mbit/s durante 10 s
  const carga = await medidor.carga();
  assert.equal(Math.round(carga.salidaMbps), 900);
  assert.equal(carga.nivel, 'baja');
});
