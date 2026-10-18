'use client';
import type Hls from 'hls.js';
import type { PlaybackSource } from '@/types/playback';

export interface AudioOption { id: string; label: string; language: string; selected: boolean }
interface NativeAudioTrack { id: string; label: string; language: string; enabled: boolean }
interface NativeAudioList extends EventTarget { length: number; [index: number]: NativeAudioTrack }
type NativeVideo = HTMLVideoElement & { audioTracks?: NativeAudioList; webkitEnterFullscreen?: () => void };
export interface PlaybackFailure { category: 'network' | 'media' | 'unsupported'; status?: number }
export interface PlaybackSnapshot { position: number; paused: boolean; volume: number; muted: boolean; rate: number }
export function snapshotPlayback(video: HTMLVideoElement): PlaybackSnapshot {
  return { position: video.currentTime, paused: video.paused, volume: video.volume, muted: video.muted, rate: video.playbackRate };
}
export function boundedPosition(position: number, duration: number): number {
  return Number.isFinite(position) && position >= 0 && Number.isFinite(duration) && duration > 0
    ? Math.min(position, Math.max(0, duration - 0.05)) : 0;
}

/** One controller per stable GMA video element. Provider names never enter this module. */
export class PlaybackEngine {
  private hls: Hls | null = null;
  private generation = 0;
  private removeRestore = () => {};
  private source: Exclude<PlaybackSource, { kind: 'youtube' }> | null = null;
  private restoring = false;
  private readonly onNativeError = () => {
    if (!this.hls && this.video.error) this.failure({ category: this.video.error.code === 2 ? 'network' : 'media' });
  };
  private readonly onAudio = () => this.audioChanged(this.audioTracks());
  constructor(private video: HTMLVideoElement, private failure: (failure: PlaybackFailure) => void,
    private audioChanged: (tracks: AudioOption[]) => void = () => {}) {
    video.addEventListener('error', this.onNativeError);
    video.addEventListener('loadedmetadata', this.onAudio);
    (video as NativeVideo).audioTracks?.addEventListener('change', this.onAudio);
  }
  async load(source: Exclude<PlaybackSource, { kind: 'youtube' }>, initial: PlaybackSnapshot): Promise<void> {
    const state = this.source ? snapshotPlayback(this.video) : initial;
    this.source = source;
    const generation = ++this.generation;
    this.removeRestore();
    this.hls?.destroy(); this.hls = null;
    this.restoring = true;
    const restore = () => {
      if (generation !== this.generation) return;
      this.video.currentTime = boundedPosition(state.position, this.video.duration);
      this.video.volume = state.volume; this.video.muted = state.muted; this.video.playbackRate = state.rate;
      this.restoring = false;
      if (state.paused) this.video.pause();
      else void this.video.play().catch(() => {}); // autoplay may require the user's gesture
    };
    this.video.addEventListener('loadedmetadata', restore, { once: true });
    this.removeRestore = () => this.video.removeEventListener('loadedmetadata', restore);
    if (source.kind === 'mp4') { this.video.src = source.url; this.video.load(); return; }
    // hls.js whenever MSE exists: Chrome 155 answers canPlayType('application/vnd.apple.mpegurl') with "maybe" but its
    // native HLS rejects PeerTube's byte-range fMP4 (MEDIA_ERR_SRC_NOT_SUPPORTED). Native HLS only without MSE (older iOS).
    const { default: HlsClass } = await import('hls.js');
    if (generation !== this.generation) return;
    if (!HlsClass.isSupported()) {
      if (this.video.canPlayType('application/vnd.apple.mpegurl')) { this.video.src = source.url; this.video.load(); return; }
      this.failure({ category: 'unsupported' }); return;
    }
    const noRetry = { maxNumRetry: 0, retryDelayMs: 0, maxRetryDelayMs: 0 };
    const policy = { default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 20000, timeoutRetry: noRetry, errorRetry: noRetry } };
    const hls = new HlsClass({ maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: 30,
      manifestLoadPolicy: policy, playlistLoadPolicy: policy, fragLoadPolicy: policy });
    this.hls = hls;
    hls.on(HlsClass.Events.ERROR, (_event, data) => {
      const details = data.networkDetails as { status?: unknown } | null | undefined;
      const status = data.response?.code ?? (typeof details?.status === 'number' ? details.status : undefined);
      // hls.js may retry an authorization error before marking it fatal; let the
      // signed-source recovery policy replace the expired capability immediately.
      if (status === 401 || status === 403) { this.failure({ category: 'network', status }); return; }
      if (!data.fatal) return;
      this.failure({ category: data.type === HlsClass.ErrorTypes.NETWORK_ERROR ? 'network' : 'media',
        status });
    });
    hls.on(HlsClass.Events.AUDIO_TRACKS_UPDATED, this.onAudio);
    hls.on(HlsClass.Events.AUDIO_TRACK_SWITCHED, this.onAudio);
    hls.attachMedia(this.video); hls.loadSource(source.url);
  }
  retryNetwork(): void {
    if (this.hls) this.hls.startLoad(this.video.currentTime);
    else if (this.source) void this.load(this.source, snapshotPlayback(this.video));
  }
  recoverMedia(): void {
    if (this.hls) this.hls.recoverMediaError();
    else if (this.source) void this.load(this.source, snapshotPlayback(this.video));
  }
  audioTracks(): AudioOption[] {
    if (this.hls) return this.hls.audioTracks.map((track, index) => ({ id: String(index), label: track.name || track.lang || `Audio ${index + 1}`,
      language: track.lang ?? 'und', selected: this.hls?.audioTrack === index }));
    const tracks = (this.video as NativeVideo).audioTracks;
    return tracks ? Array.from({ length: tracks.length }, (_, index) => ({ id: String(index), label: tracks[index]!.label || tracks[index]!.language || `Audio ${index + 1}`,
      language: tracks[index]!.language || 'und', selected: tracks[index]!.enabled })) : [];
  }
  selectAudio(id: string): boolean {
    const index = Number(id); const options = this.audioTracks();
    if (!Number.isInteger(index) || !options.some(option => option.id === id)) return false;
    if (this.hls) this.hls.audioTrack = index;
    else { const tracks = (this.video as NativeVideo).audioTracks!; for (let i = 0; i < tracks.length; i++) tracks[i]!.enabled = i === index; }
    this.onAudio(); return true;
  }
  get isRestoring() { return this.restoring; }
  stop(): void { this.video.pause(); this.hls?.stopLoad(); }
  destroy(): void {
    this.generation++; this.removeRestore(); this.hls?.destroy(); this.hls = null;
    this.video.removeEventListener('error', this.onNativeError);
    this.video.removeEventListener('loadedmetadata', this.onAudio);
    (this.video as NativeVideo).audioTracks?.removeEventListener('change', this.onAudio);
    this.video.pause(); this.video.removeAttribute('src'); this.video.load();
  }
}

export async function toggleMediaFullscreen(container: HTMLElement | null, video: HTMLVideoElement | null): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (container?.requestFullscreen) await container.requestFullscreen();
  else (video as NativeVideo | null)?.webkitEnterFullscreen?.();
}
