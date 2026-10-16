import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, readdir } from 'node:fs/promises';
import path from 'node:path';
import { MockMediaStorage, type MockChunkInput } from '../../lib/media/mock-storage';
import { serviceHarness } from './service-harness';
import { OWNER } from './database';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('5.2 a stale SQL writer leaves no canonical chunk while a new writer promotes the only fenced receipt', async () => {
  const h = await serviceHarness(Buffer.from('current!'));
  try {
    const session = await h.repo.session(h.id);
    const old = await h.repo.claimTransfer(OWNER, h.id, 1, 'old-writer');
    await h.db.query("UPDATE gma_upload_sessions SET transfer_lease_until=now()-interval '1 second' WHERE id=$1", [h.id]);
    const current = await h.repo.claimTransfer(OWNER, h.id, 1, 'current-writer');
    assert.ok(current.fence > old.fence);
    let entered = 0;
    let release = () => {};
    const bothFsynced = new Promise<void>(resolve => { release = resolve; });
    const input = (bytes: Buffer, fence: number): MockChunkInput => ({
      sessionId: h.id, assetId: session.asset_id, generation: 1, fence,
      expectedBytes: h.bytes.length, startByte: 0, endByte: h.bytes.length - 1,
      sha256: digest(bytes), bytes,
    });
    const confirm = (writer: string, chunk: MockChunkInput) => async () => {
      entered += 1; if (entered === 2) release(); await bothFsynced;
      await h.repo.commitChunk(OWNER, { sessionId: h.id, generation: 1, writer, fence: chunk.fence,
        startByte: chunk.startByte, endByte: chunk.endByte, sha256: chunk.sha256,
        storageRelative: `transfer/${h.id}/1/chunks/${chunk.startByte}-${chunk.endByte}-${chunk.sha256}.bin`, upstreamConfirmed: true });
    };
    const staleInput = input(Buffer.from('staleXYZ'), old.fence), currentInput = input(h.bytes, current.fence);
    const [staleResult, currentResult] = await Promise.allSettled([
      new MockMediaStorage(h.root).writeChunk(staleInput, confirm('old-writer', staleInput)),
      new MockMediaStorage(h.root).writeChunk(currentInput, confirm('current-writer', currentInput)),
    ]);
    assert.equal(staleResult?.status, 'rejected');
    if (staleResult?.status === 'rejected') assert.match(String(staleResult.reason), /UPLOAD_LEASE_LOST/);
    assert.deepEqual(currentResult, { status: 'fulfilled', value: h.bytes.length });
    const files = await readdir(path.join(h.root, h.id, 'g1'));
    assert.deepEqual(files.filter(file => file.startsWith('chunk-')), [`chunk-0-7-${digest(h.bytes)}.bin`]);
    // A rejected/uncertain commit may retain private pending bytes, but SQL alone controls promotion.
    assert.equal(files.some(file => file === `chunk-0-7-${digest(staleInput.bytes)}.bin`), false);
    const sql = await h.db.query<{ writer_fence: number; sha256: string }>('SELECT writer_fence,sha256 FROM gma_media_upload_chunks WHERE session_id=$1', [h.id]);
    assert.deepEqual(sql.rows, [{ writer_fence: current.fence, sha256: digest(h.bytes) }]);
    const recovered = await new MockMediaStorage(h.root).offset(h.id, 1);
    assert.equal(recovered.offset, h.bytes.length); assert.equal(recovered.chunks.length, 1);
  } finally { await h.close(); }
});

test('5.2 restart promotes only a pending chunk matched by its durable SQL fence/range/SHA receipt', async () => {
  const h = await serviceHarness(Buffer.from('current!'));
  try {
    const directory = path.join(h.root, h.id, 'g1'); await mkdir(directory, { recursive: true, mode: 0o700 });
    const current = await h.repo.claimTransfer(OWNER, h.id, 1, 'crash-fixture');
    const writePending = async (fence: number, bytes: Buffer) => {
      const filename = `.pending-${fence}-0-7-${digest(bytes)}.bin`;
      const handle = await open(path.join(directory, filename), 'wx', 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    };
    // Both are durable scratch, but no SQL receipt means neither is yet canonical or confirmed.
    await writePending(current.fence, h.bytes); await writePending(current.fence + 99, Buffer.from('orphan!!'));
    const restarted = new MockMediaStorage(h.root);
    await restarted.recoverCommitted(h.id, 1, []);
    assert.equal((await restarted.offset(h.id, 1)).offset, 0);
    await h.repo.commitChunk(OWNER, { sessionId: h.id, generation: 1, writer: 'crash-fixture', fence: current.fence,
      startByte: 0, endByte: 7, sha256: digest(h.bytes), storageRelative: `transfer/${h.id}/1/chunks/0-7-${digest(h.bytes)}.bin`, upstreamConfirmed: true });
    const committed = await h.db.query<{ start_byte: number; end_byte: number; sha256: string; writer_fence: number }>(
      'SELECT start_byte,end_byte,sha256,writer_fence FROM gma_media_upload_chunks WHERE session_id=$1 AND generation=1 ORDER BY start_byte', [h.id]);
    await restarted.recoverCommitted(h.id, 1, committed.rows);
    const recovered = await restarted.offset(h.id, 1);
    assert.equal(recovered.offset, h.bytes.length); assert.deepEqual(recovered.chunks.map(chunk => chunk.sha256), [digest(h.bytes)]);
    const files = await readdir(directory);
    assert.deepEqual(files.filter(file => file.startsWith('chunk-')), [`chunk-0-7-${digest(h.bytes)}.bin`]);
    // The unconfirmed orphan can remain private for janitor cleanup, but never becomes an upload receipt.
    assert.equal((await h.repo.transferChunks(h.id, 1)).length, 1);
  } finally { await h.close(); }
});
