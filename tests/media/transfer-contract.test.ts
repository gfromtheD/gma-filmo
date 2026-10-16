import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transferDescriptorSchema } from '../../lib/media/contracts';

const expiration = '2026-10-07T10:00:00.000Z';

test('TransferDescriptor discriminates PUT, multipart, tus and uploadx from protocol data', () => {
  const descriptors = [
    { protocol: 'put', url: 'https://upload.example/put', headers: { 'Content-Type': 'video/mp4' }, expiresAt: expiration },
    { protocol: 'multipart', inspectUrl: 'https://gma.example/inspect', partUrl: 'https://gma.example/part', partSize: 8 * 1024 * 1024, generation: 1, concurrency: 2 },
    { protocol: 'tus', url: 'https://stream.example/files/1', chunkSize: 8 * 1024 * 1024, expiresAt: expiration },
    { protocol: 'uploadx', url: 'http://127.0.0.1:4319/transfer/1', headers: { Authorization: 'Bearer bounded' }, chunkSize: 8 * 1024 * 1024, offset: 0, totalBytes: 1024, expiresAt: expiration },
  ];

  for (const descriptor of descriptors) {
    assert.deepEqual(transferDescriptorSchema.parse(descriptor), descriptor);
  }
});

test('transfer descriptors reject provider branching, unsafe headers and invalid inclusive progress', () => {
  const uploadx = {
    protocol: 'uploadx', url: 'https://gateway.example/transfer/1', headers: {},
    chunkSize: 8 * 1024 * 1024, offset: 0, totalBytes: 1024, expiresAt: expiration,
  };

  assert.equal(transferDescriptorSchema.safeParse({ ...uploadx, provider: 'peertube' }).success, false);
  assert.equal(transferDescriptorSchema.safeParse({ ...uploadx, offset: 1025 }).success, false);
  assert.equal(transferDescriptorSchema.safeParse({ ...uploadx, chunkSize: 17 * 1024 * 1024 }).success, false);
  assert.equal(transferDescriptorSchema.safeParse({ ...uploadx, headers: { Authorization: 'ok\r\nX-Evil: yes' } }).success, false);
  assert.equal(transferDescriptorSchema.safeParse({ ...uploadx, url: 'https://user:password@gateway.example/transfer' }).success, false);
});
