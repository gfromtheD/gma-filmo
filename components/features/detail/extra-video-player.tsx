"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoundHigh as Volume2, SoundOff as VolumeX } from "@/components/ui/icons";
import { GmaIcon } from "@/components/ui/gma-icon";
import { DragSlider, PlayTriangle, Skip10, formatPlayerTime } from "@/components/features/detail/extra-player-controls";

const HIDE_CONTROLS_MS = 2800;
const SKIP_SECONDS = 10;

interface ExtraVideoPlayerProps {
  readonly src: string;
  readonly poster?: string;
  /** Texto que se muestra dentro del reproductor solo en pantalla completa (fuera de ella va en la cabecera del visor). */
  readonly heading?: { readonly kind: string; readonly title: string; readonly counter?: string | null };
}

/** Botones táctiles de 44 px en el móvil; más compactos cuando el reproductor es ancho. */
const ROUND_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/65 transition-[background-color,color] duration-150 hover:bg-[#22B16B]/15 hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-[#22B16B] @[640px]:h-9 @[640px]:w-9";
const TIME_BUTTON =
  "text-[12px] tabular-nums text-white/60 transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-[#22B16B] @[640px]:text-[13px] @[640px]:text-white/50";

/**
 * Reproductor de un extra con los controles y atajos del reproductor principal
 * (espacio, ← → ±10 s, M, F). Es independiente: no guarda progreso ni lanza donaciones.
 */
export function ExtraVideoPlayer({ src, poster, heading }: ExtraVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, seconds));
  }, []);

  const skip = useCallback((delta: number) => {
    const video = videoRef.current;
    if (video) seekTo(video.currentTime + delta);
  }, [seekTo]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Atajos: los mismos que el reproductor principal.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const onControl = Boolean(target?.closest("button, [role=slider], input, textarea, select"));
      switch (event.key) {
        case " ":
          if (onControl) return; // el botón enfocado ya reacciona al espacio
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          if (onControl) return;
          event.preventDefault();
          skip(-SKIP_SECONDS);
          break;
        case "ArrowRight":
          if (onControl) return;
          event.preventDefault();
          skip(SKIP_SECONDS);
          break;
        case "m": case "M":
          setMuted((value) => !value);
          break;
        case "f": case "F":
          toggleFullscreen();
          break;
        default:
          return;
      }
      revealControls();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [revealControls, skip, toggleFullscreen, togglePlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  const remaining = duration - currentTime;
  const timeLabel = showRemaining
    ? formatPlayerTime(currentTime)
    : duration > 0 && Number.isFinite(remaining) ? `-${formatPlayerTime(remaining)}` : "—:—";
  const progress = duration > 0 ? currentTime / duration : 0;
  const controlsVisible = showControls || !playing;

  return (
    <div
      ref={containerRef}
      onPointerMove={revealControls}
      className="@container relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => { setPlaying(true); revealControls(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onProgress={(event) => {
          const { buffered: ranges, duration: total } = event.currentTarget;
          if (ranges.length > 0 && total > 0) setBuffered(ranges.end(ranges.length - 1) / total);
        }}
        className="h-full w-full cursor-pointer object-contain"
      />

      {/* En pantalla completa el título va arriba a la izquierda: en la franja negra si el vídeo es vertical,
          sobre el vídeo si es horizontal (el contenedor ocupa toda la pantalla). */}
      {isFullscreen && heading && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(12px,env(safe-area-inset-top))] transition-opacity duration-300"
          style={{ opacity: controlsVisible ? 1 : 0 }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#22B16B]">
            {heading.kind}
            {heading.counter && <span className="ml-2 font-medium normal-case tracking-normal text-white/60">{heading.counter}</span>}
          </p>
          <p className="line-clamp-2 text-[16px] font-semibold leading-snug text-white">{heading.title}</p>
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 px-3 pb-1.5 pt-12 transition-opacity duration-300 @[640px]:px-5 @[640px]:pb-4 @[640px]:pt-20"
        style={{
          background: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%)",
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
        onFocusCapture={revealControls}
      >
        {/* Tiempo: arriba a la derecha en un reproductor ancho; en el móvil va en la fila de controles. */}
        <div className="mb-1 hidden justify-end @[640px]:flex">
          <button type="button" aria-label="Alternar tiempo" onClick={() => setShowRemaining((value) => !value)} className={TIME_BUTTON}>
            {timeLabel}
          </button>
        </div>

        <div className="flex flex-col @[640px]:flex-row @[640px]:items-center @[640px]:gap-2">
          {/* Progreso: en el móvil ocupa su propia fila (arriba); en ancho va en línea tras el volumen. */}
          <div className="order-first min-w-0 @[640px]:order-5 @[640px]:flex-1">
            <DragSlider
              variant="progress"
              label="Progreso del vídeo"
              value={progress}
              buffered={buffered}
              keyStep={duration > 0 ? 5 / duration : 0.02}
              valueText={`${formatPlayerTime(currentTime)} de ${formatPlayerTime(duration)}`}
              className="w-full"
              tooltipFor={(fraction) => formatPlayerTime(fraction * duration)}
              onChange={(fraction) => seekTo(fraction * duration)}
            />
          </div>

          <div className="flex items-center gap-1 @[640px]:contents">
            <button type="button" onClick={() => skip(-SKIP_SECONDS)} aria-label="Retroceder 10s" className={`${ROUND_BUTTON} @[640px]:order-1`}>
              <Skip10 direction="back" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproducir"}
              className="flex h-12 w-12 shrink-0 items-center justify-center text-white outline-none transition-transform duration-100 hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#22B16B] active:scale-95 @[640px]:order-2 @[640px]:h-[52px] @[640px]:w-[52px]"
            >
              {playing ? <GmaIcon name="pause" size={24} /> : <PlayTriangle size={28} />}
            </button>

            <button type="button" onClick={() => skip(SKIP_SECONDS)} aria-label="Avanzar 10s" className={`${ROUND_BUTTON} @[640px]:order-3`}>
              <Skip10 direction="forward" />
            </button>

            {/* Volumen: solo con ratón y reproductor ancho (en el móvil se usa el volumen del dispositivo). */}
            <div
              className="hidden shrink-0 @[640px]:order-4 items-center gap-0.5 rounded-full border border-white/12 px-1.5 py-0.5 backdrop-blur-md @[640px]:flex @[640px]:items-center [@media(hover:none)]:!hidden"
              style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
            >
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Activar sonido" : "Silenciar"}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-[#22B16B]"
              >
                {muted ? <VolumeX size={15} strokeWidth={1.75} /> : <Volume2 size={15} strokeWidth={1.75} />}
              </button>
              <DragSlider
                variant="volume"
                label="Volumen"
                value={muted ? 0 : volume}
                keyStep={0.05}
                className="mx-1"
                onChange={(next) => { setVolume(next); setMuted(next === 0); }}
              />
            </div>

            <button type="button" aria-label="Alternar tiempo" onClick={() => setShowRemaining((value) => !value)} className={`${TIME_BUTTON} ml-auto min-h-11 px-2 @[640px]:hidden`}>
              {timeLabel}
            </button>

            <button type="button" onClick={toggleFullscreen} aria-label="Pantalla completa" className={`${ROUND_BUTTON} @[640px]:order-6`}>
              <GmaIcon name="fullscreen" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
