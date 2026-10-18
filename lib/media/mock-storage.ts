import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, link, mkdir, open, readFile, readdir, rm, stat, statfs, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Transform } from 'node:stream';
import { z } from 'zod';
import { MediaError } from './errors';

const uuid = z.string().uuid();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const maxChunkBytes = 16 * 1024 * 1024;

export interface MockChunkInput {
  sessionId: string; assetId: string; generation: number; fence: number;
  startByte: number; endByte: number; expectedBytes: number; sha256: string; bytes: Uint8Array;
}
export interface MockChunk { startByte: number; endByte: number; sha256: string; size: number; filePath: string }
export interface MockCompleteReceipt { size: number; sha256: string; chunkManifestHash: string; filePath: string }
export interface MockFixtureFile { relative: string; sha256: string; size: number }

export class MockMediaStorage {
  readonly root: string;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(root: string) {
    if (!path.isAbsolute(root)) throw new MediaError('UPLOAD_INVALID_INPUT');
    this.root = path.resolve(root);
    const publicPath = path.resolve(process.cwd(), 'public') + path.sep;
    if (this.root === path.resolve(process.cwd(), 'public') || this.root.startsWith(publicPath)) throw new MediaError('UPLOAD_INVALID_INPUT');
  }

  private sessionDir(sessionId: string): string { return path.join(this.root, uuid.parse(sessionId)); }
  private generationDir(sessionId: string, generation: number): string {
    if (!Number.isSafeInteger(generation) || generation < 1) throw new MediaError('UPLOAD_INVALID_INPUT');
    return path.join(this.sessionDir(sessionId), `g${generation}`);
  }
  private async exclusive<T>(sessionId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(sessionId) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.locks.set(sessionId, queued);
    await previous;
    try { return await action(); }
    finally { release(); if (this.locks.get(sessionId) === queued) this.locks.delete(sessionId); }
  }

  private tombstonePath(sessionId: string): string { return path.join(this.sessionDir(sessionId), 'cancelled'); }
  private async assertNotCancelled(sessionId: string): Promise<void> {
    try { await stat(this.tombstonePath(sessionId)); throw new MediaError('UPLOAD_CANCELLED'); }
    catch (error) { if (error instanceof MediaError) throw error; if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  async offset(sessionId: string, generation: number): Promise<{ offset: number; chunks: MockChunk[] }> {
    uuid.parse(sessionId);
    await this.assertNotCancelled(sessionId);
    const directory = this.generationDir(sessionId, generation);
    let names: string[];
    try { names = await readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { offset: 0, chunks: [] }; throw error; }
    const chunks: MockChunk[] = [];
    for (const name of names) {
      const match = /^chunk-(\d+)-(\d+)-([a-f0-9]{64})\.bin$/.exec(name);
      if (!match) continue;
      const startByte = Number(match[1]); const endByte = Number(match[2]); const digest = match[3]!;
      const filePath = path.join(directory, name); const body = await readFile(filePath);
      if (body.length !== endByte - startByte + 1 || createHash('sha256').update(body).digest('hex') !== digest) {
        throw new MediaError('UPLOAD_SOURCE_MISMATCH');
      }
      chunks.push({ startByte, endByte, sha256: digest, size: body.length, filePath });
    }
    chunks.sort((a, b) => a.startByte - b.startByte);
    let offset = 0;
    for (const chunk of chunks) {
      if (chunk.startByte !== offset) throw new MediaError('UPLOAD_REVISION_CONFLICT');
      offset = chunk.endByte + 1;
    }
    return { offset, chunks };
  }

  async recoverCommitted(sessionId:string,generation:number,receipts:readonly {start_byte:number;end_byte:number;sha256:string;writer_fence:number}[]):Promise<{offset:number;chunks:MockChunk[]}>{
    await this.assertNotCancelled(sessionId);const directory=this.generationDir(sessionId,generation);let offset=0;const chunks:MockChunk[]=[];
    for(const row of receipts){
      if(row.start_byte!==offset || row.end_byte<offset || row.end_byte-row.start_byte+1>maxChunkBytes || !Number.isSafeInteger(row.writer_fence) || row.writer_fence<1)throw new MediaError('UPLOAD_SOURCE_MISMATCH');
      sha256.parse(row.sha256);
      const filePath=path.join(directory,`chunk-${row.start_byte}-${row.end_byte}-${row.sha256}.bin`);
      const pending=path.join(directory,`.pending-${row.writer_fence}-${row.start_byte}-${row.end_byte}-${row.sha256}.bin`);
      try {await stat(filePath);}catch(error){
        if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
        const staged=await hashFile(pending);if(staged.size!==row.end_byte-row.start_byte+1 || staged.sha256!==row.sha256)throw new MediaError('UPLOAD_SOURCE_MISMATCH');
        try{await link(pending,filePath);}catch(linkError){if((linkError as NodeJS.ErrnoException).code!=='EEXIST')throw linkError;}
        await syncDirectory(directory);await unlink(pending).catch(()=>undefined);
      }
      const verified=await hashFile(filePath);if(verified.size!==row.end_byte-row.start_byte+1 || verified.sha256!==row.sha256)throw new MediaError('UPLOAD_SOURCE_MISMATCH');
      chunks.push({startByte:row.start_byte,endByte:row.end_byte,sha256:row.sha256,size:verified.size,filePath});offset=row.end_byte+1;
    }
    return {offset,chunks};
  }

  async writeChunk(input: MockChunkInput, commit?:()=>Promise<void>): Promise<number> {
    return this.exclusive(input.sessionId, async () => {
      uuid.parse(input.sessionId); uuid.parse(input.assetId); sha256.parse(input.sha256);
      if (!Number.isSafeInteger(input.fence) || input.fence < 1 || !Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 1
        || !Number.isSafeInteger(input.startByte) || !Number.isSafeInteger(input.endByte) || input.startByte < 0
        || input.endByte < input.startByte || input.endByte >= input.expectedBytes || input.endByte - input.startByte + 1 > maxChunkBytes
        || input.bytes.byteLength !== input.endByte - input.startByte + 1
        || createHash('sha256').update(input.bytes).digest('hex') !== input.sha256) throw new MediaError('UPLOAD_INVALID_INPUT');
      await this.assertNotCancelled(input.sessionId);
      const directory = this.generationDir(input.sessionId, input.generation);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const current = await this.offset(input.sessionId, input.generation);
      const fileName = `chunk-${input.startByte}-${input.endByte}-${input.sha256}.bin`;
      const destination = path.join(directory, fileName);
      const already = current.chunks.find((chunk) => chunk.startByte === input.startByte);
      if (already) {
        if (already.endByte !== input.endByte || already.sha256 !== input.sha256) throw new MediaError('IDEMPOTENCY_CONFLICT');
        if(commit)await commit();return current.offset;
      }
      if (current.offset !== input.startByte) throw new MediaError('UPLOAD_REVISION_CONFLICT');
      const temporary = path.join(directory, `.pending-${input.fence}-${input.startByte}-${input.endByte}-${input.sha256}.bin`);
      try {
        const handle = await open(temporary, 'wx', 0o600);
        try { await handle.writeFile(input.bytes); await handle.sync(); }finally {await handle.close();}
      }catch(error){
        if((error as NodeJS.ErrnoException).code!=='EEXIST'){await unlink(temporary).catch(()=>undefined);throw error;}
        const staged=await hashFile(temporary);if(staged.size!==input.bytes.byteLength || staged.sha256!==input.sha256)throw new MediaError('IDEMPOTENCY_CONFLICT');
      }
      await syncDirectory(directory);
      // Keep an uncertain/rejected SQL attempt private. Only a durable SQL receipt can recover this pending file.
      if(commit)await commit();
      await this.assertNotCancelled(input.sessionId);
      try { await link(temporary, destination); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const existing = await hashFile(destination);
        if (existing.size !== input.bytes.byteLength || existing.sha256 !== input.sha256) throw new MediaError('IDEMPOTENCY_CONFLICT');
      }
      await syncDirectory(directory);await unlink(temporary).catch(()=>undefined);
      await this.assertNotCancelled(input.sessionId);
      return input.endByte + 1;
    });
  }

  async complete(sessionId: string, assetId: string, generation: number, expectedBytes: number, expectedSha256: string): Promise<MockCompleteReceipt> {
    return this.exclusive(sessionId, async () => {
      uuid.parse(assetId); sha256.parse(expectedSha256);
      await this.assertNotCancelled(sessionId);
      const { offset, chunks } = await this.offset(sessionId, generation);
      if (offset !== expectedBytes || chunks.length === 0) throw new MediaError('UPLOAD_NOT_COMPLETE');
      const directory = this.generationDir(sessionId, generation);
      const finalPath = path.join(directory, 'original.bin');
      const chunkManifestHash = createHash('sha256').update(JSON.stringify(chunks.map(({ startByte, endByte, sha256: hash }) => ({ startByte, endByte, sha256: hash })))).digest('hex');
      try {
        const existing=await hashFile(finalPath);
        if(existing.size!==expectedBytes || existing.sha256!==expectedSha256)throw new MediaError('IDEMPOTENCY_CONFLICT');
        return {...existing,chunkManifestHash,filePath:finalPath};
      } catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      const free=await statfs(directory,{bigint:true});
      if(free.bavail*free.bsize<BigInt(expectedBytes))throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE',{status:507,retryable:true});
      const tempPath = path.join(directory, `.complete-${randomUUID()}`);
      try {
      const digest = createHash('sha256'); let size = 0;
      const hashAndCount = new Transform({ transform(chunk: Buffer, _encoding, callback) { digest.update(chunk); size += chunk.length; callback(null, chunk); } });
      const concatenated = Readable.from((async function* () {
        for (const chunk of chunks) for await (const bytes of createReadStream(chunk.filePath)) yield bytes;
      })());
      try {await pipeline(concatenated, hashAndCount, createWriteStream(tempPath, { flags: 'wx', mode: 0o600 }));}
      catch(error){await unlink(tempPath).catch(()=>undefined);throw error;}
      // 'r+': en Windows fsync exige un descriptor con escritura (FlushFileBuffers); en POSIX es equivalente.
      const handle = await open(tempPath, 'r+'); try { await handle.sync(); } finally { await handle.close(); }
      const actualSha256 = digest.digest('hex');
      if (size !== expectedBytes || actualSha256 !== expectedSha256) {
        await unlink(tempPath).catch(() => undefined); throw new MediaError('UPLOAD_SOURCE_MISMATCH');
      }
      await this.assertNotCancelled(sessionId);
      try { await link(tempPath, finalPath); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const existing = await hashFile(finalPath);
        if (existing.size !== expectedBytes || existing.sha256 !== expectedSha256) throw new MediaError('IDEMPOTENCY_CONFLICT');
      } finally { await unlink(tempPath).catch(() => undefined); }
      await syncDirectory(directory);
      return { size, sha256: actualSha256, chunkManifestHash, filePath: finalPath };
      } finally {await unlink(tempPath).catch(()=>undefined);}
    });
  }

  async cancel(sessionId: string, generation: number): Promise<void> {
    await this.exclusive(sessionId, async () => {
      uuid.parse(sessionId);
      const directory = this.sessionDir(sessionId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const tombstone = this.tombstonePath(sessionId);
      try { const handle = await open(tombstone, 'wx', 0o600); await handle.writeFile(String(generation)); await handle.sync(); await handle.close(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      await rm(this.generationDir(sessionId, generation), { recursive: true, force: true });
    });
  }

  async delete(sessionId: string, assetId: string): Promise<void> {
    uuid.parse(sessionId); uuid.parse(assetId);
    await this.cancel(sessionId, 1);
    const sessionDirectory = this.sessionDir(sessionId);
    const entries = await readdir(sessionDirectory).catch(() => [] as string[]);
    await Promise.all(entries.filter((entry) => entry !== 'cancelled').map((entry) => rm(path.join(sessionDirectory, entry), { recursive: true, force: true })));
    await rm(path.join(this.root, 'assets', assetId), { recursive: true, force: true });
  }

  /** Claims a one-shot deterministic scenario across process restarts. */
  async claimScenarioOnce(sessionId: string, scenario: string): Promise<boolean> {
    uuid.parse(sessionId);
    if (!/^[a-z0-9-]{1,64}$/.test(scenario)) throw new MediaError('UPLOAD_INVALID_INPUT');
    const directory = path.join(this.sessionDir(sessionId), 'scenarios');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      const handle = await open(path.join(directory, scenario), 'wx', 0o600);
      await handle.writeFile('claimed'); await handle.sync(); await handle.close();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  }

  assetPath(assetId: string, generation: number, relative: string): string {
    uuid.parse(assetId);
    if (!Number.isSafeInteger(generation) || generation < 1 || !/^[a-zA-Z0-9_./-]{1,512}$/.test(relative)
      || relative.startsWith('/') || relative.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')) {
      throw new MediaError('UPLOAD_INVALID_INPUT');
    }
    const base = path.resolve(this.root, 'assets', assetId, `g${generation}`);
    const result = path.resolve(base, relative);
    if (!result.startsWith(`${base}${path.sep}`)) throw new MediaError('UPLOAD_INVALID_INPUT');
    return result;
  }

  async installOutput(assetId: string, generation: number, relative: string, bytes: Uint8Array): Promise<void> {
    const target = this.assetPath(assetId, generation, relative); await mkdir(path.dirname(target), { recursive:true,mode:0o700 });
    const temporary=`${target}.normalized-${randomUUID()}`;
    const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    try {await link(temporary,target);} catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      const existing=await hashFile(target);if(existing.size!==bytes.byteLength || existing.sha256!==createHash('sha256').update(bytes).digest('hex'))throw new MediaError('IDEMPOTENCY_CONFLICT');
    } finally {await unlink(temporary).catch(()=>undefined);}
  }
  async installFixture(assetId: string, generation: number, fixtureRoot: string, files: readonly MockFixtureFile[]): Promise<void> {
    uuid.parse(assetId);
    if (!path.isAbsolute(fixtureRoot) || files.length === 0) throw new MediaError('UPLOAD_INVALID_INPUT');
    for (const file of files) {
      sha256.parse(file.sha256);
      if (!Number.isSafeInteger(file.size) || file.size < 0) throw new MediaError('UPLOAD_INVALID_INPUT');
      const source = path.resolve(fixtureRoot, file.relative);
      if (!source.startsWith(`${path.resolve(fixtureRoot)}${path.sep}`)) throw new MediaError('UPLOAD_INVALID_INPUT');
      const target = this.assetPath(assetId, generation, file.relative);
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      const temporary = `${target}.fixture-${randomUUID()}`;
      await copyFile(source, temporary);
      const handle = await open(temporary, 'r+'); try { await handle.sync(); } finally { await handle.close(); }
      try { await link(temporary, target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const existing = await hashFile(target);
        if (existing.size !== file.size || existing.sha256 !== file.sha256) throw new MediaError('IDEMPOTENCY_CONFLICT');
      } finally { await unlink(temporary).catch(() => undefined); }
      const copied = await hashFile(target);
      if (copied.size !== file.size || copied.sha256 !== file.sha256) throw new MediaError('UPLOAD_SOURCE_MISMATCH');
    }
  }
}

async function hashFile(filePath: string): Promise<{ size: number; sha256: string }> {
  const digest = createHash('sha256'); let size = 0;
  for await (const chunk of createReadStream(filePath)) { digest.update(chunk); size += chunk.length; }
  return { size, sha256: digest.digest('hex') };
}

/**
 * Persiste la entrada de directorio tras un rename/creación (fsync del directorio, idiom POSIX).
 * Windows no permite fsync sobre un directorio (EPERM/EISDIR): allí NTFS registra los metadatos en su journal y la
 * durabilidad del contenido ya la da el fsync del archivo, así que se omite solo en win32. En POSIX el error se propaga.
 */
async function syncDirectory(directory:string):Promise<void>{
  if(process.platform==='win32')return;
  const handle=await open(directory,'r');try{await handle.sync();}finally{await handle.close();}
}
