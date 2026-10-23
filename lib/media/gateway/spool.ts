import { createHash } from 'node:crypto';
import { mkdir, statfs } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { MediaError } from '../errors';

/** Tope de un trozo de subida (igual que el CHECK de gma_media_upload_chunks). */
export const MAX_CHUNK_BYTES = 32 * 1024 * 1024;
export function parseContentRange(value: string | undefined, total: number) {
  const query = /^bytes \*\/(\d+)$/.exec(value ?? '');
  if (query && Number(query[1]) === total) return { query:true as const };
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? '');
  if (!match) throw new MediaError('UPLOAD_INVALID_INPUT');
  const start=Number(match[1]),end=Number(match[2]),declared=Number(match[3]);
  if (![start,end,declared].every(Number.isSafeInteger) || declared!==total || start<0 || end<start || end>=total || end-start+1>MAX_CHUNK_BYTES) throw new MediaError('UPLOAD_INVALID_INPUT');
  return {query:false as const,start,end,size:end-start+1};
}
export async function requireDisk(root:string,bytes:number):Promise<void> {
  await mkdir(root,{recursive:true,mode:0o700});const disk=await statfs(root,{bigint:true});
  // Space for the immutable chunk and assembled original; never trust a client free-space claim.
  if (disk.bavail*disk.bsize < BigInt(bytes)*BigInt(2)+BigInt(MAX_CHUNK_BYTES)) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE',{status:507,retryable:true});
}
export async function readChunk(request:IncomingMessage,size:number):Promise<{bytes:Buffer;sha256:string}> {
  if (!Number.isSafeInteger(size) || size<1 || size>MAX_CHUNK_BYTES || Number(request.headers['content-length'])!==size) throw new MediaError('UPLOAD_INVALID_INPUT');
  const parts:Buffer[]=[];let received=0;const hash=createHash('sha256');
  for await(const part of request){const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);received+=bytes.length;
    if(received>size)throw new MediaError('UPLOAD_INVALID_INPUT');parts.push(bytes);hash.update(bytes);}
  if(received!==size || request.aborted)throw new MediaError('UPLOAD_NOT_COMPLETE');
  return {bytes:Buffer.concat(parts,size),sha256:hash.digest('hex')};
}
