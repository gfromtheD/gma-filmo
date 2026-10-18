import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import type { KeyObject } from 'node:crypto';
import { verifyMediaCapability } from '../capabilities';
import { MediaError } from '../errors';
import { MAX_HLS_BYTES } from '../hls-parser';
import type { PeerTubeClient } from '../providers/peertube-client';
import { rewritePeerTubeManifest } from './hls';
import type { GatewayDelivery } from './server';

/**
 * Entrega HLS de PeerTube a través de la pasarela GMA (VPS).
 *
 * El navegador solo ve `/playback/<asset>/<generación>/<recurso>?cap=<capacidad GMA>`. La pasarela comprueba la firma de
 * la capacidad y su concesión en BD, pide el recurso a PeerTube con un token de archivo privado (nunca llega al navegador)
 * y reescribe cada manifiesto para que todos sus enlaces vuelvan a pasar por la pasarela.
 */
export interface PeerTubeDeliveryDeps {
  repository: {
    assetSession(assetId: string): Promise<{ id: string }>;
    peerTubeAccess(assetId: string, generation: number, tokenHash: string): Promise<{ provider_ref: string; expected_input_bytes: number }>;
  };
  client: Pick<PeerTubeClient, 'getVideo' | 'getPrivateFileToken' | 'validatePlaylistReference'>;
  publicKeys: Readonly<Record<string, string | KeyObject>>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const MANIFEST = 'application/vnd.apple.mpegurl';
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

export function createPeerTubeDelivery(deps: PeerTubeDeliveryDeps): GatewayDelivery {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const videos = new Map<string, { playlistUrl: string; until: number }>();
  const tokens = new Map<string, { token: string; until: number }>();

  async function playlistFor(uuid: string): Promise<string> {
    const cached = videos.get(uuid);
    if (cached && cached.until > now()) return cached.playlistUrl;
    const video = await deps.client.getVideo(uuid);
    const playlist = video?.streamingPlaylists[0]?.playlistUrl;
    if (!video || !playlist) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const playlistUrl = deps.client.validatePlaylistReference(playlist);
    videos.set(uuid, { playlistUrl, until: now() + 60_000 });
    return playlistUrl;
  }

  async function fileToken(uuid: string): Promise<string> {
    const cached = tokens.get(uuid);
    if (cached && cached.until > now()) return cached.token;
    const issued = await deps.client.getPrivateFileToken(uuid);
    tokens.set(uuid, { token: issued.token, until: Math.min(Date.parse(issued.expiresAt) - 60_000, now() + 10 * 60_000) });
    return issued.token;
  }

  return async (request: IncomingMessage, response: ServerResponse, url: URL) => {
    const rawPath = (request.url ?? '').split('?')[0] ?? '';
    if (rawPath.includes('%') || rawPath.includes('\\') || rawPath.split('/').some(s => s === '..' || s === '.')) throw new MediaError('MEDIA_NOT_FOUND');
    const match = /^\/playback\/([^/]+)\/([1-9][0-9]*)\/([a-zA-Z0-9_./-]+)$/.exec(url.pathname);
    if (!match) throw new MediaError('MEDIA_NOT_FOUND');
    const assetId = z.string().uuid().parse(match[1]); const generation = Number(match[2]); const relative = match[3]!;
    if (!Number.isSafeInteger(generation) || relative.length > 512 || relative.split('/').some(s => !s || s === '.' || s === '..')) throw new MediaError('MEDIA_NOT_FOUND');
    const token = url.searchParams.get('cap') ?? '';
    if (url.searchParams.getAll('cap').length !== 1 || [...url.searchParams.keys()].some(k => k !== 'cap')) throw new MediaError('UPLOAD_UNAUTHORIZED');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const access = await deps.repository.peerTubeAccess(assetId, generation, tokenHash);
    const session = await deps.repository.assetSession(assetId);
    await verifyMediaCapability(token, { sessionId: session.id, assetId, generation, scope: 'playback', method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      resourcePath: `asset/${assetId}/${generation}/${relative}`, expectedBytes: access.expected_input_bytes }, deps.publicKeys, async () => true);

    const playlistUrl = await playlistFor(access.provider_ref);
    const base = new URL(`${path.posix.dirname(new URL(playlistUrl).pathname)}/`, playlistUrl);
    const upstream = relative === 'master.m3u8' ? new URL(playlistUrl) : new URL(relative, base);
    if (upstream.origin !== base.origin || !upstream.pathname.startsWith(base.pathname)) throw new MediaError('MEDIA_NOT_FOUND');
    const upstreamPath = upstream.toString();
    upstream.searchParams.set('videoFileToken', await fileToken(access.provider_ref));

    const isManifest = upstream.pathname.endsWith('.m3u8');
    const headers: Record<string, string> = {};
    if (!isManifest && typeof request.headers.range === 'string') headers.Range = request.headers.range;
    const upstreamResponse = await fetchImpl(upstream, { method: request.method === 'HEAD' && !isManifest ? 'HEAD' : 'GET', headers, redirect: 'error' });
    if (upstreamResponse.status === 404 || upstreamResponse.status === 403) { tokens.delete(access.provider_ref); throw new MediaError('MEDIA_NOT_FOUND'); }
    if (upstreamResponse.status !== 200 && upstreamResponse.status !== 206) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');

    response.setHeader('Referrer-Policy', 'no-referrer');
    if (isManifest) {
      const bytes = new Uint8Array(await upstreamResponse.arrayBuffer());
      if (bytes.byteLength > MAX_HLS_BYTES) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
      const rewritten = rewritePeerTubeManifest(bytes, upstreamPath, deps.client as PeerTubeClient, `/playback/${assetId}/${generation}/`, token, playlistUrl);
      response.statusCode = 200; response.setHeader('Content-Type', MANIFEST); response.setHeader('Content-Length', String(rewritten.length));
      response.end(request.method === 'HEAD' ? undefined : rewritten);
      return;
    }
    response.statusCode = upstreamResponse.status;
    for (const name of PASS_HEADERS) { const value = upstreamResponse.headers.get(name); if (value) response.setHeader(name, value); }
    if (request.method === 'HEAD' || !upstreamResponse.body) { response.end(); return; }
    await pipeline(Readable.fromWeb(upstreamResponse.body as import('node:stream/web').ReadableStream), response);
  };
}
