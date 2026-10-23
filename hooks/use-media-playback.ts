'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaybackEngine, type AudioOption, type PlaybackFailure } from '@/lib/media/playback-engines';
import { PlaybackRecovery } from '@/lib/media/playback-client';
import { playbackSourceSchema } from '@/lib/media/contracts';
import type { PlaybackSource } from '@/types/playback';
import type { MediaItem } from '@/types/catalog';
import { playbackEndpointFor } from '@/lib/media/player-adapter';

/** Un origen pedido por adelantado vale este tiempo (la capacidad que trae dura 5 min). */
const PREFETCH_TTL_MS = 60_000;
const prefetched = new Map<string, { at: number; response: Promise<Response> }>();

/**
 * Pide el origen de reproducción antes de montar el vídeo (al pulsar «Reproducir» o con el cargador del reproductor), sin
 * cargar ni sonar nada. También abre la conexión con la pasarela pidiendo el manifiesto.
 */
export function prefetchPlaybackSource(endpoint: string): Promise<void> {
  const current = prefetched.get(endpoint);
  if (current && Date.now() - current.at < PREFETCH_TTL_MS) return current.response.then(() => undefined, () => undefined);
  const response = fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
  prefetched.set(endpoint, { at: Date.now(), response });
  // Se resuelve cuando el origen ha llegado (bien o mal): el cargador del reproductor espera a esto.
  const ready = response.then(() => undefined, () => undefined);
  void response.then(async (r) => {
    if (!r.ok) return;
    const source = playbackSourceSchema.safeParse(await r.clone().json());
    if (source.success && source.data.kind === 'hls') await fetch(source.data.url, { cache: 'no-store' }).catch(() => undefined);
  }).catch(() => undefined);
  return ready;
}

/** Al pulsar «Reproducir»: empieza a preparar el origen mientras se abre el reproductor (solo títulos del motor). */
export function prefetchPlaybackFor(item: Pick<MediaItem, 'id' | 'playbackRef' | 'playbackKind'>): void {
  const endpoint = playbackEndpointFor(item);
  if (endpoint) void prefetchPlaybackSource(endpoint);
}

/** Usa el origen pedido por adelantado (una sola vez) o, si no hay, lo pide ahora. */
function fetchPlaybackSource(endpoint: string, signal: AbortSignal): Promise<Response> {
  const early = prefetched.get(endpoint);
  prefetched.delete(endpoint);
  if (early && Date.now() - early.at < PREFETCH_TTL_MS) return early.response.then((r) => r.clone());
  return fetch(endpoint, { cache: 'no-store', credentials: 'same-origin', signal });
}

export function useMediaPlayback(video: HTMLVideoElement | null, endpoint: string | null, enabled: boolean,
  legacy: PlaybackSource | null = null, intent = { playing: true, volume: 1, muted: false, rate: 1 }) {
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioOption[]>([]);
  const sourceRef = useRef(source); sourceRef.current = source;
  const intentRef = useRef(intent); intentRef.current = intent;
  const engineRef = useRef<PlaybackEngine | null>(null);
  const audioRef = useRef<string | null>(null);
  const loadRef = useRef<() => void>(() => {});
  const failRef = useRef<(error: PlaybackFailure) => void>(() => {});
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true, loading = false;
    let timer: ReturnType<typeof setTimeout> | undefined, recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    let policy = new PlaybackRecovery();
    const abort = new AbortController();
    setSource(null); sourceRef.current = null; setError(null); setRevoked(false);
    const stop = (status?: number) => {
      clearTimeout(timer); clearTimeout(recoveryTimer); engineRef.current?.stop();
      setRevoked(status === 404); setError(status === 404 ? 'Este vídeo ya no está disponible.' : 'No se pudo reproducir el vídeo. Vuelve a intentarlo.');
    };
    const fail = (failure: PlaybackFailure, resolver = false) => {
      if (!alive || !enabled || recoveryTimer) return;
      const current = sourceRef.current;
      // Resolver failures never authorize a fallback or replace the currently playing source.
      const action = policy.decide(failure.category, failure.status, !resolver && current?.kind === 'hls' && current.fallback !== null);
      if (action.kind === 'stop') { stop(failure.status); return; }
      if (action.kind === 'refresh') { void load(); return; }
      if (action.kind === 'media') { engineRef.current?.recoverMedia(); return; }
      if (action.kind === 'fallback' && current?.kind === 'hls' && current.fallback) {
        setSource({ ...current, kind: 'mp4', url: current.fallback.url, mimeType: 'video/mp4' }); return;
      }
      if (action.kind === 'network') recoveryTimer = setTimeout(() => {
        recoveryTimer = undefined;
        if (!alive) return;
        if (resolver) void load(); else engineRef.current?.retryNetwork();
      }, action.delay);
    };
    const load = async () => {
      if (!alive || !enabled || loading) return;
      if (!endpoint) { setSource(legacy); sourceRef.current = legacy; if (!legacy) stop(); return; }
      loading = true;
      try {
        const response = await fetchPlaybackSource(endpoint, abort.signal);
        if (!response.ok) { loading = false; fail({ category: 'network', status: response.status }, true); return; }
        const next = playbackSourceSchema.parse(await response.json());
        if (!alive) return;
        sourceRef.current = next; setSource(next); setError(null);
        clearTimeout(timer);
        if (next.expiresAt !== null) timer = setTimeout(() => void load(), Math.max(1000, next.expiresAt - Date.now() - 60000));
      } catch (cause) { if (!abort.signal.aborted) { loading = false; fail({ category: cause instanceof TypeError ? 'network' : 'unsupported' }, true); } }
      finally { loading = false; }
    };
    failRef.current = failure => fail(failure);
    loadRef.current = () => { void load(); };
    retryRef.current = () => {
      if (!alive || revoked) return;
      clearTimeout(recoveryTimer); recoveryTimer = undefined; policy = new PlaybackRecovery(); setError(null); void load();
    };
    if (enabled) void load();
    return () => { alive = false; abort.abort(); clearTimeout(timer); clearTimeout(recoveryTimer); };
  }, [endpoint, enabled, legacy]); // a refreshed source never tears down this request/recovery scope

  useEffect(() => {
    if (!video || !enabled) return;
    const engine = new PlaybackEngine(video, failure => failRef.current(failure), tracks => {
      setAudioTracks(tracks);
      const selected = audioRef.current;
      if (selected !== null && tracks.some(track => track.id === selected && !track.selected)) engine.selectAudio(selected);
    });
    engineRef.current = engine;
    return () => { engine.destroy(); if (engineRef.current === engine) engineRef.current = null; };
  }, [video, enabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !source || source.kind === 'youtube') return;
    const initial = intentRef.current;
    void engine.load(source, { position: 0, paused: !initial.playing, volume: initial.volume, muted: initial.muted, rate: initial.rate })
      .catch(() => failRef.current({ category: 'unsupported' }));
  }, [video, source, enabled]);

  const selectAudio = useCallback((id: string) => { if (engineRef.current?.selectAudio(id)) audioRef.current = id; }, []);
  const retry = useCallback(() => retryRef.current(), []);
  const refresh = useCallback(() => loadRef.current(), []);
  return { source, error, revoked, audioTracks, selectAudio, retry, refresh };
}
