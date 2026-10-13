"use client";
import { useEffect, useRef } from "react";
interface Player { destroy(): void }
interface YouTubeAPI { Player: new (iframe: HTMLIFrameElement, options: { events: { onStateChange(event: { data: number }): void } }) => Player }
type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void };
let loading: Promise<YouTubeAPI> | null = null;
function loadAPI(): Promise<YouTubeAPI> {
  const win = window as YouTubeWindow;
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => { previous?.(); if (win.YT) resolve(win.YT); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { loading = null; reject(new Error("YouTube API unavailable")); };
    document.head.appendChild(script);
  });
  return loading;
}
export function YouTubeVideo({ url, title, onEnded, onPlaying }: { url: string; title: string; onEnded: () => void; onPlaying?: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const end = useRef(onEnded); end.current = onEnded;
  const play = useRef(onPlaying); play.current = onPlaying;
  useEffect(() => {
    let cancelled = false; let player: Player | undefined;
    const host = container.current;
    if (!host) return;
    const src = new URL(url); src.searchParams.set("enablejsapi", "1"); src.searchParams.set("origin", window.location.origin);
    const iframe = document.createElement("iframe");
    iframe.src = src.toString(); iframe.title = title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true; iframe.className = "h-full w-full border-0";
    host.appendChild(iframe);
    void loadAPI().then(api => {
      if (!cancelled) player = new api.Player(iframe, { events: { onStateChange: event => { if (event.data === 0) end.current(); else if (event.data === 1) play.current?.(); } } });
    }).catch(() => { /* The embedded video remains available if its event API fails. */ });
    return () => { cancelled = true; player?.destroy(); host.replaceChildren(); };
  }, [url, title]);
  return <div ref={container} className="h-full w-full" />;
}
