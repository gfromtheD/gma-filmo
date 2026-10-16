import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadx } from '@/lib/media/transports/uploadx';
import type { UploadxTransferDescriptor } from '@/types/media-engine';

const descriptor = (offset: number, chunkSize = 3): UploadxTransferDescriptor => ({
  protocol: 'uploadx', url: 'http://127.0.0.1:4319/transfer/test', headers: { Authorization: 'Bearer fixture' },
  chunkSize, offset, totalBytes: 8, expiresAt: new Date(Date.now() + 60_000).toISOString(),
});
const file = new Blob(['abcdefgh'], { type: 'video/mp4' });

test('uploadx sends serial bounded chunks and trusts inclusive Range confirmations', async () => {
  const ranges: string[] = [];
  await uploadx({ file, transfer: descriptor(0), refresh: async () => descriptor(0), signal: new AbortController().signal,
    fetcher: async (_url, init) => {
      ranges.push(new Headers(init?.headers).get('content-range')!);
      const end = Number(/-(\d+)\//.exec(ranges.at(-1)!)?.[1]);
      const offset = end + 1;
      return new Response(null, { status: offset === 8 ? 200 : 308, headers: offset === 8 ? {} : { Range: `bytes=0-${offset - 1}` } });
    }, wait: async () => undefined });
  assert.deepEqual(ranges, ['bytes 0-2/8', 'bytes 3-5/8', 'bytes 6-7/8']);
});

test('uploadx recovers a lost response from the refreshed offset without duplicating bytes', async () => {
  let sends = 0; const ranges: string[] = []; const progress: number[] = [];
  await uploadx({ file, transfer: descriptor(0), refresh: async () => descriptor(3), signal: new AbortController().signal,
    fetcher: async (_url, init) => {
      sends++; ranges.push(new Headers(init?.headers).get('content-range')!);
      if (sends === 1) throw new Error('response lost after the first chunk was committed');
      const end = Number(/-(\d+)\//.exec(ranges.at(-1)!)?.[1]); const offset = end + 1;
      return new Response(null, { status: offset === 8 ? 200 : 308, headers: offset === 8 ? {} : { Range: `bytes=0-${offset - 1}` } });
    },
    onProgress: (offset) => progress.push(offset), wait: async () => undefined });
  assert.equal(sends, 3);
  assert.deepEqual(ranges, ['bytes 0-2/8', 'bytes 3-5/8', 'bytes 6-7/8']);
  assert.deepEqual(progress, [0, 3, 6, 8]);
});

test('uploadx renews an expired capability before retrying the confirmed offset', async () => {
  let sends = 0;
  let renewals = 0;
  await uploadx({ file, transfer: { ...descriptor(0), expiresAt: new Date(Date.now() - 1000).toISOString() },
    refresh: async () => { renewals++; return descriptor(0); }, signal: new AbortController().signal,
    fetcher: async () => { sends++; return new Response(null, { status: 200 }); } });
  assert.equal(renewals, 1);
  assert.equal(sends, 1);
});

test('uploadx rejects mismatched files, malformed offsets and aborts', async () => {
  await assert.rejects(uploadx({ file: new Blob(['x']), transfer: descriptor(0), refresh: async () => descriptor(0), signal: new AbortController().signal }), /IDENTITY/);
  await assert.rejects(uploadx({ file, transfer: descriptor(0), refresh: async () => descriptor(0), signal: new AbortController().signal,
    fetcher: async () => new Response(null, { status: 308, headers: { Range: 'bytes=1-5' } }) }), /RANGE/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(uploadx({ file, transfer: descriptor(0), refresh: async () => descriptor(0), signal: controller.signal }), { name: 'AbortError' });
});
