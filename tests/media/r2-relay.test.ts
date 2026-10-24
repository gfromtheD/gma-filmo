import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { relayAuxiliaryToR2 } from '../../lib/media/gateway/r2-relay';
import { R2MediaProvider } from '../../lib/media/providers/r2';
import { transferDescriptorSchema } from '../../lib/media/contracts';
import type { ProviderUploadContext } from '../../lib/media/provider';
import type { R2VideoProvider } from '../../lib/uploads/r2-video';
import type { AuxiliaryProvider } from '../../lib/uploads/auxiliary';

const R2_URL = 'https://gma-uploads-private.abc123.r2.cloudflarestorage.com/ingest/o/s?X-Amz-Signature=x';
const bytes = Buffer.from('imagen de prueba');
const sha = createHash('sha256').update(bytes).digest('hex');
const session = { expected_input_bytes: bytes.length, content_type: 'image/jpeg', source_sha256: sha };

function request(body: Buffer, length = body.length): IncomingMessage {
  return Object.assign(Readable.from([body]), { headers: { 'content-length': String(length) }, aborted: false }) as unknown as IncomingMessage;
}

function fakePut(status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const put = async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init ?? {} }); return new Response(null, { status }); };
  return { calls, put: put as typeof fetch };
}

test('la pasarela deja la imagen en R2 con la URL firmada de la sesión, el tipo y los bytes exactos', async () => {
  const r2 = fakePut();
  await relayAuxiliaryToR2(request(bytes), session, { uploadUrl: R2_URL }, r2.put);
  assert.equal(r2.calls.length, 1);
  assert.equal(r2.calls[0]!.url, R2_URL);
  assert.equal(r2.calls[0]!.init.method, 'PUT');
  assert.equal((r2.calls[0]!.init.headers as Record<string, string>)['Content-Type'], 'image/jpeg');
  assert.deepEqual(Buffer.from(r2.calls[0]!.init.body as Uint8Array), bytes);
});

test('si los bytes no son los declarados (SHA-256), no se envía nada a R2', async () => {
  const r2 = fakePut();
  await assert.rejects(relayAuxiliaryToR2(request(Buffer.from('otra imagen distinta')), { ...session, expected_input_bytes: 20 }, { uploadUrl: R2_URL }, r2.put),
    { code: 'UPLOAD_SOURCE_MISMATCH' });
  assert.equal(r2.calls.length, 0);
});

test('solo reenvía a R2: otra URL guardada en la sesión se rechaza sin enviarle nada', async () => {
  const r2 = fakePut();
  await assert.rejects(relayAuxiliaryToR2(request(bytes), session, { uploadUrl: 'https://attacker.invalid/x' }, r2.put), { code: 'UPLOAD_PROVISION_RECOVERY_REQUIRED' });
  await assert.rejects(relayAuxiliaryToR2(request(bytes), session, {}, r2.put), { code: 'UPLOAD_PROVISION_RECOVERY_REQUIRED' });
  assert.equal(r2.calls.length, 0);
});

test('si R2 no acepta la imagen, el navegador recibe un error del proveedor (puede reintentar)', async () => {
  await assert.rejects(relayAuxiliaryToR2(request(bytes), session, { uploadUrl: R2_URL }, fakePut(403).put), { code: 'MEDIA_PROVIDER_UNAVAILABLE' });
});

function posterContext(): ProviderUploadContext {
  const id = '33333333-3333-4333-8333-333333333333';
  return {
    session: { id, asset_id: id, role: 'poster', provider: 'r2', content_type: 'image/jpeg', expected_input_bytes: bytes.length,
      expires_at: '2099-01-01T00:00:00.000Z', provider_ref: 'ingest/o/s', provider_data: {}, max_duration_seconds: 0 },
    asset: { id }, privateState: { providerRef: 'ingest/o/s', uploadUrl: R2_URL, expiresAt: '2099-01-01T00:00:00.000Z' },
    transferGeneration: 1,
  } as unknown as ProviderUploadContext;
}

test('con pasarela, el navegador sube las imágenes a la pasarela con un permiso firmado, no directamente a R2', async () => {
  const issued: unknown[] = [];
  const issuer = { issue: (input: unknown) => { issued.push(input); return { token: 'tok', expiresAt: Date.parse('2099-01-01T00:00:00.000Z') }; } };
  const provider = new R2MediaProvider({} as R2VideoProvider, {} as AuxiliaryProvider, { gatewayUrl: 'https://gateway.example', issuer });
  const transfer = transferDescriptorSchema.parse(await provider.getTransfer(posterContext()));
  assert.equal(transfer.protocol, 'put');
  assert.equal(transfer.protocol === 'put' && transfer.url, 'https://gateway.example/auxiliary/33333333-3333-4333-8333-333333333333');
  assert.equal(transfer.protocol === 'put' && transfer.headers.Authorization, 'Bearer tok');
  assert.deepEqual(issued, [{ sessionId: '33333333-3333-4333-8333-333333333333', assetId: '33333333-3333-4333-8333-333333333333', generation: 1,
    scope: 'upload', method: 'PUT', namespace: 'transfer/33333333-3333-4333-8333-333333333333/1/', expectedBytes: bytes.length, ttlSeconds: 900 }]);
});

test('sin pasarela configurada, las imágenes siguen subiendo directamente a R2 como antes', async () => {
  const provider = new R2MediaProvider({} as R2VideoProvider, {} as AuxiliaryProvider);
  const transfer = transferDescriptorSchema.parse(await provider.getTransfer(posterContext()));
  assert.equal(transfer.protocol === 'put' && transfer.url, R2_URL);
});
