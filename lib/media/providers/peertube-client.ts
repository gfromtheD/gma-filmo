import { z } from 'zod';
import { MediaError } from '../errors';

const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(), expires_in: z.number().positive().optional() }).passthrough();
const configSchema = z.object({ serverVersion: z.string(), tracker: z.object({ enabled: z.boolean() }).passthrough(), transcoding: z.object({ hls: z.object({ enabled: z.boolean() }).passthrough() }).passthrough() }).passthrough();
const meSchema = z.object({ id: z.number(), videoChannels: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()) }).passthrough();
// PeerTube 8.x answers the last resumable PUT with `{ video: { id, shortUUID, uuid } }`; the flat `{ uuid }` is kept for compatibility.
const uploadFinalSchema = z.union([
  z.object({ video: z.object({ uuid: z.string().uuid() }).passthrough() }).passthrough().transform((body) => body.video.uuid),
  z.object({ uuid: z.string().uuid() }).passthrough().transform((body) => body.uuid),
]);
const videoSchema = z.object({ uuid: z.string().uuid(), duration: z.number().nonnegative(), state: z.object({ id: z.number().int() }).passthrough(),
  streamingPlaylists: z.array(z.object({ playlistUrl: z.string(), files: z.array(z.unknown()).optional() }).passthrough()) }).passthrough();
const fileTokenSchema = z.object({ files: z.object({ token: z.string().min(1), expires: z.string() }).passthrough() }).passthrough();

export interface PeerTubeClientConfig { baseUrl: string; username: string; password: string; channelId: number; timeoutMs?: number; fetch?: typeof fetch; }
export interface PeerTubeResponse { status: number; headers: Headers; body: unknown; }
export interface PeerTubeVideoDetails { uuid: string; duration: number; stateId: number; streamingPlaylists: Array<{ playlistUrl: string }> }
export interface PeerTubeUploadMetadata { name: string; description: string; channelId: number; totalBytes: number; contentType: string; filename: string; }

/**
 * Bytes confirmed upstream from an uploadx `Range` header: absent, or `bytes=0--1` (what PeerTube answers for a lease
 * with nothing received yet), is 0; `bytes=0-N` is N + 1. Anything else is malformed and returns null.
 */
export function receivedBytesFromRange(range: string | null): number | null {
  if (range === null || range === 'bytes=0--1') return 0;
  const match = /^bytes=0-(\d+)$/.exec(range);
  return match ? Number(match[1]) + 1 : null;
}

/** Server-only PeerTube REST v8.3.1 client. Never import from a Client Component. */
export class PeerTubeClient {
  private readonly base: URL;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private oauth: { clientId: string; clientSecret: string } | null = null;
  private token: { accessToken: string; refreshToken: string | null; expiresAt: number } | null = null;
  private tokenFlight: Promise<string> | null = null;
  private readonly username: string;
  private readonly password: string;
  readonly channelId: number;

  constructor(config: PeerTubeClientConfig) {
    this.base = new URL(config.baseUrl);
    if (this.base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(this.base.hostname)) throw new MediaError('UPLOAD_INVALID_INPUT');
    if (this.base.username || this.base.password || this.base.search || this.base.hash || !Number.isSafeInteger(config.channelId) || config.channelId < 1) throw new MediaError('UPLOAD_INVALID_INPUT');
    this.base.pathname = `${this.base.pathname.replace(/\/$/, '')}/`;
    this.fetcher = config.fetch ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.username = config.username; this.password = config.password; this.channelId = config.channelId;
  }

  private endpoint(path: string): URL {
    if (!path.startsWith('/api/v1/')) throw new MediaError('UPLOAD_INVALID_INPUT');
    const url = new URL(path.slice(1), this.base);
    if (url.origin !== this.base.origin) throw new MediaError('UPLOAD_INVALID_INPUT');
    return url;
  }

  private validateLocation(value: string | null): URL {
    if (!value) throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    let url: URL;
    try { url = new URL(value, this.base); } catch { throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED'); }
    if (url.origin !== this.base.origin || url.username || url.password || url.hash
      || url.pathname !== '/api/v1/videos/upload-resumable' || !url.searchParams.has('upload_id')
      || [...url.searchParams.keys()].some((key) => key !== 'upload_id')) throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    return url;
  }

  validatePlaylistReference(value: string): string {
    if (value.includes('..') || value.includes('\\')) throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    let url: URL;
    try { url = new URL(value, this.base); } catch { throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED'); }
    if (url.origin !== this.base.origin || url.username || url.password || url.hash
      || !url.pathname.startsWith('/static/streaming-playlists/hls/') || url.pathname.includes('..')) {
      throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    }
    return url.toString();
  }

  private async raw(url: URL, init: RequestInit): Promise<PeerTubeResponse> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      // uploadx uses 308 as an offset response; manual also prevents following any redirect.
      const response = await this.fetcher(url, { ...init, signal: controller.signal, redirect: 'manual' });
      const text = await response.text(); let body: unknown = null;
      if (text) { try { body = JSON.parse(text) as unknown; } catch { body = text; } }
      return { status: response.status, headers: response.headers, body };
    } catch (error) { throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE', { cause: error, retryable: true }); }
    finally { clearTimeout(timeout); }
  }

  private async oauthClient(): Promise<{ clientId: string; clientSecret: string }> {
    if (this.oauth) return this.oauth;
    const response = await this.raw(this.endpoint('/api/v1/oauth-clients/local'), { method: 'GET', headers: { Accept: 'application/json' } });
    if (response.status !== 200 || !response.body || typeof response.body !== 'object') throw this.statusError(response.status);
    const parsed = z.object({ client_id: z.string().min(1), client_secret: z.string().min(1) }).safeParse(response.body);
    if (!parsed.success) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    this.oauth = { clientId: parsed.data.client_id, clientSecret: parsed.data.client_secret }; return this.oauth;
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    if (this.tokenFlight) return this.tokenFlight;
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.accessToken;
    this.tokenFlight = this.issueToken(forceRefresh).finally(() => { this.tokenFlight = null; });
    return this.tokenFlight;
  }

  private async issueToken(forceRefresh: boolean): Promise<string> {
    const client = await this.oauthClient(); const form = new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret });
    if (forceRefresh && this.token?.refreshToken) form.set('refresh_token', this.token.refreshToken);
    else { form.set('grant_type', 'password'); form.set('response_type', 'code'); form.set('username', this.username); form.set('password', this.password); }
    const response = await this.raw(this.endpoint('/api/v1/users/token'), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    if (response.status !== 200 || !response.body || typeof response.body !== 'object') throw this.statusError(response.status);
    const parsed = tokenSchema.safeParse(response.body);
    if (!parsed.success) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    this.token = { accessToken: parsed.data.access_token, refreshToken: parsed.data.refresh_token ?? null, expiresAt: Date.now() + (parsed.data.expires_in ?? 300) * 1000 };
    return this.token.accessToken;
  }

  private statusError(status: number): MediaError {
    if (status === 404) return new MediaError('UPLOAD_NOT_FOUND');
    if (status === 401 || status === 403) return new MediaError('UPLOAD_UNAUTHORIZED');
    return new MediaError('MEDIA_PROVIDER_UNAVAILABLE', { status: status === 429 ? 429 : status >= 500 ? 503 : 502, retryable: status === 429 || status >= 500 });
  }

  private async authorized(url: URL, init: RequestInit, retryAuth = true): Promise<PeerTubeResponse> {
    const token = await this.accessToken(); const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`); headers.set('Accept', 'application/json');
    const response = await this.raw(url, { ...init, headers });
    if (response.status === 401 && retryAuth) {
      if (this.token?.accessToken === token) await this.accessToken(true);
      return this.authorized(url, init, false);
    }
    return response;
  }

  async validateInstance(): Promise<{ version: string; channelId: number }> {
    const [configResponse, meResponse] = await Promise.all([this.raw(this.endpoint('/api/v1/config'), { method: 'GET', headers: { Accept: 'application/json' } }), this.authorized(this.endpoint('/api/v1/users/me'), { method: 'GET' })]);
    if (configResponse.status !== 200 || meResponse.status !== 200) throw this.statusError(configResponse.status !== 200 ? configResponse.status : meResponse.status);
    const config = configSchema.safeParse(configResponse.body); const me = meSchema.safeParse(meResponse.body);
    if (!config.success || !me.success || !config.data.transcoding.hls.enabled || config.data.tracker.enabled || !me.data.videoChannels.some((channel) => channel.id === this.channelId)) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    return { version: config.data.serverVersion, channelId: this.channelId };
  }

  async createResumableUpload(metadata: PeerTubeUploadMetadata): Promise<{ location: string; uploadId: string }> {
    if (!Number.isSafeInteger(metadata.totalBytes) || metadata.totalBytes < 1 || metadata.channelId !== this.channelId) throw new MediaError('UPLOAD_INVALID_INPUT');
    const body = { name: metadata.name, filename: metadata.filename, description: metadata.description, channelId: metadata.channelId, privacy: 3, waitTranscoding: true };
    let response: PeerTubeResponse;
    try {
      response = await this.authorized(this.endpoint('/api/v1/videos/upload-resumable'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Length': String(metadata.totalBytes), 'X-Upload-Content-Type': metadata.contentType }, body: JSON.stringify(body) });
    } catch (error) { throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED', { cause: error, retryable: true }); }
    if (![200, 201].includes(response.status)) throw response.status >= 500 || response.status === 0 ? new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED') : this.statusError(response.status);
    const location = this.validateLocation(response.headers.get('location'));
    return { location: location.toString(), uploadId: location.searchParams.get('upload_id')! };
  }

  async putUploadChunk(location: string, start: number, end: number, total: number, body: Uint8Array): Promise<{ status: number; range: string | null; uuid: string | null }> {
    const url = this.validateLocation(location);
    if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || end >= total || body.byteLength !== end - start + 1) throw new MediaError('UPLOAD_INVALID_INPUT');
    const response = await this.authorized(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(body.byteLength) }, body: body as BodyInit });
    if (![200, 201, 308].includes(response.status)) throw this.statusError(response.status);
    const final = response.status === 200 || response.status === 201 ? uploadFinalSchema.safeParse(response.body) : null;
    if (final && !final.success) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    return { status: response.status, range: response.headers.get('range'), uuid: final?.success ? final.data : null };
  }

  async queryUploadOffset(location: string, total: number): Promise<{ status: number; range: string | null }> {
    if (!Number.isSafeInteger(total) || total < 1) throw new MediaError('UPLOAD_INVALID_INPUT');
    const response = await this.authorized(this.validateLocation(location), { method: 'PUT', headers: { 'Content-Range': `bytes */${total}`, 'Content-Length': '0' } });
    if (![200, 308].includes(response.status)) throw this.statusError(response.status);
    return { status: response.status, range: response.headers.get('range') };
  }

  /** Recover a final UUID only from a unique, exact match in the technical account's private channel. */
  async recoverVideoByCorrelation(name: string): Promise<string | null> {
    if (!/^gma-[a-f0-9-]{36}-a[1-9][0-9]*$/.test(name)) throw new MediaError('UPLOAD_INVALID_INPUT');
    const pageSchema = z.object({ total: z.number().int().nonnegative(), data: z.array(z.object({
      uuid: z.string().uuid(), name: z.string(), channel: z.object({ id: z.number().int().positive() }).passthrough(),
      privacy: z.object({ id: z.number().int() }).passthrough(),
    }).passthrough()) }).passthrough();
    const matches: string[] = [];
    for (let start = 0; start < 10_000; start += 100) {
      const url = this.endpoint('/api/v1/users/me/videos');
      url.searchParams.set('start', String(start)); url.searchParams.set('count', '100');
      const response = await this.authorized(url, { method: 'GET' });
      if (response.status !== 200) throw this.statusError(response.status);
      const page = pageSchema.safeParse(response.body);
      if (!page.success || page.data.total > 10_000 || page.data.data.length > 100) throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
      for (const video of page.data.data) {
        if (video.name === name && video.channel.id === this.channelId && video.privacy.id === 3) matches.push(video.uuid);
      }
      if (matches.length > 1) throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
      if (start + page.data.data.length >= page.data.total) return matches[0] ?? null;
      if (page.data.data.length === 0) throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    }
    throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
  }

  async cancelUpload(location: string): Promise<boolean> {
    const response = await this.authorized(this.validateLocation(location), { method: 'DELETE', headers: { 'Content-Length': '0' } });
    if (response.status === 204 || response.status === 404) return true;
    if (response.status === 429 || response.status >= 500) return false;
    throw this.statusError(response.status);
  }

  async getVideo(uuid: string): Promise<PeerTubeVideoDetails | null> {
    const safeUuid = z.string().uuid().parse(uuid); const response = await this.authorized(this.endpoint(`/api/v1/videos/${safeUuid}`), { method: 'GET' });
    if (response.status === 404) return null;
    if (response.status !== 200) throw this.statusError(response.status);
    const parsed = videoSchema.safeParse(response.body); if (!parsed.success || parsed.data.uuid !== safeUuid) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    return { uuid: parsed.data.uuid, duration: parsed.data.duration, stateId: parsed.data.state.id, streamingPlaylists: parsed.data.streamingPlaylists.map((playlist) => ({ playlistUrl: playlist.playlistUrl })) };
  }

  async getPrivateFileToken(uuid: string): Promise<{ token: string; expiresAt: string }> {
    const safeUuid = z.string().uuid().parse(uuid); const response = await this.authorized(this.endpoint(`/api/v1/videos/${safeUuid}/token`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (response.status !== 200) throw this.statusError(response.status);
    const parsed = fileTokenSchema.safeParse(response.body);
    if (!parsed.success || !Number.isFinite(Date.parse(parsed.data.files.expires))) throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    return { token: parsed.data.files.token, expiresAt: parsed.data.files.expires };
  }

  async deleteVideo(uuid: string): Promise<boolean> {
    const safeUuid = z.string().uuid().parse(uuid); const response = await this.authorized(this.endpoint(`/api/v1/videos/${safeUuid}`), { method: 'DELETE' });
    if (response.status === 204 || response.status === 404) return true;
    if (response.status === 429 || response.status >= 500) return false;
    throw this.statusError(response.status);
  }
}
