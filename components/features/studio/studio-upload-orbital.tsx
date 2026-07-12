"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, Play, Pause, Film, Subtitles, Clapperboard,
  Sparkles, ImageIcon, Check, AlertCircle, Trash2, ChevronDown,
  RefreshCw, ChevronLeft, ChevronRight, Plus, GripVertical, ChevronUp,
} from "lucide-react";
import { C } from "./studio-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ── types ─────────────────────────────────────────────────────────────────────
type AssetType   = "main" | "trailer" | "subtitles" | "extras" | "intro" | "poster" | "poster_h" | "poster_v";
type UploadState = "pending" | "uploading" | "done" | "error";

interface QueuedFile {
  id: string; file: File; assetType: AssetType;
  state: UploadState; progress: number;
  r2Url: string | null; errorMsg: string | null; sizeLabel: string;
}

interface PreviewItem {
  fileId: string;
  objectUrl: string;
  filename: string;
  assetType: AssetType;
  mediaType: "video" | "image";
}

export interface UploadOrbitalProps {
  onMainReady:   (f: { name: string; size: string; sizeBytes: number; r2Url: string }) => void;
  onAssetReady?: (assetType: string, r2Url: string) => void;
}

// ── constants ─────────────────────────────────────────────────────────────────
const ASSET_DEFS: Record<AssetType, { label: string; icon: React.ElementType }> = {
  main:      { label: "Película / Corto",   icon: Film },
  trailer:   { label: "Tráiler",            icon: Play },
  subtitles: { label: "Subtítulos",         icon: Subtitles },
  extras:    { label: "Extras",             icon: Clapperboard },
  intro:     { label: "Intro animada",      icon: Sparkles },
  poster:    { label: "Póster",             icon: ImageIcon },
  poster_h:  { label: "Póster horizontal",  icon: ImageIcon },
  poster_v:  { label: "Póster vertical",    icon: ImageIcon },
};
const ASSET_ORDER: AssetType[] = ["main","trailer","subtitles","extras","intro","poster","poster_h","poster_v"];

const ADD_SLOTS: { type: AssetType; label: string; accept: string; icon: React.ElementType; group?: string }[] = [
  { type: "poster_h",  label: "Horizontal — carrusel del inicio", accept: "image/*", icon: ImageIcon, group: "poster" },
  { type: "poster_v",  label: "Vertical — catálogo y ficha",      accept: "image/*", icon: ImageIcon, group: "poster" },
  { type: "trailer",   label: "Añade el tráiler",   accept: "video/*",   icon: Play },
  { type: "subtitles", label: "Añade subtítulos",   accept: ".srt,.vtt", icon: Subtitles },
  { type: "extras",    label: "Añade extras",        accept: "video/*",   icon: Clapperboard },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + " GB";
  if (b >= 1_048_576)     return (b / 1_048_576).toFixed(1)  + " MB";
  return (b / 1024).toFixed(0) + " KB";
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function trunc(name: string, max = 30) {
  if (name.length <= max) return name;
  const ext = name.split(".").pop() ?? "";
  return name.slice(0, max - 3 - ext.length) + "…." + ext;
}

async function readVideoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

async function detectAssetType(file: File): Promise<{ assetType: AssetType; durationSec: number }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["srt","vtt"].includes(ext))    return { assetType: "subtitles", durationSec: 0 };
  if (file.type.startsWith("image/")) return { assetType: "poster",    durationSec: 0 };
  const dur = await readVideoDuration(file);
  return { assetType: "main", durationSec: dur };
}

// ── PreviewCarousel ────────────────────────────────────────────────────────────
function PreviewCarousel({
  previews, currentIdx, onNavigate, onRemoveCurrent,
}: {
  previews:        PreviewItem[];
  currentIdx:      number;
  onNavigate:      (dir: 1 | -1) => void;
  onRemoveCurrent: () => void;
}) {
  const [slideDir, setSlideDir]       = useState<1 | -1>(1);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsPlaying(false);
    setVideoLoaded(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [currentIdx]);

  const item  = previews[currentIdx];
  const total = previews.length;

  const handleNav = (dir: 1 | -1) => { setSlideDir(dir); onNavigate(dir); };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else           { void videoRef.current.play(); setIsPlaying(true); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* media area */}
      <div style={{ position: "relative", flex: 1, background: "#060c18", borderRadius: 10, overflow: "hidden", minHeight: 0 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: slideDir * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slideDir * 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0 }}
          >
            {item?.mediaType === "image" ? (
              <img
                src={item.objectUrl}
                alt={item.filename}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            ) : item ? (
              <>
                <video
                  ref={videoRef}
                  src={item.objectUrl}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  onLoadedData={() => {
                    setVideoLoaded(true);
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0.01;
                      videoRef.current.pause();
                      videoRef.current.onended = () => setIsPlaying(false);
                    }
                  }}
                  controls={false} muted playsInline
                />
                {!videoLoaded && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RefreshCw size={22} color={C.accentH} className="studio-spin" />
                  </div>
                )}
                <button
                  onClick={togglePlay}
                  style={{
                    position: "absolute", bottom: 10, left: 10,
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {isPlaying
                    ? <Pause size={13} color="#fff" />
                    : <Play  size={13} color="#fff" style={{ marginLeft: 1 }} />}
                </button>
              </>
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Film size={40} color={C.border2} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* nav arrows */}
        {total > 1 && (
          <>
            <button
              onClick={() => handleNav(-1)}
              style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                width: 30, height: 30, borderRadius: "50%",
                background: "rgba(0,0,0,0.65)", border: `1px solid ${C.border2}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10, transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.88)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.65)")}
            >
              <ChevronLeft size={14} color="#fff" />
            </button>
            <button
              onClick={() => handleNav(1)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                width: 30, height: 30, borderRadius: "50%",
                background: "rgba(0,0,0,0.65)", border: `1px solid ${C.border2}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10, transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.88)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.65)")}
            >
              <ChevronRight size={14} color="#fff" />
            </button>
          </>
        )}

        {/* close */}
        <button
          onClick={onRemoveCurrent}
          style={{
            position: "absolute", top: 8, right: 8,
            width: 24, height: 24, borderRadius: "50%",
            background: "rgba(239,68,68,0.85)", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 20,
          }}
        >
          <X size={11} color="#fff" />
        </button>
      </div>

      {/* footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, minHeight: 36 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item ? trunc(item.filename, 24) : "—"}
          </div>
          {item && (
            <div style={{ fontSize: 11, color: C.textFaint }}>{ASSET_DEFS[item.assetType].label}</div>
          )}
        </div>
        {total > 1 && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {previews.map((_, i) => (
              <div key={i} style={{
                width: i === currentIdx ? 16 : 5, height: 5, borderRadius: 999,
                background: i === currentIdx ? C.accentH : C.border2,
                transition: "all 0.22s ease",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EmptyDropZone ──────────────────────────────────────────────────────────────
function EmptyDropZone({ isDragOver }: { isDragOver: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "60px 24px" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: isDragOver ? C.accent15 : C.w8,
        border: `2px dashed ${isDragOver ? C.accentH : C.border2}`,
        transition: "all 0.2s",
      }}>
        <Upload size={26} color={isDragOver ? C.accentH : C.border2} strokeWidth={1.4} style={{ transition: "color 0.2s" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isDragOver ? "#fff" : C.textSec }}>
          {isDragOver ? "Suelta aquí" : "Arrastra tus archivos"}
        </div>
        <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>
          Vídeo · Póster · Subtítulos · Extras
        </div>
      </div>
    </div>
  );
}

// ── TypeSelect ─────────────────────────────────────────────────────────────────
function TypeSelect({ value, onChange, disabled }: {
  value: AssetType; onChange: (t: AssetType) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const Def  = ASSET_DEFS[value];
  const Icon = Def.icon;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => !disabled && setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 6,
        padding: "5px 8px", borderRadius: 6, cursor: disabled ? "default" : "pointer",
        background: "transparent", border: `1px solid ${open ? C.accent : C.border2}`,
        color: disabled ? C.textFaint : C.textSec, fontFamily: "inherit",
        fontSize: 11, fontWeight: 600, opacity: disabled ? 0.5 : 1, transition: "border-color 0.15s",
      }}>
        <Icon size={10} color={disabled ? C.textFaint : C.accentH} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{Def.label}</span>
        {!disabled && <ChevronDown size={9} color={C.textMuted} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 500,
          background: "#0F1923", border: `1px solid ${C.border2}`, borderRadius: 9,
          overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
        }}>
          {ASSET_ORDER.map(id => {
            const D = ASSET_DEFS[id]; const I = D.icon; const active = id === value;
            return (
              <button key={id} type="button" onClick={() => { onChange(id); setOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 11px", background: active ? C.accent15 : "transparent",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? C.accentH : C.textSec,
              }}>
                <I size={12} color={active ? C.accentH : C.textMuted} />{D.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AddSlotButton ──────────────────────────────────────────────────────────────
function AddSlotButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 9, cursor: "pointer",
        background: "transparent",
        border: `1px dashed ${hovered ? C.accent30 : C.border2}`,
        color: hovered ? "#fff" : C.textMuted,
        fontFamily: "inherit", fontSize: 12, fontWeight: 600, width: "100%",
        transition: "border-color 0.15s, color 0.15s",
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hovered ? C.accent15 : C.w8,
        transition: "background 0.15s",
      }}>
        <Icon size={11} color={hovered ? C.accentH : C.textMuted} style={{ transition: "color 0.15s" }} />
      </div>
      {label}
      <Plus size={11} color={hovered ? C.accentH : C.textMuted} style={{ marginLeft: "auto", transition: "color 0.15s" }} />
    </button>
  );
}

// ── main component ─────────────────────────────────────────────────────────────
export function UploadOrbital({ onMainReady, onAssetReady }: UploadOrbitalProps) {
  const [queue, setQueue]               = useState<QueuedFile[]>([]);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [detecting, setDetecting]       = useState(false);
  const [mainCategory, setMainCategory] = useState<"Película" | "Corto" | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [previews, setPreviews]     = useState<PreviewItem[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const authToken        = useRef<string | null>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const posterHInputRef  = useRef<HTMLInputElement>(null);
  const posterVInputRef  = useRef<HTMLInputElement>(null);
  const trailerInputRef  = useRef<HTMLInputElement>(null);
  const subInputRef      = useRef<HTMLInputElement>(null);
  const extrasInputRef   = useRef<HTMLInputElement>(null);
  const xhrRefs         = useRef<Record<string, XMLHttpRequest>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});
  const sessionUsed     = useRef(0);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    sb.auth.getSession().then(({ data: { session } }) => { authToken.current = session?.access_token ?? null; });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => { authToken.current = s?.access_token ?? null; });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => () => { previews.forEach(p => URL.revokeObjectURL(p.objectUrl)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent = queue.length > 0;

  // ── upload ─────────────────────────────────────────────────────────────────
  // Sube directo del navegador a R2 con una URL prefirmada — el archivo nunca
  // pasa por el servidor de Next.js, así que no choca con el límite de payload
  // de las Serverless Functions de Vercel (~4.5 MB), crítico para vídeos grandes.
  async function uploadFile(entry: QueuedFile) {
    setQueue(q => q.map(f => f.id === entry.id ? { ...f, state: "uploading", progress: 0 } : f));

    const setError = (msg: string) =>
      setQueue(q => q.map(f => f.id === entry.id ? { ...f, state: "error", errorMsg: msg } : f));

    const controller = new AbortController();
    abortControllers.current[entry.id] = controller;

    const contentType = entry.file.type || "application/octet-stream";

    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(authToken.current ? { Authorization: `Bearer ${authToken.current}` } : {}),
        },
        body: JSON.stringify({
          assetType:    entry.assetType,
          fileName:     entry.file.name,
          fileSize:     entry.file.size,
          contentType,
          sessionUsed:  sessionUsed.current,
        }),
      });

      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}) as { error?: string });
        setError(body.error ?? `Error ${presignRes.status}`);
        return;
      }

      const { presignedUrl, publicUrl } = await presignRes.json() as { presignedUrl: string; publicUrl: string };

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRefs.current[entry.id] = xhr;

        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setQueue(q => q.map(f => f.id === entry.id ? { ...f, progress: (e.loaded / e.total) * 100 } : f));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            sessionUsed.current += entry.file.size;
            setQueue(q => q.map(f => f.id === entry.id ? { ...f, state: "done", progress: 100, r2Url: publicUrl } : f));
            if (entry.assetType === "main") onMainReady({ name: entry.file.name, size: entry.sizeLabel, sizeBytes: entry.file.size, r2Url: publicUrl });
            else onAssetReady?.(entry.assetType, publicUrl);
            resolve();
          } else {
            setError(`Error ${xhr.status} al subir a almacenamiento`);
            resolve();
          }
        };
        xhr.onerror = () => { setError("Error de red durante la subida"); resolve(); };
        xhr.onabort = () => resolve();

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.send(entry.file);
      });
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") setError("Error de red");
    } finally {
      delete xhrRefs.current[entry.id];
      delete abortControllers.current[entry.id];
    }
  }

  function uploadAll() {
    queue.filter(f => f.state === "pending" || f.state === "error").forEach(uploadFile);
  }

  // ── add files (auto-detect type) ───────────────────────────────────────────
  const addFiles = useCallback(async (rawFiles: File[]) => {
    setDetecting(true);

    let currentPreviews: PreviewItem[] = [];
    setPreviews(p => { currentPreviews = p; return p; });

    const newEntries:  QueuedFile[]  = [];
    const newPreviews: PreviewItem[] = [];

    for (const file of rawFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isAllowed =
        file.type.startsWith("video/") ||
        file.type.startsWith("image/") ||
        ["srt","vtt"].includes(ext);
      if (!isAllowed) continue;

      const entryId = uid();
      const { assetType, durationSec } = await detectAssetType(file);

      if (assetType === "main") {
        setMainCategory(durationSec >= 2400 ? "Película" : "Corto");
      }

      newEntries.push({
        id: entryId, file, assetType, state: "pending",
        progress: 0, r2Url: null, errorMsg: null, sizeLabel: fmtBytes(file.size),
      });

      const isPreviewable =
        file.type.startsWith("video/") ||
        file.type.startsWith("image/") ||
        ["gif","webm"].includes(ext);
      if (isPreviewable) {
        newPreviews.push({
          fileId:    entryId,
          objectUrl: URL.createObjectURL(file),
          filename:  file.name,
          assetType,
          mediaType: (file.type.startsWith("image/") || ext === "gif") ? "image" : "video",
        });
      }
    }

    setQueue(q => [...q, ...newEntries]);
    if (newPreviews.length > 0) {
      const nextIdx = currentPreviews.length + newPreviews.length - 1;
      setPreviews(p => [...p, ...newPreviews]);
      setPreviewIdx(nextIdx);
    }
    setDetecting(false);

    for (const entry of newEntries) void uploadFile(entry);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── add files (forced type — from slot buttons) ────────────────────────────
  const addFilesForced = useCallback(async (rawFiles: File[], forcedType: AssetType) => {
    let currentPreviews: PreviewItem[] = [];
    setPreviews(p => { currentPreviews = p; return p; });

    const newEntries:  QueuedFile[]  = [];
    const newPreviews: PreviewItem[] = [];

    for (const file of rawFiles) {
      const ext     = file.name.split(".").pop()?.toLowerCase() ?? "";
      const entryId = uid();
      newEntries.push({
        id: entryId, file, assetType: forcedType, state: "pending",
        progress: 0, r2Url: null, errorMsg: null, sizeLabel: fmtBytes(file.size),
      });
      const isPreviewable = file.type.startsWith("video/") || file.type.startsWith("image/") || ["gif","webm"].includes(ext);
      if (isPreviewable) {
        newPreviews.push({
          fileId: entryId, objectUrl: URL.createObjectURL(file),
          filename: file.name, assetType: forcedType,
          mediaType: file.type.startsWith("image/") || ext === "gif" ? "image" : "video",
        });
      }
    }

    setQueue(q => [...q, ...newEntries]);
    if (newPreviews.length > 0) {
      const nextIdx = currentPreviews.length + newPreviews.length - 1;
      setPreviews(p => [...p, ...newPreviews]);
      setPreviewIdx(nextIdx);
    }
    for (const entry of newEntries) void uploadFile(entry);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── remove ─────────────────────────────────────────────────────────────────
  function swapItems(idxA: number, idxB: number) {
    setQueue(q => {
      if (idxA < 0 || idxB < 0 || idxA >= q.length || idxB >= q.length) return q;
      const next  = [...q];
      const typeA = next[idxA]!.assetType;
      const typeB = next[idxB]!.assetType;
      const tmp   = next[idxA]!;
      next[idxA]  = { ...next[idxB]!, assetType: typeA };
      next[idxB]  = { ...tmp,          assetType: typeB };
      return next;
    });
  }

  function removeFile(id: string) {
    xhrRefs.current[id]?.abort();
    delete xhrRefs.current[id];
    abortControllers.current[id]?.abort();
    delete abortControllers.current[id];
    setPreviews(prev => {
      const idx = prev.findIndex(p => p.fileId === id);
      if (idx !== -1) URL.revokeObjectURL(prev[idx]!.objectUrl);
      const next = prev.filter(p => p.fileId !== id);
      setPreviewIdx(i => Math.min(i, Math.max(next.length - 1, 0)));
      return next;
    });
    setQueue(q => {
      const removing = q.find(f => f.id === id);
      if (removing?.assetType === "main") setMainCategory(null);
      return q.filter(f => f.id !== id);
    });
  }

  function handlePreviewClose() {
    const current = previews[previewIdx];
    if (current) removeFile(current.fileId);
  }

  function navigate(dir: 1 | -1) {
    setPreviewIdx(i => (i + dir + previews.length) % previews.length);
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const uploadingCount = queue.filter(f => f.state === "uploading").length;
  const doneCount      = queue.filter(f => f.state === "done").length;
  const mainEntry      = queue.find(f => f.assetType === "main");

  const visibleSlots = ADD_SLOTS.filter(s => !queue.some(f => f.assetType === s.type));

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      style={{ position: "relative", width: "100%" }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div style={{
        borderRadius: 14, border: `1px solid ${C.border1}`, background: C.w4, overflow: "hidden",
        display: "flex", flexDirection: hasContent ? "row" : "column",
        transition: "flex-direction 0s",
      }}>

        {/* ── LEFT: drop zone ────────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            width: hasContent ? "55%" : "100%",
            transition: "width 0.38s ease",
            borderRight: hasContent ? `1px solid ${C.border1}` : "none",
            cursor: previews.length === 0 ? "pointer" : "default",
            display: "flex", flexDirection: "column",
          }}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
          onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => { if (previews.length === 0) fileInputRef.current?.click(); }}
        >
          <div style={{
            padding: previews.length > 0 ? 14 : 0,
            flex: 1, display: "flex", flexDirection: "column",
            minHeight: hasContent ? 480 : "auto",
          }}>
            {previews.length > 0 ? (
              <PreviewCarousel
                previews={previews}
                currentIdx={previewIdx}
                onNavigate={navigate}
                onRemoveCurrent={handlePreviewClose}
              />
            ) : (
              <EmptyDropZone isDragOver={isDragOver} />
            )}
          </div>

          {/* dashed border overlay when empty */}
          {previews.length === 0 && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 14, pointerEvents: "none",
              border: `2px dashed ${isDragOver ? C.accentH : C.border2}`, transition: "border-color 0.2s",
            }} />
          )}

          {/* + add more (bottom of left panel) */}
          {previews.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                margin: "0 14px 14px",
                padding: "6px 0", borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                background: C.w8, border: `1px dashed ${C.border2}`, color: C.textSec,
                width: "calc(100% - 28px)",
              }}
            >
              + Añadir más archivos
            </button>
          )}
        </div>

        {/* ── RIGHT: file list ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {hasContent && (
            <motion.div
              key="right-panel"
              initial={{ opacity: 0, width: 0, minWidth: 0 }}
              animate={{ opacity: 1, width: "45%", minWidth: 280, flex: 1 }}
              exit={{ opacity: 0, width: 0, minWidth: 0 }}
              transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>

                {/* header */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {detecting
                        ? "Detectando…"
                        : mainEntry
                        ? trunc(mainEntry.file.name.replace(/\.[^.]+$/, ""), 28)
                        : "Archivos añadidos"}
                    </h3>
                    {mainCategory && !detecting && (
                      <span style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                        padding: "2px 8px", borderRadius: 999,
                        border: `1px solid ${C.border2}`, color: C.textSec,
                        textTransform: "uppercase" as const,
                      }}>
                        {mainCategory}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 11.5, color: C.textSec }}>
                    {detecting
                      ? "Identificando tipos de archivo…"
                      : `${queue.length} archivo${queue.length !== 1 ? "s" : ""} · ${doneCount} subido${doneCount !== 1 ? "s" : ""}`}
                  </p>
                </div>

                {/* retry button — only for errors */}
                {queue.some(f => f.state === "error") && uploadingCount === 0 && (
                  <button onClick={uploadAll} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                    background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
                    color: "#f87171", width: "100%",
                  }}>
                    <RefreshCw size={13} />
                    Reintentar fallidos
                  </button>
                )}

                {/* file rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, overflowY: "auto", flex: 1 }}>
                  {queue.map((entry, idx) => {
                    const Icon      = ASSET_DEFS[entry.assetType].icon;
                    const isDragged = draggedIdx === idx;
                    const isOver    = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;
                    return (
                      <div
                        key={entry.id}
                        draggable
                        onDragStart={() => setDraggedIdx(idx)}
                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        onDragOver={e => { e.preventDefault(); if (draggedIdx !== null && draggedIdx !== idx) setDragOverIdx(idx); }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={e => {
                          e.preventDefault();
                          if (draggedIdx !== null && draggedIdx !== idx) swapItems(draggedIdx, idx);
                          setDraggedIdx(null); setDragOverIdx(null);
                        }}
                        style={{
                          display: "grid", gridTemplateColumns: "14px 26px 1fr auto 22px", alignItems: "start",
                          gap: 7, padding: "8px 9px", borderRadius: 9,
                          background: isOver ? C.accent10 : isDragged ? "rgba(255,255,255,0.03)" : C.w8,
                          border: `1px solid ${isOver ? C.accent30 : entry.state === "done" ? C.accent30 : entry.state === "error" ? "rgba(248,113,113,0.3)" : C.border2}`,
                          opacity: isDragged ? 0.45 : 1,
                          cursor: "grab",
                          transition: "background 0.12s, border-color 0.12s, opacity 0.12s",
                        }}
                      >
                        {/* drag handle */}
                        <div style={{ display: "flex", alignItems: "center", paddingTop: 6, cursor: "grab" }}>
                          <GripVertical size={12} color={C.textMuted} style={{ flexShrink: 0 }} />
                        </div>

                        {/* status icon */}
                        <div style={{
                          width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          background: entry.state === "done" ? C.accent15 : entry.state === "error" ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.06)",
                          marginTop: 1,
                        }}>
                          {entry.state === "done"      ? <Check       size={12} color={C.accentH} strokeWidth={2.5} />
                         : entry.state === "error"     ? <AlertCircle size={12} color="#f87171" />
                         : entry.state === "uploading" ? <RefreshCw   size={12} color={C.accentH} className="studio-spin" />
                         : <Icon size={12} color={C.textMuted} />}
                        </div>

                        {/* file info */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {trunc(entry.file.name, 24)}
                          </div>
                          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 1 }}>
                            {entry.sizeLabel}
                            {entry.state === "error" && <span style={{ color: "#f87171", marginLeft: 5 }}>{entry.errorMsg}</span>}
                          </div>
                          {entry.state === "uploading" && (
                            <div style={{ height: 2, borderRadius: 999, background: C.w8, overflow: "hidden", marginTop: 4 }}>
                              <div style={{ height: "100%", borderRadius: 999, background: `linear-gradient(90deg,${C.accent},${C.accentH})`, width: `${entry.progress}%`, transition: "width 0.3s ease" }} />
                            </div>
                          )}
                          <div style={{ marginTop: 5 }}>
                            <TypeSelect
                              value={entry.assetType}
                              disabled={entry.state === "uploading" || entry.state === "done"}
                              onChange={t => setQueue(q => q.map(f => f.id === entry.id ? { ...f, assetType: t } : f))}
                            />
                          </div>
                        </div>

                        {/* up / down */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 1 }}>
                          {[{ dir: -1 as const, Ico: ChevronUp }, { dir: 1 as const, Ico: ChevronDown }].map(({ dir, Ico }) => {
                            const disabled = dir === -1 ? idx === 0 : idx === queue.length - 1;
                            return (
                              <button
                                key={dir}
                                type="button"
                                onClick={e => { e.stopPropagation(); if (!disabled) swapItems(idx, idx + dir); }}
                                disabled={disabled}
                                style={{
                                  background: "none", border: "none", padding: "2px 3px", borderRadius: 4,
                                  cursor: disabled ? "not-allowed" : "pointer",
                                  color: C.textMuted, opacity: disabled ? 0.18 : 0.55,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  transition: "opacity 0.1s",
                                }}
                                onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                                onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.opacity = "0.55"; }}
                              >
                                <Ico size={11} />
                              </button>
                            );
                          })}
                        </div>

                        {/* remove */}
                        <button onClick={() => removeFile(entry.id)} disabled={entry.state === "uploading"} style={{
                          background: "none", border: "none", padding: 3, borderRadius: 5,
                          cursor: entry.state === "uploading" ? "not-allowed" : "pointer",
                          color: C.textMuted, opacity: entry.state === "uploading" ? 0.3 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
                        }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}

                  {/* add slots — visible only when main is present and that type isn't queued */}
                  {mainEntry && visibleSlots.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                      {/* poster section header — shown only while at least one poster slot is visible */}
                      {visibleSlots.some(s => s.group === "poster") && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "7px 10px 6px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border1}` }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textSec, letterSpacing: "0.04em" }}>
                            Póster
                          </span>
                          <span style={{ fontSize: 10.5, color: C.textFaint, lineHeight: 1.5 }}>
                            Puedes subir más de uno. Nuestro algoritmo alternará entre ellos automáticamente según el contexto.
                          </span>
                        </div>
                      )}
                      {visibleSlots.map(slot => (
                        <AddSlotButton
                          key={slot.type}
                          icon={slot.icon}
                          label={slot.label}
                          onClick={() => {
                            if (slot.type === "poster_h")  posterHInputRef.current?.click();
                            if (slot.type === "poster_v")  posterVInputRef.current?.click();
                            if (slot.type === "trailer")   trailerInputRef.current?.click();
                            if (slot.type === "subtitles") subInputRef.current?.click();
                            if (slot.type === "extras")    extrasInputRef.current?.click();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,.srt,.vtt,.jpg,.jpeg,.png,.webp,.gif,.webm"
          style={{ display: "none" }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFiles(f); e.target.value = ""; }}
        />
        <input ref={posterHInputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFilesForced(f, "poster_h"); e.target.value = ""; }} />
        <input ref={posterVInputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFilesForced(f, "poster_v"); e.target.value = ""; }} />
        <input ref={trailerInputRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFilesForced(f, "trailer"); e.target.value = ""; }} />
        <input ref={subInputRef} type="file" accept=".srt,.vtt" style={{ display: "none" }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFilesForced(f, "subtitles"); e.target.value = ""; }} />
        <input ref={extrasInputRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFilesForced(f, "extras"); e.target.value = ""; }} />
      </div>
    </motion.div>
  );
}
