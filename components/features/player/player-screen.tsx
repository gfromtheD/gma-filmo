"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw, RotateCw, SkipBack, SkipForward,
  Volume2, VolumeX,
  Maximize, Minimize2, ArrowLeft,
  Settings, Airplay,
} from "lucide-react";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useProgress } from "@/hooks/use-progress";
import { useCastSupport } from "@/hooks/use-cast-support";
import type { MediaItem } from "@/types/catalog";

// ─── Sprite constants (must match generate-sprites.mjs) ──────────────────────

const SPRITE_INTERVAL = 2;   // seconds per frame
const SPRITE_W        = 160; // thumbnail width px
const SPRITE_H        = 90;  // thumbnail height px
const SPRITE_COLS     = 10;  // grid columns

interface SpriteCue { start: number; end: number; x: number; y: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const serifItalic: React.CSSProperties = {
  fontFamily: "var(--font-serif), 'Instrument Serif', Georgia, serif",
  fontStyle: "italic",
};

const MONO: React.CSSProperties = {
  fontFamily: "ui-monospace, 'Cascadia Code', monospace",
};

const MOCK_CHAPTERS = [
  "La llegada", "El encuentro", "La verdad", "El secreto",
  "La promesa", "El retorno", "Revelaciones", "El desenlace",
];

const AUDIO_TRACKS = [
  { id: "es-cast", label: "Español Castellano", badge: "Esp · Castellano"  },
  { id: "es-orig", label: "ES Original · 5.1",  badge: "ES Original · 5.1" },
  { id: "en",      label: "English · 5.1",      badge: "EN · 5.1"          },
] as const;

const CC_TRACKS = [
  { id: null, label: "Desactivado" },
  { id: "es", label: "Español"    },
  { id: "en", label: "English"    },
  { id: "ca", label: "Català"     },
] as const;

function getChapter(t: number, duration: number): { num: string; name: string } {
  const idx = Math.min(
    Math.floor((t / Math.max(1, duration)) * MOCK_CHAPTERS.length),
    MOCK_CHAPTERS.length - 1,
  );
  return { num: String(idx + 1), name: MOCK_CHAPTERS[idx] ?? "" };
}

function parseCredits(author: string): Array<{ name: string; role: string }> {
  return author
    .split(/[,;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const colonMatch = part.match(/^([^:]{2,30}):\s*(.+)$/);
      if (colonMatch) return { role: colonMatch[1]!.trim(), name: colonMatch[2]!.trim() };
      const parenMatch = part.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) return { name: parenMatch[1]!.trim(), role: parenMatch[2]!.trim() };
      return { name: part, role: "" };
    });
}

function creditInitialColor(name: string): string {
  const COLORS = ["#22B16B","#3a8fb7","#f0c14b","#e63946","#9B6FD4","#E05C4B","#3BAED4","#D45080"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function toYouTubeEmbed(url: string): string {
  if (url.includes("youtube.com/embed/")) return url;
  const short = url.match(/youtu\.be\/([^?&]+)/);
  if (short) return `https://www.youtube.com/embed/${short[1]}?autoplay=1`;
  const watch = url.match(/[?&]v=([^&]+)/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}?autoplay=1`;
  return url + (url.includes("?") ? "&" : "?") + "autoplay=1";
}

function parseDuration(item: MediaItem): number {
  if (item.kind === "series") return 45 * 60;
  const h = item.runtime.match(/(\d+)h/);
  const m = item.runtime.match(/(\d+)m/);
  return (h ? parseInt(h[1] ?? "0") * 3600 : 0) + (m ? parseInt(m[1] ?? "0") * 60 : 0);
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Skip 10s ─────────────────────────────────────────────────────────────────

function Skip10({ direction }: { direction: "back" | "forward" }) {
  const Icon = direction === "back" ? RotateCcw : RotateCw;
  return (
    <span className="relative flex h-5.5 w-5.5 items-center justify-center" aria-hidden="true">
      <Icon size={22} strokeWidth={1.7} />
      <span
        className="absolute text-[6.5px] font-bold leading-none"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        10
      </span>
    </span>
  );
}

// ─── Player ───────────────────────────────────────────────────────────────────

interface PlayerScreenProps {
  readonly item: MediaItem;
  readonly nextItem?: MediaItem;
}

export function PlayerScreen({ item, nextItem }: PlayerScreenProps) {
  const router   = useRouter();
  const duration = parseDuration(item);

  const [currentTime, setCurrentTime]       = useState(0);
  const [playing, setPlaying]               = useState(true);
  const [muted, setMuted]                   = useState(false);
  const [volume, setVolume]                 = useState(1.0);
  const [buffered, setBuffered]             = useState(0);
  const [buffering, setBuffering]           = useState(false);
  const [videoError, setVideoError]         = useState(false);
  const [ccTrack, setCcTrack]               = useState<string | null>(null);
  const [audioTrack, setAudioTrack]         = useState<string>("es-orig");
  const [showSettings, setShowSettings]     = useState(false);
  const [playbackSpeed, setPlaybackSpeed]   = useState(1);
  const [autoplayNext, setAutoplayNext]     = useState(true);

  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [showControls, setShowControls]     = useState(true);
  const [pulsing, setPulsing]               = useState(false);
  const [showRemaining, setShowRemaining]   = useState(false);
  const [countdownSecs,    setCountdownSecs]    = useState<number | null>(null);
  const [countdownInitial, setCountdownInitial] = useState(10);


  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hideTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef          = useRef(playing);
  const lastSaveRef         = useRef(0);
  const currentTimeRef      = useRef(0);
  const hasPlayedOnce       = useRef(false);
  const countdownStartedRef = useRef(false);
  const countdownDismissRef = useRef(false);
  const navigatedRef        = useRef(false);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // ── Progress persistence ──────────────────────────────────────────────────
  const { saveProgress, getProgress } = useProgress();
  const saveProgressRef = useRef<typeof saveProgress>(saveProgress);
  useEffect(() => { saveProgressRef.current = saveProgress; }, [saveProgress]);

  // Seek to saved position once metadata is available; also capture real duration
  function handleLoadedMetadata() {
    const vid = videoRef.current;
    if (!vid) return;
    const saved = getProgress(item.numericId);
    if (saved && !saved.completed && saved.currentTime > 10 && isFinite(saved.currentTime)) {
      vid.currentTime = saved.currentTime;
    }
  }

  function handleWaiting() {
    if (bufferDebounceRef.current) clearTimeout(bufferDebounceRef.current);
    bufferDebounceRef.current = setTimeout(() => {
      bufferDebounceRef.current = null;
      setBuffering(true);
    }, 300);
    if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    bufferTimeoutRef.current = setTimeout(() => {
      bufferTimeoutRef.current = null;
      if (bufferDebounceRef.current) { clearTimeout(bufferDebounceRef.current); bufferDebounceRef.current = null; }
      setBuffering(false);
      // Only show "no connection" error if the video had already started playing —
      // a long initial load is not the same as losing connection mid-playback
      if (hasPlayedOnce.current) {
        setVideoError(true);
        setPlaying(false);
      }
    }, 10_000);
  }

  function handlePlaying() {
    hasPlayedOnce.current = true;
    if (bufferDebounceRef.current) { clearTimeout(bufferDebounceRef.current); bufferDebounceRef.current = null; }
    if (bufferTimeoutRef.current)  { clearTimeout(bufferTimeoutRef.current);  bufferTimeoutRef.current  = null; }
    setBuffering(false);
    setVideoError(false);
  }

  function handleVideoError() {
    if (bufferDebounceRef.current) { clearTimeout(bufferDebounceRef.current); bufferDebounceRef.current = null; }
    if (bufferTimeoutRef.current)  { clearTimeout(bufferTimeoutRef.current);  bufferTimeoutRef.current  = null; }
    setBuffering(false);
    // Only show error overlay after the video had started playing at least once
    if (hasPlayedOnce.current) {
      setVideoError(true);
      setPlaying(false);
    }
  }

  // Save progress every 5 s while watching; also drives the autoplay countdown
  // for MP4 videos by reading vid.duration live — no React state lag.
  function handleTimeUpdate() {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    setCurrentTime(t);

    // Countdown: read directly from the video element so the trigger is always
    // exactly 10 s before the real end, regardless of what parseDuration returns.
    if (nextItem && !countdownDismissRef.current && isFinite(vid.duration) && vid.duration > 0) {
      const rem = vid.duration - t;
      if (rem <= autoplayOffset && rem > 0 && !countdownStartedRef.current) {
        countdownStartedRef.current = true;
        const initial = Math.ceil(rem);
        setCountdownInitial(initial);
        setCountdownSecs(initial);
      } else if (rem > autoplayOffset + 2 && countdownStartedRef.current) {
        // User scrubbed back past the window — allow it to fire again
        countdownStartedRef.current = false;
        setCountdownSecs(null);
      }
    }

    const now = Date.now();
    if (now - lastSaveRef.current >= 5000 && t > 10 && vid.duration > 0) {
      lastSaveRef.current = now;
      const completed = t / vid.duration >= 0.95;
      saveProgress(item.numericId, t, completed);
    }
  }

  // Explicit close: pause, save progress, go to the item's detail page (not home)
  // so the user can rate or re-read the synopsis without losing context
  async function handleClose() {
    const vid = videoRef.current;
    vid?.pause();
    const ct  = vid ? vid.currentTime : currentTimeRef.current;
    const dur = vid?.duration ?? (duration > 0 ? duration : 0);
    if (ct > 10) {
      await saveProgressRef.current(item.numericId, ct, dur > 0 && ct / dur >= 0.95);
    }
    router.back();
  }

  function handlePlayNext() {
    if (!nextItem || navigatedRef.current) return;
    navigatedRef.current = true;
    router.push(`/ver/${nextItem.id}`);
  }

  // Fallback save on unmount (e.g. browser back, middleware redirect)
  useEffect(() => {
    const vid = videoRef.current;
    return () => {
      vid?.pause();
      if (vid && vid.currentTime > 10 && vid.duration > 0) {
        void saveProgressRef.current(item.numericId, vid.currentTime, vid.currentTime / vid.duration >= 0.95);
        return;
      }
      const ct = currentTimeRef.current;
      if (ct > 10) {
        void saveProgressRef.current(item.numericId, ct, duration > 0 && ct / duration >= 0.95);
      }
    };
  }, [item.numericId, duration]);

  const mp4Url     = item.r2VideoUrl ?? null;
  const youtubeUrl = !mp4Url && item.videoUrl && isYouTubeUrl(item.videoUrl)
    ? toYouTubeEmbed(item.videoUrl) : null;
  const hasVideo = Boolean(mp4Url || youtubeUrl);
  const isYT     = Boolean(youtubeUrl);

  // Derive sprite sheet URL from the same R2 bucket as the video
  const spriteUrl = mp4Url
    ? `${new URL(mp4Url).origin}/sprites/${item.id}.jpg`
    : null;

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (playing) vid.play().catch((err: unknown) => {
      // AbortError = autoPlay and play() raced; the video is still playing, ignore it
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPlaying(false);
    });
    else vid.pause();
  }, [playing]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = muted;
    vid.volume = muted ? 0 : volume;
  }, [muted, volume]);

  // Timer-based time tracking: runs for (1) no video at all, (2) YouTube iframe (can't get real time)
  useEffect(() => {
    if ((hasVideo && !isYT) || !playing) return;
    const id = setInterval(() => {
      setCurrentTime((t) => {
        const next = t + 1;
        if (duration > 0 && next >= duration) { setPlaying(false); return duration; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, duration, hasVideo, isYT]);

  // Periodic save for YouTube (native video uses handleTimeUpdate instead)
  useEffect(() => {
    if (!isYT || currentTime <= 10) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;
    saveProgress(item.numericId, currentTime, duration > 0 && currentTime / duration >= 0.95);
  }, [currentTime, isYT, duration, item.numericId, saveProgress]);

  // ── Autoplay countdown ───────────────────────────────────────────────────────

  // How many seconds before the end to show the countdown.
  // Scales down for very short films so it never covers more than ~15% of runtime.
  const autoplayOffset = 10;

  // Countdown for YouTube iframes and virtual-timer playback.
  // MP4 videos are handled inside handleTimeUpdate (reads vid.duration live).
  useEffect(() => {
    if (mp4Url || !nextItem || duration <= 0 || countdownDismissRef.current) return;
    const remaining = duration - currentTime;
    if (remaining <= autoplayOffset && remaining > 0 && !countdownStartedRef.current) {
      countdownStartedRef.current = true;
      const initial = Math.ceil(remaining);
      setCountdownInitial(initial);
      setCountdownSecs(initial);
    }
    if (remaining > autoplayOffset + 2 && countdownStartedRef.current) {
      countdownStartedRef.current = false;
      setCountdownSecs(null);
    }
  }, [currentTime, duration, nextItem, autoplayOffset, mp4Url]);

  // Tick down every second
  useEffect(() => {
    if (countdownSecs === null || countdownSecs <= 0) return;
    const id = setTimeout(() => setCountdownSecs((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [countdownSecs]);

  // When countdown hits 0: navigate if autoplay is on, otherwise just hide
  useEffect(() => {
    if (countdownSecs !== 0 || !nextItem || navigatedRef.current) return;
    if (autoplayNext) {
      navigatedRef.current = true;
      router.push(`/ver/${nextItem.id}`);
    } else {
      setCountdownSecs(null);
    }
  }, [countdownSecs, autoplayNext, nextItem, router]);

  // ── End of autoplay countdown ─────────────────────────────────────────────────

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current) setShowControls(false);
    }, 3000);
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!playing) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setShowControls(true);
    } else {
      scheduleHide();
    }
  }, [playing, scheduleHide]);

  useEffect(() => () => {
    if (hideTimer.current)         clearTimeout(hideTimer.current);
    if (pulseTimer.current)        clearTimeout(pulseTimer.current);
    if (bufferTimeoutRef.current)  clearTimeout(bufferTimeoutRef.current);
    if (bufferDebounceRef.current) clearTimeout(bufferDebounceRef.current);
  }, []);

  // Close settings panel on outside click
  useEffect(() => {
    if (!showSettings) return;
    const timerId = setTimeout(() => {
      function onOutside() { setShowSettings(false); }
      document.addEventListener("click", onOutside, { once: true });
    }, 0);
    return () => clearTimeout(timerId);
  }, [showSettings]);

  function togglePlay() {
    setPlaying((p) => !p);
    setPulsing(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setPulsing(true)));
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsing(false), 700);
    revealControls();
  }

  function seek(delta: number) {
    const vid = videoRef.current;
    if (vid) vid.currentTime = Math.max(0, Math.min(vid.duration, vid.currentTime + delta));
    else setCurrentTime((t) => Math.max(0, Math.min(duration, t + delta)));
    revealControls();
  }

  function seekTo(t: number) {
    if (!isFinite(t)) return;
    const vid = videoRef.current;
    if (vid) vid.currentTime = t;
    else setCurrentTime(Math.max(0, Math.min(duration, t)));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else containerRef.current?.requestFullscreen().catch(() => undefined);
  }

  function handleAirPlay() {
    const vid = videoRef.current as HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void };
    vid?.webkitShowPlaybackTargetPicker?.();
  }

  function handleCast() {
    const vid = videoRef.current;
    if (!vid) return;
    // Chrome: W3C Remote Playback API — opens the native Cast device picker
    type RemotePlayback = { prompt: () => Promise<void> };
    const remote = (vid as HTMLVideoElement & { remote?: RemotePlayback }).remote;
    if (remote) { void remote.prompt().catch(() => { /* no devices available */ }); return; }
    // Safari fallback: AirPlay picker
    (vid as HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void })
      .webkitShowPlaybackTargetPicker?.();
  }


  function handleRestart() {
    const vid = videoRef.current;
    if (vid) vid.currentTime = 0;
    else setCurrentTime(0);
    setPlaying(true);
    revealControls();
  }

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) vid.playbackRate = playbackSpeed;
  }, [playbackSpeed]);



  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":           e.preventDefault(); if (!isYT) togglePlay();   break;
        case "ArrowLeft":   e.preventDefault(); if (!isYT) seek(-10);      break;
        case "ArrowRight":  e.preventDefault(); if (!isYT) seek(10);       break;
        case "m": case "M": if (!isYT) setMuted((m) => !m);               break;
        case "f": case "F": toggleFullscreen();                             break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration, revealControls, isYT]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDuration = videoRef.current?.duration ?? duration;
  const remaining      = Math.max(0, activeDuration - currentTime);

  const [supportsAirPlay, setSupportsAirPlay] = useState(false);
  const isCastAvailable = useCastSupport();
  useEffect(() => {
    setSupportsAirPlay(!isYT && "WebKitPlaybackTargetAvailabilityEvent" in window);
  }, [isYT]);

  // Set x-webkit-airplay on the video element (can't be done via JSX prop)
  useEffect(() => {
    videoRef.current?.setAttribute("x-webkit-airplay", "allow");
  }, []);

  // Prefer structured artistas from DB; fall back to parsing raw author string
  const credits: Array<{ name: string; role: string; photoUrl: string | null }> =
    item.artistas && item.artistas.length > 0
      ? item.artistas.map((a) => ({ name: a.name, role: a.role, photoUrl: a.photoUrl }))
      : item.author
        ? parseCredits(item.author).map((c) => ({ ...c, photoUrl: null }))
        : [];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black"
      onMouseMove={revealControls}
      onClick={isYT ? undefined : togglePlay}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {/* ── Video layer ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {mp4Url ? (
          <video
            ref={videoRef} src={mp4Url}
            className="h-full w-full object-contain"
            playsInline autoPlay
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => { if (playingRef.current) void videoRef.current?.play().catch(() => undefined); }}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onError={handleVideoError}
            onProgress={() => {
              const vid = videoRef.current;
              if (!vid || !vid.buffered.length || !vid.duration) return;
              setBuffered(vid.buffered.end(vid.buffered.length - 1) / vid.duration);
            }}
            onEnded={() => {
              setPlaying(false);
              saveProgress(item.numericId, videoRef.current?.duration ?? 0, true);
              // Force countdown to 0 so the navigate useEffect fires immediately
              if (nextItem && !navigatedRef.current) setCountdownSecs(0);
            }}
          />
        ) : youtubeUrl ? (
          <iframe
            src={youtubeUrl} title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen className="h-full w-full border-0"
          />
        ) : (
          <PosterArt style={item.style} title="" kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
        )}
      </div>

      {/* Buffering spinner */}
      {buffering && !videoError && !isYT && <GmaBufferingSpinner />}

      {/* Offline / error overlay */}
      {videoError && !isYT && (
        <div
          className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/85"
          style={{ zIndex: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke="#6D7D94" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="max-w-xs text-center text-[15px] font-semibold leading-relaxed text-white/80">
            Sin conexión. Comprueba tu internet e inténtalo de nuevo.
          </p>
          <button
            type="button"
            onClick={() => {
              if (bufferDebounceRef.current) { clearTimeout(bufferDebounceRef.current); bufferDebounceRef.current = null; }
              if (bufferTimeoutRef.current)  { clearTimeout(bufferTimeoutRef.current);  bufferTimeoutRef.current  = null; }
              setVideoError(false);
              setBuffering(false);
              const vid = videoRef.current;
              if (vid) { vid.load(); void vid.play().catch(() => undefined); setPlaying(true); }
            }}
            className="rounded-full bg-[#22B16B] px-7 py-2.5 text-[14px] font-bold text-gma-accent-fg transition-colors duration-150 hover:bg-[#2AC57A] active:scale-[0.97]"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Playing dim — fades out when paused */}
      {!isYT && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ background: "rgba(0,0,0,0.42)", opacity: playing ? 1 : 0 }}
        />
      )}

      {/* Pause cinematic vignette — fades in when paused */}
      {!isYT && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 30%, transparent 55%), linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 35%, transparent 55%)",
            opacity: playing ? 0 : 1,
          }}
        />
      )}

      {/* Play/pause pulse — hidden while buffering */}
      {pulsing && !isYT && !buffering && (
        <div
          key={String(playing)}
          className="pointer-events-none absolute"
          style={{ animation: "playerPulse 0.7s ease both" }}
        >
          {playing
            ? <PlayTriangle size={96} />
            : <GmaIcon name="pause" size={64} />
          }
        </div>
      )}

      {/* ── Pause: title + credits ───────────────────────────────────────── */}
      {!isYT && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 px-8 pb-39.5 transition-opacity duration-300 ease-in-out"
          style={{ opacity: playing ? 0 : 1 }}
        >
          <h2
            className="text-[62px] font-normal leading-[1.05] text-white"
            style={{
              ...serifItalic,
              textShadow: "0 2px 40px rgba(0,0,0,0.9), 0 1px 8px rgba(0,0,0,1)",
            }}
          >
            {item.title}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-white/45">
            <span>{item.year}</span>
            {item.kind === "movie" && (
              <>
                <span className="text-white/20">·</span>
                <span>{item.runtime}</span>
              </>
            )}
            {item.kind === "series" && (
              <>
                <span className="text-white/20">·</span>
                <span>{item.seasons} {item.seasons === 1 ? "temporada" : "temporadas"}</span>
              </>
            )}
            {item.categories.slice(0, 2).map((cat) => (
              <span key={cat} className="rounded-full border border-white/12 px-2.5 py-0.5 text-[11px]">
                {cat}
              </span>
            ))}
          </div>

          {credits.length > 0 && (
            <div
              className="mt-3 inline-flex items-center gap-3.5 rounded-xl border border-white/12 px-3.5 py-2.5 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
            >
              <p className="shrink-0 text-[9px] font-bold tracking-[0.13em] text-white/30 uppercase">
                Créditos
              </p>
              <div className="h-3.5 w-px bg-white/10" />
              <div className="flex items-center gap-4">
                {credits.map((c) => {
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                        {c.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.photoUrl}
                            alt={c.name}
                            width={26}
                            height={26}
                            className="h-6.5 w-6.5 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            style={{ width: 26, height: 26, background: creditInitialColor(c.name) }}
                            className="flex items-center justify-center text-[11px] font-extrabold text-[#031A0E]"
                          >
                            {(c.name[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold leading-none text-white/75">{c.name}</p>
                        {c.role && <p className="mt-0.5 text-[10px] leading-none text-white/40">{c.role}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-2 px-5 py-4 transition-opacity duration-300"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)",
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "auto" : "none",
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Back */}
        <div
          className="shrink-0 overflow-hidden rounded-full border border-white/12 backdrop-blur-md"
          style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
        >
          <button
            type="button"
            onClick={() => void handleClose()}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center text-white/60 transition-colors hover:text-[#22B16B]"
          >
            <ArrowLeft size={22} strokeWidth={1.6} />
          </button>
        </div>

        {/* Centered title + chapter */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <span className="max-w-[55%] truncate text-[14px] font-semibold text-white/85">{item.title}</span>
          {!isYT && duration > 0 && (
            <span className="text-[11px] text-white/40">
              {getChapter(currentTime, duration).name}
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {ccTrack && (
            <span className="rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#22B16B]">
              CC
            </span>
          )}

          {supportsAirPlay && (
            <TopBtn onClick={handleAirPlay} label="AirPlay">
              <Airplay size={18} strokeWidth={1.6} />
            </TopBtn>
          )}

          {(isCastAvailable || supportsAirPlay) && !isYT && (
            <TopBtn onClick={handleCast} label="Emitir a TV">
              <CastIcon size={18} />
            </TopBtn>
          )}

          {!isYT && (
            <TopBtn
              onClick={() => setShowSettings((s) => !s)}
              label="Ajustes"
              active={showSettings}
            >
              <Settings size={18} strokeWidth={1.6} />
            </TopBtn>
          )}

          <TopBtn
            onClick={toggleFullscreen}
            label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen
              ? <Minimize2 size={18} strokeWidth={1.6} />
              : <Maximize size={18} strokeWidth={1.6} />
            }
          </TopBtn>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && !isYT && (
        <SettingsPanel
          ccTrack={ccTrack}
          onCcTrack={setCcTrack}
          audioTrack={audioTrack}
          onAudioTrack={setAudioTrack}
          speed={playbackSpeed}
          onSpeed={setPlaybackSpeed}
          autoplayNext={autoplayNext}
          onAutoplayNext={setAutoplayNext}
          hasNext={Boolean(nextItem)}
        />
      )}

      {/* ── Autoplay countdown card ─────────────────────────────────────── */}
      {countdownSecs !== null && nextItem && (
        <AutoplayCountdown
          nextItem={nextItem}
          secs={countdownSecs}
          initial={countdownInitial}
          onPlayNow={handlePlayNext}
          onDismiss={() => {
            countdownDismissRef.current = true;
            setCountdownSecs(null);
          }}
          onRate={() => {
            navigatedRef.current = true;
            countdownDismissRef.current = true;
            setCountdownSecs(null);
            router.push(`/peliculas/${item.id}?valorar=1`);
          }}
        />
      )}

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      {!isYT && (
        <div
          className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-20 transition-opacity duration-300"
          style={{
            background: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%)",
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? "auto" : "none",
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Row 1 — remaining time, right-aligned */}
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              aria-label="Alternar tiempo"
              onClick={(e) => { e.stopPropagation(); setShowRemaining((r) => !r); }}
              className="text-[13px] tabular-nums text-white/50 transition-colors hover:text-[#22B16B]"
              style={MONO}
            >
              {showRemaining ? formatTime(currentTime) : `-${formatTime(remaining)}`}
            </button>
          </div>

          {/* Row 2 — play controls + scrubber inline */}
          <div className="flex items-center gap-2">
            <PlayerBtn onClick={() => seek(-10)} label="Retroceder 10s">
              <Skip10 direction="back" />
            </PlayerBtn>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproducir"}
              className="flex h-13 w-13 shrink-0 items-center justify-center outline-none transition-transform duration-100 hover:scale-110 active:scale-95"
            >
              {playing
                ? <GmaIcon name="pause" size={24} />
                : <PlayTriangle size={28} />
              }
            </button>

            <PlayerBtn onClick={() => seek(10)} label="Avanzar 10s">
              <Skip10 direction="forward" />
            </PlayerBtn>

            {/* Volume chip — between controls and scrubber */}
            <div
              className="flex shrink-0 items-center gap-0.5 rounded-full border border-white/12 px-1.5 py-0.5 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Activar sonido" : "Silenciar"}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:text-[#22B16B]"
              >
                {muted
                  ? <VolumeX size={15} strokeWidth={1.75} />
                  : <Volume2 size={15} strokeWidth={1.75} />
                }
              </button>
              <VolumeSlider volume={volume} muted={muted} onVolume={setVolume} />
            </div>

            {/* Scrubber — fills remaining width */}
            <div className="flex-1">
              <Scrubber
                currentTime={currentTime}
                duration={activeDuration}
                buffered={buffered}
                kind={item.kind}
                itemStyle={item.style}
                imageUrl={item.imageUrl}
                videoSrc={mp4Url ?? undefined}
                spriteUrl={spriteUrl ?? undefined}
                onSeek={seekTo}
              />
            </div>
          </div>

          {/* Row 3 — HD · START OVER · PLAY NEXT · GMA branding */}
          <div className="mt-2 flex items-center">
            {/* HD badge */}
            {mp4Url ? (
              <span className="rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white/50">
                HD
              </span>
            ) : (
              <span className="w-8.5" />
            )}

            <div className="flex flex-1 items-center justify-center gap-6">
              {/* START OVER */}
              <button
                type="button"
                onClick={handleRestart}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/55 transition-colors hover:text-white active:scale-95"
              >
                <SkipBack size={14} strokeWidth={2.5} />
                Reiniciar
              </button>

              {/* PLAY NEXT — only when nextItem available */}
              {nextItem && (
                <button
                  type="button"
                  onClick={() => router.push(`/ver/${nextItem.id}`)}
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/55 transition-colors hover:text-white active:scale-95"
                >
                  Siguiente
                  <SkipForward size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* GMA branding */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-gma.png" alt="GMA filmo" className="h-5 w-auto opacity-30" />
          </div>
        </div>
      )}

      {/* Hint for non-video items */}
      {!hasVideo && !playing && (
        <div
          className="pointer-events-none absolute bottom-36 left-1/2 -translate-x-1/2 text-center"
          style={{ animation: "fadeUp 0.5s ease both", animationDelay: "0.6s", opacity: 0 }}
        >
          <p className="text-[12px] font-semibold tracking-[0.08em] text-white/40">
            ESPACIO para reproducir · ← → para saltar 10s · M silenciar · F pantalla completa
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Autoplay countdown card ──────────────────────────────────────────────────

function AutoplayCountdown({
  nextItem,
  secs,
  initial,
  onPlayNow,
  onDismiss,
  onRate,
}: {
  nextItem: MediaItem;
  secs: number;
  initial: number;
  onPlayNow: () => void;
  onDismiss: () => void;
  onRate: () => void;
}) {
  return (
    <div
      className="absolute bottom-24 right-6 w-80 overflow-hidden rounded-2xl backdrop-blur-xl"
      style={{
        background: "rgba(10,10,12,0.96)",
        boxShadow: "0 16px 56px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.06)",
        zIndex: 16,
        animation: "fadeUp 0.35s ease both",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Label + dismiss */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/25">
          A continuación
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/25 transition-colors duration-150 hover:text-white/90"
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <p className="px-5 pb-4 text-[16px] font-semibold leading-snug text-white line-clamp-2">
        {nextItem.title}
      </p>

      {/* Progress bar + seconds */}
      <div className="flex items-center gap-3 px-5 pb-4">
        <div className="relative h-0.75 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            key={initial}
            className="absolute inset-y-0 left-0 rounded-full bg-[#22B16B]"
            style={{ animation: `countdownBar ${initial}s linear forwards` }}
          />
        </div>
        <span className="w-8 shrink-0 text-right tabular-nums text-[13px] font-bold text-[#22B16B]">
          {secs}s
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 px-5 pb-5">
        <button
          type="button"
          onClick={onPlayNow}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.75 text-[13px] font-bold text-[#0a0a0a] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97]"
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4l14 8-14 8V4z" />
          </svg>
          Reproducir ahora
        </button>
        <button
          type="button"
          onClick={onRate}
          className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-medium text-white/60 transition-[background-color,color] duration-150 hover:bg-[#22B16B] hover:text-gma-accent-fg"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Valorar este corto
        </button>
      </div>
    </div>
  );
}

// ─── Scrubber ─────────────────────────────────────────────────────────────────

function Scrubber({
  currentTime,
  duration,
  buffered,
  kind,
  itemStyle,
  imageUrl,
  videoSrc,
  spriteUrl,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  buffered: number;
  kind: "movie" | "series";
  itemStyle: MediaItem["style"];
  imageUrl?: string;
  videoSrc?: string;
  spriteUrl?: string;
  onSeek: (t: number) => void;
}) {
  const trackRef       = useRef<HTMLDivElement>(null);
  const thumbVidRef    = useRef<HTMLVideoElement>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging     = useRef(false);

  const [isActive,   setIsActive]   = useState(false);
  const [hoverState, setHoverState] = useState<{ time: number; pct: number } | null>(null);
  const [frameUrl,   setFrameUrl]   = useState<string | null>(null);

  // Build sprite cues from known constants — no fetch, no CORS
  const { spriteCues, spriteSheetW, spriteSheetH } = useMemo(() => {
    if (!spriteUrl || duration <= 0) return { spriteCues: [], spriteSheetW: 0, spriteSheetH: 0 };
    const numFrames = Math.ceil(duration / SPRITE_INTERVAL);
    const cols      = Math.min(SPRITE_COLS, numFrames);
    const rows      = Math.ceil(numFrames / cols);
    const cues: SpriteCue[] = [];
    for (let i = 0; i < numFrames; i++) {
      cues.push({
        start: i * SPRITE_INTERVAL,
        end:   Math.min((i + 1) * SPRITE_INTERVAL, duration),
        x:     (i % cols) * SPRITE_W,
        y:     Math.floor(i / cols) * SPRITE_H,
      });
    }
    return { spriteCues: cues, spriteSheetW: cols * SPRITE_W, spriteSheetH: rows * SPRITE_H };
  }, [spriteUrl, duration]);

  // Snap seek time to the start of the nearest sprite frame so the
  // video always lands on exactly what the thumbnail preview showed.
  function snapToSprite(t: number): number {
    if (!spriteCues.length) return t;
    const cue = spriteCues.find(c => t >= c.start && t < c.end)
             ?? spriteCues[spriteCues.length - 1];
    return cue?.start ?? t;
  }

  function pctAt(clientX: number): number {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  // Native document listeners for zero-lag drag
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    setIsActive(true);

    const rect = trackRef.current!.getBoundingClientRect();

    function getPct(clientX: number) {
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    }

    // Initial position
    const initPct = getPct(e.clientX);
    const initTime = (initPct / 100) * duration;
    setHoverState({ time: initTime, pct: initPct });
    onSeek(snapToSprite(initTime));

    let rafId: number | null = null;

    function onMove(ev: PointerEvent) {
      ev.preventDefault();
      const pct  = getPct(ev.clientX);
      const time = (pct / 100) * duration;
      setHoverState({ time, pct });
      // RAF-throttle the seek state update
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        onSeek(snapToSprite(time));
        rafId = null;
      });
    }

    function onUp(ev: PointerEvent) {
      isDragging.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      const pct  = getPct(ev.clientX);
      const time = (pct / 100) * duration;
      setHoverState({ time, pct });
      onSeek(snapToSprite(time));
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (isDragging.current) return; // handled by document listener
    const pct = pctAt(e.clientX);
    setHoverState({ time: (pct / 100) * duration, pct });
  }

  function onPointerEnter() { setIsActive(true); }
  function onPointerLeave() {
    if (!isDragging.current) {
      setIsActive(false);
      setHoverState(null);
    }
  }

  // Frame capture
  useEffect(() => {
    if (!hoverState || !videoSrc) return;
    const vid = thumbVidRef.current;
    if (!vid) return;
    function onSeeked() {
      const v = thumbVidRef.current;
      const canvas = thumbCanvasRef.current;
      if (!v || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        ctx.drawImage(v, 0, 0, 142, 80);
        setFrameUrl(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        setFrameUrl(null);
      }
    }
    if (!isFinite(hoverState.time)) return;
    vid.addEventListener("seeked", onSeeked, { once: true });
    vid.currentTime = hoverState.time;
    return () => vid.removeEventListener("seeked", onSeeked);
  }, [hoverState, videoSrc]);

  useEffect(() => {
    if (!isActive) setFrameUrl(null);
  }, [isActive]);

  const pct    = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufPct = buffered * 100;
  const chapter = hoverState ? getChapter(hoverState.time, duration) : null;

  return (
    <div
      ref={trackRef}
      className="relative flex cursor-pointer select-none items-center"
      style={{ height: 32, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Hidden video + canvas */}
      {videoSrc && (
        <>
          <video
            ref={thumbVidRef} src={videoSrc} muted preload="metadata"
            crossOrigin="anonymous" aria-hidden="true"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
          <canvas
            ref={thumbCanvasRef} width={142} height={80} aria-hidden="true"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        </>
      )}

      {/* Hover tooltip */}
      {isActive && hoverState && (
        <div
          className="pointer-events-none absolute flex flex-col items-center gap-1.5"
          style={{
            bottom: "calc(100% + 10px)",
            left: `clamp(72px, ${hoverState.pct}%, calc(100% - 72px))`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="relative h-20 w-35.5 overflow-hidden rounded-[6px] border border-white/15 shadow-xl">
            {(() => {
              // Sprite cue lookup — no fetch, computed from duration
              const cue = spriteCues.find(c => hoverState.time >= c.start && hoverState.time < c.end)
                       ?? spriteCues[spriteCues.length - 1];
              if (cue && spriteUrl && spriteSheetW > 0) {
                const scale = 142 / SPRITE_W;
                return (
                  <div style={{
                    width: 142, height: 80,
                    backgroundImage: `url(${spriteUrl})`,
                    backgroundPosition: `-${cue.x * scale}px -${cue.y * scale}px`,
                    backgroundSize: `${spriteSheetW * scale}px ${spriteSheetH * scale}px`,
                    backgroundRepeat: "no-repeat",
                  }} />
                );
              }
              // Fallback: canvas frame or poster
              return frameUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={frameUrl} alt="" draggable={false} className="h-full w-full object-cover" />
                : <PosterArt style={itemStyle} title="" kind={kind} ratio="landscape" imageUrl={imageUrl} />;
            })()}
            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
            <span
              className="absolute bottom-1.5 right-2 text-[10px] font-bold tabular-nums text-white/90 drop-shadow"
              style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace" }}
            >
              {formatTime(hoverState.time)}
            </span>
          </div>
          {kind === "series" && chapter && (
            <div className="whitespace-nowrap rounded-[6px] border border-white/10 bg-black/85 px-3 py-1 backdrop-blur-sm">
              <span className="text-[10.5px] font-bold text-[#22B16B]">Cap {chapter.num}</span>
              <span className="mx-1.5 text-[10.5px] text-white/30">·</span>
              <span className="text-[10.5px] text-white/70">{chapter.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className="relative w-full rounded-full bg-white/20 transition-[height] duration-150"
        style={{ height: isActive ? 5 : 4 }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white/25 transition-[width] duration-300"
          style={{ width: `${bufPct}%` }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-[#22B16B]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Thumb */}
      <div
        className="absolute top-1/2 rounded-full bg-white transition-all duration-150"
        style={{
          width:     isActive ? 14 : 10,
          height:    isActive ? 14 : 10,
          left:      `${pct}%`,
          transform: "translateX(-50%) translateY(-50%)",
          opacity:   pct > 0 ? 1 : 0,
          boxShadow: isActive ? "0 0 0 6px rgba(34,177,107,0.28)" : "0 0 0 2px rgba(255,255,255,0.15)",
        }}
      />
    </div>
  );
}

// ─── Volume slider ────────────────────────────────────────────────────────────

function VolumeSlider({
  volume,
  muted,
  onVolume,
}: {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
}) {
  const trackRef   = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const displayPct = muted ? 0 : volume * 100;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    setIsActive(true);

    const rect = trackRef.current!.getBoundingClientRect();

    function getVol(clientX: number) {
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    onVolume(getVol(e.clientX));

    function onMove(ev: PointerEvent) {
      onVolume(getVol(ev.clientX));
    }

    function onUp(ev: PointerEvent) {
      isDragging.current = false;
      onVolume(getVol(ev.clientX));
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function onPointerEnter() { setIsActive(true); }
  function onPointerLeave() { if (!isDragging.current) setIsActive(false); }

  return (
    <div
      ref={trackRef}
      className="relative mx-1 flex cursor-pointer select-none items-center"
      style={{ width: 56, height: 20, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="relative w-full rounded-full bg-white/25" style={{ height: 3 }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white transition-[width] duration-75"
          style={{ width: `${displayPct}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 rounded-full bg-white transition-all duration-150"
        style={{
          width:     isActive ? 11 : 9,
          height:    isActive ? 11 : 9,
          left:      `${displayPct}%`,
          transform: "translateX(-50%) translateY(-50%)",
          opacity:   displayPct > 0 ? 1 : 0,
          boxShadow: isActive ? "0 0 0 3px rgba(255,255,255,0.2)" : "none",
        }}
      />
    </div>
  );
}

// ─── Rounded play triangle ────────────────────────────────────────────────────

function PlayTriangle({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="playTriGrad" x1="5" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0"   stopColor="#22B16B" />
          <stop offset="0.5" stopColor="#6EF0AE" />
          <stop offset="1"   stopColor="#14C876" />
        </linearGradient>
      </defs>
      {/* Rounded-corner play triangle */}
      <path
        d="M8.5 4.5C7 3.5 5.5 4 5.5 5.5V18.5C5.5 20 7 20.5 8.5 19.5L20.5 13C22 12 22 12 20.5 11Z"
        fill="url(#playTriGrad)"
      />
    </svg>
  );
}

// ─── Buffering spinner ────────────────────────────────────────────────────────

function CastIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-5v2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2C12 15.93 7.07 11 1 10z" />
    </svg>
  );
}

function GmaBufferingSpinner() {
  const PATH = "m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64";
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 15 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes GmaSnurra {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -403px; }
        }
        @keyframes GmaMiniSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .gma-spin-halvan {
          animation: GmaSnurra 10s infinite linear;
          stroke-dasharray: 180 800;
          fill: none;
          stroke: url(#gmaSpinGradient);
          stroke-width: 23;
          stroke-linecap: round;
        }
        .gma-spin-strecken {
          animation: GmaSnurra 3s infinite linear;
          stroke-dasharray: 26 54;
          fill: none;
          stroke: url(#gmaSpinGradient);
          stroke-width: 23;
          stroke-linecap: round;
        }
      `}</style>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {/* Filter definition */}
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <filter id="gmaSpinFilter">
              <feGaussianBlur in="SourceGraphic" stdDeviation={3} result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 10 -5" result="inreGegga" />
              <feComposite in="SourceGraphic" in2="inreGegga" operator="atop" />
            </filter>
          </defs>
        </svg>

        {/* Main spinner */}
        <svg
          width={120} height={120} viewBox="0 0 200 200"
          style={{ filter: "url(#gmaSpinFilter)", display: "block" }}
        >
          <defs>
            <linearGradient id="gmaSpinGradient" x1={20} y1={20} x2={180} y2={180} gradientUnits="userSpaceOnUse">
              <stop offset={0}    stopColor="#031A0D" />
              <stop offset={0.25} stopColor="#22B16B" />
              <stop offset={0.5}  stopColor="#6EF0AE" />
              <stop offset={0.75} stopColor="#14C876" />
              <stop offset={1}    stopColor="#0A5C35" />
            </linearGradient>
          </defs>
          <path className="gma-spin-halvan" d={PATH} />
          <circle className="gma-spin-strecken" cx={100} cy={100} r={64} />
        </svg>

        {/* Shadow */}
        <svg
          width={120} height={120} viewBox="0 0 200 200"
          style={{ filter: "blur(3px)", opacity: 0.15, position: "absolute", top: 0, left: 0, transform: "translate(2px, 2px)" }}
        >
          <path className="gma-spin-halvan" d={PATH} />
          <circle className="gma-spin-strecken" cx={100} cy={100} r={64} />
        </svg>
      </div>
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────

function PlayerBtn({
  onClick, label, active, children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-[background-color,color] duration-150 ${
        active
          ? "bg-[#22B16B]/20 text-[#22B16B]"
          : "text-white/65 hover:bg-[#22B16B]/15 hover:text-[#22B16B]"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Top bar button ───────────────────────────────────────────────────────────

function TopBtn({
  onClick, label, active, children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/12 backdrop-blur-md transition-[background-color,border-color,color] duration-150 ${
        active
          ? "border-[#22B16B]/30 bg-[#22B16B]/20 text-[#22B16B]"
          : "bg-white/[0.07] text-white/60 hover:text-[#22B16B]"
      }`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
    >
      {children}
    </button>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({
  ccTrack, onCcTrack,
  audioTrack, onAudioTrack,
  speed, onSpeed,
  autoplayNext, onAutoplayNext,
  hasNext,
}: {
  ccTrack: string | null;
  onCcTrack: (t: string | null) => void;
  audioTrack: string;
  onAudioTrack: (t: string) => void;
  speed: number;
  onSpeed: (s: number) => void;
  autoplayNext: boolean;
  onAutoplayNext: (v: boolean) => void;
  hasNext: boolean;
}) {
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      className="absolute right-5 top-18 w-72 overflow-hidden rounded-2xl border border-white/10 backdrop-blur-xl"
      style={{ background: "rgba(8,8,8,0.92)", zIndex: 20, boxShadow: "0 8px 48px rgba(0,0,0,0.6)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="border-b border-white/8 px-4 py-3">
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-white/40">Ajustes</span>
      </div>

      {/* Playback speed */}
      <div className="border-b border-white/8 px-4 py-3">
        <p className="mb-2 text-[10px] font-bold tracking-widest uppercase text-white/30">Velocidad</p>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeed(s)}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                speed === s
                  ? "bg-[#22B16B] text-gma-accent-fg"
                  : "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/80"
              }`}
            >
              {s === 1 ? "1×" : `${s}×`}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitles */}
      <div className="border-b border-white/8 px-4 py-3">
        <p className="mb-1 text-[10px] font-bold tracking-widest uppercase text-white/30">Subtítulos</p>
        {CC_TRACKS.map((opt) => (
          <button
            key={String(opt.id)}
            type="button"
            onClick={() => onCcTrack(opt.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${
              ccTrack === opt.id ? "text-[#22B16B]" : "text-white/55 hover:text-white/80"
            }`}
          >
            <span className="flex w-3 shrink-0 items-center justify-center">
              {ccTrack === opt.id && <GmaIcon name="check" size={11} />}
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Audio */}
      <div className={hasNext ? "border-b border-white/8 px-4 py-3" : "px-4 py-3"}>
        <p className="mb-1 text-[10px] font-bold tracking-widest uppercase text-white/30">Audio</p>
        {AUDIO_TRACKS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onAudioTrack(opt.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${
              audioTrack === opt.id ? "text-[#22B16B]" : "text-white/55 hover:text-white/80"
            }`}
          >
            <span className="flex w-3 shrink-0 items-center justify-center">
              {audioTrack === opt.id && <GmaIcon name="check" size={11} />}
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Autoplay next */}
      {hasNext && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => onAutoplayNext(!autoplayNext)}
            className="flex w-full items-center justify-between"
          >
            <span className="text-[12.5px] text-white/60">Reproducir siguiente automáticamente</span>
            <div
              className={`relative ml-3 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                autoplayNext ? "bg-[#22B16B]" : "bg-white/20"
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  autoplayNext ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
