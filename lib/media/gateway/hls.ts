import path from 'node:path';
import type { PeerTubeClient } from '../providers/peertube-client';
import { parseMediaHls, MAX_HLS_BYTES, MAX_HLS_DEPTH, MAX_HLS_REFERENCES, type ParsedMediaHls } from '../hls-parser';
import { MediaError } from '../errors';

/** Loader authorizes every indexed resource and returns bytes only for an indexed playlist MIME. */
export async function rewriteGatewayHls(bytes: Uint8Array, relative: string, assetId: string, generation: number, token: string,
  loadResource: (relative: string) => Promise<Uint8Array | null>): Promise<Buffer> {
  const parsed = new Map<string, ParsedMediaHls>(); const heights = new Map<string, number>();
  const resources = new Map<string, Uint8Array | null>(); let references = 0; let snapshotBytes = 0;
  const visit = async (current: string, data: Uint8Array, depth: number, ancestors: ReadonlySet<string>): Promise<number> => {
    if (ancestors.has(current) || depth > MAX_HLS_DEPTH) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const completed = heights.get(current);
    if (completed !== undefined) {
      if (depth + completed > MAX_HLS_DEPTH) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
      return completed;
    }
    snapshotBytes += data.byteLength;
    if (data.byteLength > MAX_HLS_BYTES || snapshotBytes > 10 * MAX_HLS_BYTES) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED'); }
    const manifest = parseMediaHls(text, current); parsed.set(current, manifest);
    references += manifest.references.length;
    if (references > MAX_HLS_REFERENCES) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const nextAncestors = new Set([...ancestors, current]); let height = 0;
    for (const reference of new Set(manifest.references)) {
      if (!resources.has(reference)) resources.set(reference, await loadResource(reference));
      const child = resources.get(reference);
      if (child) height = Math.max(height, 1 + await visit(reference, child, depth + 1, nextAncestors));
    }
    heights.set(current, height); return height;
  };
  resources.set(relative, bytes); await visit(relative, bytes, 0, new Set());
  const root = parsed.get(relative); if (!root) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  return Buffer.from(root.rewrite(reference => `/playback/${assetId}/${generation}/${reference}?cap=${encodeURIComponent(token)}`));
}


/** Prepared PeerTube parser boundary: same-origin static namespace only; no upstream token enters a browser URL. */
export function rewritePeerTubeManifest(bytes: Uint8Array, playlistReference: string, client: PeerTubeClient, gatewayPrefix: string, token: string,
  namespaceReference = playlistReference): Buffer {
  if (playlistReference.includes('%') || namespaceReference.includes('%') || bytes.byteLength > MAX_HLS_BYTES || !/^\/playback\/[a-f0-9-]{36}\/[1-9][0-9]*\/$/.test(gatewayPrefix)) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  const playlist = new URL(client.validatePlaylistReference(playlistReference));
  const root = new URL(client.validatePlaylistReference(namespaceReference));
  const prefix = `${path.posix.dirname(root.pathname)}/`;
  if (playlist.origin !== root.origin || !playlist.pathname.startsWith(prefix) || playlist.search || root.search) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED'); }
  const relativePlaylist = playlist.pathname.slice(prefix.length);
  const parsed = parseMediaHls(text, relativePlaylist, value => {
    if (value.includes('%') || value.includes('\\') || value.includes('?') || value.includes('#') || value.startsWith('//')
      || value.split('/').some(segment => segment === '..' || segment === '.')) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    const upstream = new URL(value, playlist);
    if (upstream.origin !== root.origin || upstream.username || upstream.password || upstream.search || upstream.hash
      || !upstream.pathname.startsWith(prefix)) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    return upstream.pathname.slice(prefix.length);
  });
  return Buffer.from(parsed.rewrite(relative => `${gatewayPrefix}${relative}?cap=${encodeURIComponent(token)}`));
}
