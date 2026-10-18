import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { verifyMediaCapability } from '../capabilities';
import { MediaError } from '../errors';
import { MAX_HLS_BYTES } from '../hls-parser';
import { MediaService } from '../service';
import { rewriteGatewayHls } from './hls';
import type { GatewayDelivery } from './server';
import type { GatewayDependencies } from './transfer';

const fixtures: Readonly<Record<string, { file: string; mime: string }>> = {
  'legacy.mp4': { file: 'legacy.mp4', mime: 'video/mp4' },
  'legacy.es.vtt': { file: 'subtitles.es.vtt', mime: 'text/vtt' },
  'legacy.en.vtt': { file: 'subtitles.en.vtt', mime: 'text/vtt' },
  'legacy.poster.webp': { file: 'poster.webp', mime: 'image/webp' },
  'subtitles.es.vtt': { file: 'subtitles.es.vtt', mime: 'text/vtt' },
  'subtitles.en.vtt': { file: 'subtitles.en.vtt', mime: 'text/vtt' },
  'poster.webp': { file: 'poster.webp', mime: 'image/webp' },
};
const outputMime = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegURL', 'video/mp4', 'video/iso.segment', 'video/mp2t', 'text/vtt', 'image/webp']);
export type ByteRange = { start: number; end: number } | { unsatisfiable: true };
export function parseByteRange(value: string | undefined, size: number): ByteRange | null {
  if (value === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || !Number.isSafeInteger(size) || size < 1 || !match[1] && !match[2]) return { unsatisfiable: true };
  if (!match[1]) {
    const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix < 1) return { unsatisfiable: true };
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]); const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return { unsatisfiable: true };
  return { start, end: Math.min(end, size - 1) };
}
function deliveryHeaders(response: ServerResponse, mime: string, size: number, range: ByteRange | null): { start: number; end: number } | null {
  response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', mime === 'text/vtt' ? 'text/vtt; charset=utf-8' : mime);
  if (range && 'unsatisfiable' in range) {
    response.statusCode = 416; response.setHeader('Content-Range', `bytes */${size}`); response.setHeader('Content-Length', '0'); response.end(); return null;
  }
  const bounds = range ?? { start: 0, end: size - 1 };
  response.statusCode = range ? 206 : 200;
  if (range) response.setHeader('Content-Range', `bytes ${bounds.start}-${bounds.end}/${size}`);
  response.setHeader('Content-Length', String(bounds.end - bounds.start + 1)); return bounds;
}
async function privateFile(fullPath: string, base: string): Promise<FileHandle> {
  const resolved = await realpath(fullPath);
  if (!resolved.startsWith(`${path.resolve(base)}${path.sep}`)) throw new MediaError('MEDIA_NOT_FOUND');
  const handle = await open(fullPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  if (!(await handle.stat()).isFile()) { await handle.close(); throw new MediaError('MEDIA_NOT_FOUND'); }
  return handle;
}
async function deliverFile(request: IncomingMessage, response: ServerResponse, handle: FileHandle, mime: string, expectedSize?: number, manifest?: () => Promise<Buffer>) {
  try {
    const stat = await handle.stat(); if (expectedSize !== undefined && stat.size !== expectedSize) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const bytes = manifest ? await manifest() : null; const size = bytes ? bytes.length : stat.size;
    const range = parseByteRange(request.headers.range, size); const bounds = deliveryHeaders(response, mime, size, range);
    if (!bounds) return;
    if (request.method === 'HEAD') { response.end(); return; }
    if (bytes) { response.end(bytes.subarray(bounds.start, bounds.end + 1)); return; }
    await pipeline(handle.createReadStream({ start: bounds.start, end: bounds.end, autoClose: false }), response);
  } finally { await handle.close(); }
}

/** Private filesystem delivery is local Mock only; historical R2 stays in its adapter and helper. */
export function createGatewayDelivery(deps: GatewayDependencies, fixtureRoot: string): GatewayDelivery {
  if (!path.isAbsolute(fixtureRoot)) throw new MediaError('UPLOAD_INVALID_INPUT');
  const service = new MediaService(deps.repository);
  return async (request, response, url) => {
    const rawPath = (request.url ?? '').split('?')[0] ?? '';
    if (rawPath.includes('%') || rawPath.includes('\\') || rawPath.split('/').some(segment => segment === '..' || segment === '.')) throw new MediaError('MEDIA_NOT_FOUND');
    const fixtureMatch = /^\/fixtures\/([a-zA-Z0-9_.-]+)$/.exec(url.pathname);
    if (fixtureMatch) {
      const fixture = Object.prototype.hasOwnProperty.call(fixtures, fixtureMatch[1]!) ? fixtures[fixtureMatch[1]!] : undefined;
      if (!fixture || url.search) throw new MediaError('MEDIA_NOT_FOUND');
      const handle = await privateFile(path.join(fixtureRoot, fixture.file), await realpath(fixtureRoot));
      await deliverFile(request, response, handle, fixture.mime); return;
    }
    const match = /^\/playback\/([^/]+)\/([1-9][0-9]*)\/([a-zA-Z0-9_./-]+)$/.exec(url.pathname);
    if (!match) throw new MediaError('MEDIA_NOT_FOUND');
    const assetId = z.string().uuid().parse(match[1]); const generation = Number(match[2]); const relative = match[3]!;
    if (!Number.isSafeInteger(generation) || relative.split('/').some(segment => !segment || segment === '.' || segment === '..') || relative.length > 512) throw new MediaError('MEDIA_NOT_FOUND');
    const token = url.searchParams.get('cap') ?? '';
    if (url.searchParams.getAll('cap').length !== 1 || [...url.searchParams.keys()].some(name => name !== 'cap')) throw new MediaError('UPLOAD_UNAUTHORIZED');
    const session = await deps.repository.assetSession(assetId); const context = await service.context(session.id, undefined, false);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    let output: Awaited<ReturnType<GatewayDependencies['repository']['gatewayOutput']>> | undefined;
    await verifyMediaCapability(token, { sessionId: session.id, assetId, generation, scope: session.max_duration_seconds === 0 ? 'auxiliary' : 'playback',
      method: request.method === 'HEAD' ? 'HEAD' : 'GET', resourcePath: `asset/${assetId}/${generation}/${relative}`, expectedBytes: context.asset.expected_input_bytes }, deps.publicKeys,
    async () => { output = await deps.repository.gatewayOutput(assetId, generation, relative, tokenHash); return true; });
    if (!output || output.provider !== 'mock' || !outputMime.has(output.mimeType)) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const file = deps.storage.assetPath(assetId, generation, relative);
    const base = path.join(await realpath(deps.storage.root), 'assets', assetId, `g${generation}`);
    const handle = await privateFile(file, base);
    const isManifest = ['application/vnd.apple.mpegurl', 'application/x-mpegURL'].includes(output.mimeType);
    if (isManifest && (await handle.stat()).size > MAX_HLS_BYTES) { await handle.close(); throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED'); }
    await deliverFile(request, response, handle, output.mimeType, output.sizeBytes, isManifest ? async () => rewriteGatewayHls(await handle.readFile(), relative, assetId, generation, token,
      async reference => {
        const childOutput = await deps.repository.gatewayOutput(assetId, generation, reference, tokenHash);
        if (childOutput.provider !== 'mock' || !outputMime.has(childOutput.mimeType)) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
        if (!['application/vnd.apple.mpegurl', 'application/x-mpegURL'].includes(childOutput.mimeType)) return null;
        if (childOutput.sizeBytes > MAX_HLS_BYTES) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
        const child = await privateFile(deps.storage.assetPath(assetId, generation, reference), base);
        try {
          const stat = await child.stat();
          if (stat.size !== childOutput.sizeBytes || stat.size > MAX_HLS_BYTES) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
          return await child.readFile();
        } finally { await child.close(); }
      }) : undefined);
  };
}
