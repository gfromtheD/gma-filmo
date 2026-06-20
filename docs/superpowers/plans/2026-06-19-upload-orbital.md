# Upload Orbital — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Step 0 drag-drop box in Mi Estudio's upload wizard with an animated orbital UI where the center node handles the main video file and 5 orbital nodes manage supplementary assets.

**Architecture:** One new self-contained component `UploadOrbital` manages all per-node upload state internally and exposes a single `onMainReady` callback. `UploadView` swaps its Step 0 content for this component and threads the callback into the existing `canNext` logic. Steps 1 and 2 of the wizard are untouched.

**Tech Stack:** Next.js 14.2.35, React, TypeScript, Tailwind CSS (animation classes), Lucide React icons, inline styles using `C.*` tokens from `studio-ui.tsx`.

## Global Constraints

- All color values must use `C.*` tokens from `studio-ui.tsx` — no hardcoded hex except for the center gradient (`#a855f7 → #3b82f6 → #14b8a6`) which mirrors the reference component.
- No new global CSS. Use Tailwind animation classes (`animate-pulse`, `animate-ping`, `transition-all duration-300`, `duration-700`) and inline styles.
- No new dependencies. Icons from `lucide-react` only.
- `Captions` icon from lucide may not exist — use `Subtitles` instead. `Image` icon must be imported as `ImageIcon` to avoid collision with Next.js `Image`.
- The project has no test runner. Verification steps use the running dev server at `http://localhost:3000/mi-estudio` with the browser open to the Subir tab.
- Upload simulation is mock only (setInterval progress) — no real file transfer.

---

### Task 1: Scaffold `UploadOrbital` — types, node definitions, static render

**Files:**
- Create: `components/features/studio/studio-upload-orbital.tsx`

**Interfaces:**
- Produces: `export function UploadOrbital({ onMainReady }: UploadOrbitalProps)` — used by Task 6

- [ ] **Step 1: Create the file with types, node config, and a static placeholder render**

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import {
  Film, Play, Subtitles, Clapperboard, Sparkles,
  Check, Trash2, Upload, RefreshCw,
} from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import { C } from "./studio-ui";

// ── types ─────────────────────────────────────────────────────────────────────
type NodeState = "idle" | "uploading" | "done";

interface NodeData {
  state: NodeState;
  file: { name: string; size: string } | null;
  progress: number;
}

interface OrbitalNodeDef {
  id: string;
  label: string;
  icon: React.ElementType;
  accept: string;
  hint: string;
}

export interface UploadOrbitalProps {
  onMainReady: (f: { name: string; size: string }) => void;
}

// ── node definitions ──────────────────────────────────────────────────────────
const ORBITAL_NODES: OrbitalNodeDef[] = [
  { id: "trailer",   label: "Tráiler",        icon: Play,        accept: ".mp4,.mov",               hint: "MP4, MOV" },
  { id: "subtitles", label: "Subtítulos",     icon: Subtitles,   accept: ".srt,.vtt",               hint: "SRT, VTT" },
  { id: "extras",    label: "Extras",         icon: Clapperboard,accept: ".mp4,.mov",               hint: "MP4, MOV" },
  { id: "intro",     label: "Intro animada",  icon: Sparkles,    accept: ".mp4,.webm",              hint: "MP4, WebM" },
  { id: "poster",    label: "Póster",         icon: ImageIcon,   accept: ".jpg,.jpeg,.png,.webp",   hint: "JPG, PNG, WebP" },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(2) + " GB";
  if (bytes >= 1_048_576)     return (bytes / 1_048_576).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
}

// ── component ─────────────────────────────────────────────────────────────────
export function UploadOrbital({ onMainReady }: UploadOrbitalProps) {
  return (
    <div style={{ minHeight: 560, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textSec }}>UploadOrbital — scaffold</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles — open the browser at `http://localhost:3000/mi-estudio`, switch to the Subir tab**

The page should load without TS errors. The orbital is not yet wired in — no visible change expected yet.

- [ ] **Step 3: Commit**

```bash
git add components/features/studio/studio-upload-orbital.tsx
git commit -m "feat(studio): scaffold UploadOrbital component with types and node config"
```

---

### Task 2: Orbital animation — rotation, node positioning, static node circles

**Files:**
- Modify: `components/features/studio/studio-upload-orbital.tsx`

**Interfaces:**
- Consumes: `ORBITAL_NODES`, `NodeData` from Task 1
- Produces: `calculatePosition(index, total, rotationAngle)` used internally in Tasks 3–5

- [ ] **Step 1: Add state and rotation loop inside `UploadOrbital`, replace the scaffold body**

Replace the `UploadOrbital` function body with:

```tsx
export function UploadOrbital({ onMainReady }: UploadOrbitalProps) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate]       = useState(true);
  const [activeNodeId, setActiveNodeId]   = useState<string | null>(null);
  const [dragOver, setDragOver]           = useState(false);

  const [mainData, setMainData] = useState<NodeData>({ state: "idle", file: null, progress: 0 });
  const [nodeData, setNodeData] = useState<Record<string, NodeData>>(() =>
    Object.fromEntries(ORBITAL_NODES.map(n => [n.id, { state: "idle" as NodeState, file: null, progress: 0 }]))
  );

  const containerRef  = useRef<HTMLDivElement>(null);
  const mainInputRef  = useRef<HTMLInputElement>(null);
  const nodeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const timers        = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // ── rotation ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRotate) return;
    const id = setInterval(() => {
      setRotationAngle(a => Number(((a + 0.3) % 360).toFixed(3)));
    }, 50);
    return () => clearInterval(id);
  }, [autoRotate]);

  // ── cleanup timers on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => { Object.values(timers.current).forEach(clearInterval); };
  }, []);

  // ── position helper ─────────────────────────────────────────────────────────
  const RADIUS = 170;
  function calculatePosition(index: number, total: number) {
    const angle  = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x      = RADIUS * Math.cos(radian);
    const y      = RADIUS * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = activeNodeId
      ? 1
      : Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, zIndex, opacity };
  }

  // ── container click — close active node ─────────────────────────────────────
  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === containerRef.current) {
      setActiveNodeId(null);
      setAutoRotate(true);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      style={{ position: "relative", width: "100%", height: 560, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* orbit ring */}
      <div style={{
        position: "absolute",
        width: RADIUS * 2, height: RADIUS * 2,
        borderRadius: "50%",
        border: `1px solid ${C.border1}`,
        pointerEvents: "none",
      }} />

      {/* center node — placeholder for Task 3 */}
      <div style={{
        position: "absolute", zIndex: 10,
        width: 72, height: 72, borderRadius: "50%",
        background: "linear-gradient(135deg, #a855f7, #3b82f6, #14b8a6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />
      </div>

      {/* orbital nodes */}
      {ORBITAL_NODES.map((node, i) => {
        const pos = calculatePosition(i, ORBITAL_NODES.length);
        const data = nodeData[node.id];
        const Icon = node.icon;
        const isActive = activeNodeId === node.id;
        const isDone = data.state === "done";
        const isUploading = data.state === "uploading";

        return (
          <div
            key={node.id}
            className="transition-all duration-700"
            style={{
              position: "absolute",
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: isActive ? 200 : pos.zIndex,
              opacity: isDone ? 1 : pos.opacity,
            }}
            onClick={e => {
              e.stopPropagation();
              const next = isActive ? null : node.id;
              setActiveNodeId(next);
              setAutoRotate(next === null);
            }}
          >
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center cursor-pointer
                transition-all duration-300
                ${isActive  ? "scale-150 bg-white text-black border-2 border-white shadow-lg shadow-white/30" : ""}
                ${isDone    ? "border-2" : ""}
                ${isUploading ? "animate-pulse" : ""}
              `}
              style={{
                background: isActive ? "#fff" : isDone ? C.accent : C.w4,
                border: isActive ? "2px solid #fff"
                      : isDone   ? `2px solid ${C.accent30}`
                      : `1px solid rgba(255,255,255,0.4)`,
                color: isActive || isDone ? (isActive ? "#000" : C.onAccent) : "#fff",
              }}
            >
              <Icon size={16} />
            </div>
            <div
              className="absolute whitespace-nowrap text-xs font-semibold tracking-wide transition-all duration-300"
              style={{
                top: 44, left: "50%", transform: "translateX(-50%)",
                color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
              }}
            >
              {node.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser — wire temporarily into UploadView for a quick check**

In `studio-upload-view.tsx`, at the top of Step 0 block, add a temporary import and render:
```tsx
// TEMP — remove after Task 6
import { UploadOrbital } from "./studio-upload-orbital";
// inside Step 0 JSX, replace drop zone with:
<UploadOrbital onMainReady={() => {}} />
```

Navigate to Subir tab. You should see 5 nodes orbiting slowly around a gradient center circle. Clicking a node should stop rotation and scale the node up. Clicking the background should resume rotation.

- [ ] **Step 3: Remove the temporary wiring added in Step 2** (revert `studio-upload-view.tsx` to its original Step 0 content)

- [ ] **Step 4: Commit**

```bash
git add components/features/studio/studio-upload-orbital.tsx
git commit -m "feat(studio): add orbital rotation, node positioning and static node circles"
```

---

### Task 3: Center node — drag-drop, file input, progress ring, done state

**Files:**
- Modify: `components/features/studio/studio-upload-orbital.tsx`

**Interfaces:**
- Consumes: `mainData`, `setMainData`, `mainInputRef`, `timers`, `onMainReady` from Task 1/2 setup
- Produces: center node fully functional; `onMainReady` fires when upload reaches 100%

- [ ] **Step 1: Add `startUpload` helper function inside `UploadOrbital` (after the `calculatePosition` function)**

```tsx
function startUpload(
  id: string,
  name: string,
  size: string,
  setter: (fn: (prev: NodeData) => NodeData) => void,
  onDone?: (f: { name: string; size: string }) => void,
) {
  if (timers.current[id]) clearInterval(timers.current[id]);
  setter(() => ({ state: "uploading", file: { name, size }, progress: 0 }));
  timers.current[id] = setInterval(() => {
    setter(prev => {
      const next = Math.min(100, prev.progress + Math.random() * 14 + 4);
      if (next >= 100) {
        clearInterval(timers.current[id]);
        onDone?.({ name, size });
        return { ...prev, state: "done", progress: 100 };
      }
      return { ...prev, progress: next };
    });
  }, 320);
}
```

- [ ] **Step 2: Add `handleMainFile` function inside `UploadOrbital`**

```tsx
function handleMainFile(file: File) {
  startUpload(
    "main",
    file.name,
    fmtBytes(file.size),
    fn => setMainData(prev => fn(prev)),
    onMainReady,
  );
}
```

- [ ] **Step 3: Replace the center node placeholder div with the full center node JSX**

Replace this block inside the render:
```tsx
{/* center node — placeholder for Task 3 */}
<div style={{ ... }}>
  <div style={{ ... }} />
</div>
```

With:
```tsx
{/* hidden main file input */}
<input
  ref={mainInputRef}
  type="file"
  accept="video/mp4,video/quicktime,.mov"
  style={{ display: "none" }}
  onChange={e => { const f = e.target.files?.[0]; if (f) handleMainFile(f); e.target.value = ""; }}
/>

{/* center node */}
<div
  style={{ position: "absolute", zIndex: 10 }}
  onClick={e => { e.stopPropagation(); if (mainData.state !== "uploading") mainInputRef.current?.click(); }}
  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={e => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleMainFile(f);
  }}
>
  {/* ping rings */}
  <div className="absolute rounded-full animate-ping opacity-60"
    style={{ inset: -10, border: "1px solid rgba(255,255,255,0.2)" }} />
  <div className="absolute rounded-full animate-ping opacity-40"
    style={{ inset: -20, border: "1px solid rgba(255,255,255,0.1)", animationDelay: "0.5s" }} />

  {/* progress ring SVG */}
  {mainData.state === "uploading" && (
    <svg
      width={96} height={96}
      style={{ position: "absolute", top: -12, left: -12, transform: "rotate(-90deg)" }}
    >
      <circle cx={48} cy={48} r={44} fill="none" stroke={C.border2} strokeWidth={3} />
      <circle
        cx={48} cy={48} r={44} fill="none"
        stroke={C.accentH} strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 44}
        strokeDashoffset={2 * Math.PI * 44 * (1 - mainData.progress / 100)}
        style={{ transition: "stroke-dashoffset 0.3s ease" }}
      />
    </svg>
  )}

  {/* circle */}
  <div
    className="transition-all duration-500"
    style={{
      width: 72, height: 72, borderRadius: "50%", cursor: "pointer",
      background: mainData.state === "done"
        ? C.accent
        : dragOver
        ? "linear-gradient(135deg, #c084fc, #60a5fa, #2dd4bf)"
        : "linear-gradient(135deg, #a855f7, #3b82f6, #14b8a6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: dragOver ? `0 0 0 3px ${C.accentH}` : "none",
    }}
  >
    {mainData.state === "idle" && (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />
    )}
    {mainData.state === "uploading" && (
      <Film size={28} color="#fff" />
    )}
    {mainData.state === "done" && (
      <Check size={28} color={C.onAccent} strokeWidth={2.5} />
    )}
  </div>

  {/* label under center */}
  <div style={{
    position: "absolute", top: 82, left: "50%", transform: "translateX(-50%)",
    whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700,
    color: mainData.state === "done" ? C.accentH : "rgba(255,255,255,0.6)",
    letterSpacing: "0.06em", textTransform: "uppercase",
  }}>
    {mainData.state === "idle"      && "Película / Corto"}
    {mainData.state === "uploading" && `${Math.round(mainData.progress)}%`}
    {mainData.state === "done"      && mainData.file?.name}
  </div>
</div>
```

- [ ] **Step 4: Wire up temporary test in browser**

Add again the temporary wiring in `studio-upload-view.tsx` (same as Task 2 Step 2). Navigate to Subir tab. Click or drag a video file onto the center circle. You should see:
- Progress ring animating around the circle
- `Film` icon inside while uploading
- Green `Check` icon and accent background when done
- Label updates with progress % then filename

- [ ] **Step 5: Remove the temporary wiring**

- [ ] **Step 6: Commit**

```bash
git add components/features/studio/studio-upload-orbital.tsx
git commit -m "feat(studio): center node drag-drop, progress ring, done state and onMainReady callback"
```

---

### Task 4: Orbital node floating cards — expand, upload, progress, done, remove

**Files:**
- Modify: `components/features/studio/studio-upload-orbital.tsx`

**Interfaces:**
- Consumes: `ORBITAL_NODES`, `nodeData`, `setNodeData`, `nodeInputRefs`, `timers`, `startUpload`, `calculatePosition` from previous tasks
- Produces: each orbital node fully interactive with floating card

- [ ] **Step 1: Add `handleNodeFile` inside `UploadOrbital`**

```tsx
function handleNodeFile(nodeId: string, file: File) {
  startUpload(
    nodeId,
    file.name,
    fmtBytes(file.size),
    fn => setNodeData(prev => ({ ...prev, [nodeId]: fn(prev[nodeId]) })),
  );
}

function removeNode(nodeId: string) {
  if (timers.current[nodeId]) clearInterval(timers.current[nodeId]);
  setNodeData(prev => ({ ...prev, [nodeId]: { state: "idle", file: null, progress: 0 } }));
}
```

- [ ] **Step 2: Add a hidden `<input>` per orbital node — place inside the outer return, before the orbit ring div**

```tsx
{ORBITAL_NODES.map(node => (
  <input
    key={`input-${node.id}`}
    ref={el => { nodeInputRefs.current[node.id] = el; }}
    type="file"
    accept={node.accept}
    style={{ display: "none" }}
    onChange={e => {
      const f = e.target.files?.[0];
      if (f) handleNodeFile(node.id, f);
      e.target.value = "";
    }}
  />
))}
```

- [ ] **Step 3: Replace the existing orbital node JSX map with the full version including floating cards**

Replace the entire `{ORBITAL_NODES.map(...)}` block with:

```tsx
{ORBITAL_NODES.map((node, i) => {
  const pos     = calculatePosition(i, ORBITAL_NODES.length);
  const data    = nodeData[node.id];
  const Icon    = node.icon;
  const isActive    = activeNodeId === node.id;
  const isDone      = data.state === "done";
  const isUploading = data.state === "uploading";

  // card appears above node if node is in bottom half (y > 0), else below
  const cardStyle: React.CSSProperties = pos.y > 0
    ? { bottom: 56, left: "50%", transform: "translateX(-50%)" }
    : { top:    56, left: "50%", transform: "translateX(-50%)" };

  return (
    <div
      key={node.id}
      className="transition-all duration-700"
      style={{
        position: "absolute",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: isActive ? 200 : pos.zIndex,
        opacity: isDone ? 1 : pos.opacity,
      }}
      onClick={e => {
        e.stopPropagation();
        const next = isActive ? null : node.id;
        setActiveNodeId(next);
        setAutoRotate(next === null);
      }}
    >
      {/* node circle */}
      <div
        className="transition-all duration-300"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transform: isActive ? "scale(1.5)" : "scale(1)",
          background: isActive ? "#fff" : isDone ? C.accent : C.w4,
          border: isActive    ? "2px solid #fff"
                : isDone      ? `2px solid ${C.accent30}`
                : isUploading ? `1px solid rgba(255,255,255,0.7)`
                :               `1px solid rgba(255,255,255,0.4)`,
          color: isActive ? "#000" : isDone ? C.onAccent : "#fff",
          boxShadow: isActive ? "0 0 20px rgba(255,255,255,0.3)" : "none",
        }}
        className={isUploading ? "animate-pulse" : ""}
      >
        <Icon size={16} />
      </div>

      {/* label */}
      <div
        className="absolute whitespace-nowrap text-xs font-semibold tracking-wide transition-all duration-300"
        style={{
          top: 46, left: "50%", transform: "translateX(-50%)",
          color: isActive ? "#fff" : isDone ? C.accentH : "rgba(255,255,255,0.7)",
        }}
      >
        {node.label}
      </div>

      {/* floating card */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            ...cardStyle,
            width: 220,
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 16,
            padding: 16,
            zIndex: 300,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* connector line */}
          <div style={{
            position: "absolute",
            ...(pos.y > 0
              ? { bottom: -8, left: "50%", transform: "translateX(-50%)", height: 8 }
              : { top:   -8, left: "50%", transform: "translateX(-50%)", height: 8 }),
            width: 1, background: "rgba(255,255,255,0.3)",
          }} />

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
            {node.label}
          </div>

          {data.state === "idle" && (
            <>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>
                {node.hint}
              </p>
              <button
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 8, cursor: "pointer",
                  fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                  background: C.accent15, border: `1px solid ${C.accent30}`, color: C.accentH,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
                onClick={() => nodeInputRefs.current[node.id]?.click()}
              >
                <Upload size={13} /> Subir archivo
              </button>
            </>
          )}

          {data.state === "uploading" && (
            <>
              <p style={{ fontSize: 12, color: "#fff", margin: "0 0 10px", fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {data.file?.name}
              </p>
              <div style={{ height: 6, borderRadius: 999, background: C.w8, overflow: "hidden", marginBottom: 8 }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.accentH})`,
                  width: `${data.progress}%`, transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{ fontSize: 11.5, color: C.textSec, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5 }}>
                <RefreshCw size={11} className="studio-spin" /> {Math.round(data.progress)}%
              </div>
            </>
          )}

          {data.state === "done" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                  background: C.accent10, border: `1px solid ${C.accent30}`, color: C.accentH }}>
                  Completo
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#fff", margin: "0 0 4px", fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {data.file?.name}
              </p>
              <p style={{ fontSize: 11.5, color: C.textSec, margin: "0 0 12px" }}>{data.file?.size}</p>
              <button
                style={{
                  padding: "7px 12px", borderRadius: 7, cursor: "pointer",
                  fontSize: 11.5, fontWeight: 700, fontFamily: "inherit",
                  background: "transparent", border: "1px solid rgba(255,82,82,0.4)", color: "#ff7b7b",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onClick={() => { removeNode(node.id); setActiveNodeId(null); setAutoRotate(true); }}
              >
                <Trash2 size={12} /> Quitar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
})}
```

- [ ] **Step 4: Note — the node circle div has two `className` props which is invalid. Fix by merging them:**

In the node circle div, replace the two `className` attributes with one merged string:
```tsx
className={`transition-all duration-300${isUploading ? " animate-pulse" : ""}`}
```

- [ ] **Step 5: Verify in browser (with temporary wiring from Task 2)**

- Click each orbital node — card should appear above or below based on position
- Click "Subir archivo" — file picker opens
- Select any file — progress bar animates in card
- On completion — card shows "Completo", filename, size, and "Quitar" button
- "Quitar" resets the node to idle state

- [ ] **Step 6: Remove temporary wiring**

- [ ] **Step 7: Commit**

```bash
git add components/features/studio/studio-upload-orbital.tsx
git commit -m "feat(studio): orbital node floating cards with upload, progress, done and remove states"
```

---

### Task 5: Completeness indicator below the orbital

**Files:**
- Modify: `components/features/studio/studio-upload-orbital.tsx`

**Interfaces:**
- Consumes: `nodeData` — counts nodes in `"done"` state
- Produces: completeness dots and counter rendered below the orbital container

- [ ] **Step 1: Add completeness indicator after the closing `</div>` of the orbital container**

The orbital container div ends with `</div>` (the one with `ref={containerRef}`). After it, add:

```tsx
{/* completeness bar */}
{(() => {
  const doneCount = ORBITAL_NODES.filter(n => nodeData[n.id].state === "done").length;
  return (
    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {ORBITAL_NODES.map(n => (
          <div
            key={n.id}
            className="transition-all duration-500"
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: nodeData[n.id].state === "done" ? C.accent : C.w8,
              border: `1px solid ${nodeData[n.id].state === "done" ? C.accent30 : C.border2}`,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec }}>
        {doneCount === 0
          ? "Añade assets complementarios para mejorar tu contenido"
          : `${doneCount} de 5 assets completados`}
      </div>
      {doneCount < 5 && (
        <div style={{ fontSize: 11, color: C.textFaint }}>
          No obligatorio · mejora la experiencia del espectador
        </div>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Wrap both the orbital container and the completeness bar in a single fragment, then wrap that in the outer div returned by `UploadOrbital`**

The full return structure should be:
```tsx
return (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    {/* hidden inputs */}
    {/* orbital container */}
    {/* completeness bar */}
  </div>
);
```

- [ ] **Step 3: Verify in browser**

Upload 3 orbital assets. Three dots should turn green. Counter reads "3 de 5 assets completados".

- [ ] **Step 4: Commit**

```bash
git add components/features/studio/studio-upload-orbital.tsx
git commit -m "feat(studio): add completeness indicator dots and counter below orbital"
```

---

### Task 6: Integrate `UploadOrbital` into `UploadView` — replace Step 0

**Files:**
- Modify: `components/features/studio/studio-upload-view.tsx`

**Interfaces:**
- Consumes: `export function UploadOrbital({ onMainReady }: UploadOrbitalProps)` from `studio-upload-orbital.tsx`
- Produces: working wizard with orbital as Step 0, Steps 1+2 unchanged

- [ ] **Step 1: Add the import at the top of `studio-upload-view.tsx`**

```tsx
import { UploadOrbital } from "./studio-upload-orbital";
```

- [ ] **Step 2: Replace the entire Step 0 block in `UploadView`**

Remove this block (lines ~112–169):
```tsx
{/* Step 0: file */}
{step === 0 && (
  <div>
    {!file ? (
      <div onClick={...} onDragOver={...} onDragLeave={...} onDrop={...} style={...}>
        ...
      </div>
    ) : (
      <div style={card({ padding: 22 })}>
        ...
      </div>
    )}
  </div>
)}
```

Replace with:
```tsx
{/* Step 0: file */}
{step === 0 && (
  <UploadOrbital
    onMainReady={(f) => {
      setFile(f);
      setProgress(100);
    }}
  />
)}
```

- [ ] **Step 3: Remove now-unused state and refs from `UploadView`**

Remove these lines from `UploadView`:
```tsx
const [dragOver, setDragOver] = useState(false);
const timer = useRef<ReturnType<typeof setInterval> | null>(null);
```

And remove the `startUpload` function and its `useEffect` cleanup:
```tsx
const startUpload = (name: string, size: string) => { ... };
useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
```

- [ ] **Step 4: Remove now-unused imports from `UploadView`**

From the lucide import line, remove: `Upload, Check, RefreshCw, CheckCircle2`
(Keep `Film, ChevronRight, Plus, Trash2, Play, Info, CheckCircle2` — wait, `CheckCircle2` is still used in Step 1 trailer field. Keep it. Remove: `Upload, Check, RefreshCw`.)

Actually check carefully — `Upload` is used in Step 2 "Publicar" button. Keep it.
Final removals: `Check`, `RefreshCw`.

- [ ] **Step 5: Verify the full wizard flow end-to-end**

1. Navigate to `http://localhost:3000/mi-estudio`, click "Subir"
2. Step 0 shows the orbital — "Continuar" is disabled
3. Click center circle, select a video file — progress ring animates, then green check
4. "Continuar" button becomes enabled
5. Click "Continuar" — reaches Step 1 (Detalles) with all fields intact
6. Fill title + duration, click "Continuar" — reaches Step 2 (Vista previa)
7. Click "Publicar y enviar a revisión" — toast fires and nav returns to "titulos"

- [ ] **Step 6: Commit**

```bash
git add components/features/studio/studio-upload-view.tsx
git commit -m "feat(studio): integrate UploadOrbital into upload wizard Step 0"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Center node: drag-drop + file picker + progress ring + done state | Task 3 |
| 5 orbital nodes equidistant at 170px radius | Task 2 |
| Auto-rotation, pauses on active node | Task 2 |
| Opacity variable by orbital position | Task 2 |
| Node states: idle / uploading / done visual styles | Task 2+4 |
| Floating card: idle → upload button, uploading → progress, done → remove | Task 4 |
| Card positions above/below based on node quadrant | Task 4 |
| `onMainReady` callback to parent | Task 3 |
| Completeness dots + "N de 5" counter | Task 5 |
| "No obligatorio" note | Task 5 |
| Replace Step 0 in UploadView only | Task 6 |
| Steps 1+2 untouched | Task 6 (verified) |
| `C.*` tokens for colors | All tasks |
| No new CSS global | All tasks |
| No new dependencies | All tasks |

### Placeholder scan
None found.

### Type consistency
- `NodeData` defined in Task 1, used unchanged in Tasks 2–6
- `OrbitalNodeDef` defined in Task 1, used in Tasks 2, 4, 5
- `startUpload` defined in Task 3, used identically in Task 4
- `onMainReady: (f: { name: string; size: string }) => void` defined in Task 1, called in Task 3, consumed in Task 6
- `UploadOrbitalProps` defined in Task 1, imported in Task 6
