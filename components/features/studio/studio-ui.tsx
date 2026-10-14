"use client";

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CheckCircle as CheckCircle2, Clock, EditPencil as Pencil, WarningTriangle as AlertTriangle, Star, Play, NavArrowDown as ChevronDown } from "@/components/ui/icons";
import type { PosterData, TitleStatus } from "./studio-types";
import { lockPageScroll } from "@/lib/scroll-lock";

// ── number helpers ────────────────────────────────────────────────────────────
export function fmt(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
export function fmtFull(n: number | null | undefined): string {
  return n == null ? "0" : n.toLocaleString("es-ES");
}

// ── status config ─────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<TitleStatus, {
  label: string; bg: string; border: string; fg: string; icon: ReactNode;
}> = {
  publicado: {
    label: "Publicado", bg: "rgba(34,177,107,0.10)", border: "rgba(34,177,107,0.30)", fg: "#2AC57A",
    icon: <CheckCircle2 size={12} strokeWidth={2} />,
  },
  revision: {
    label: "En revisión", bg: "rgba(232,184,75,0.10)", border: "rgba(232,184,75,0.32)", fg: "#E8B84B",
    icon: <Clock size={12} strokeWidth={2} />,
  },
  borrador: {
    label: "Borrador", bg: "rgba(109,125,148,0.10)", border: "rgba(109,125,148,0.30)", fg: "#9aa9bb",
    icon: <Pencil size={12} strokeWidth={2} />,
  },
  rechazado: {
    label: "Rechazado", bg: "rgba(255,82,82,0.10)", border: "rgba(255,82,82,0.30)", fg: "#ff7b7b",
    icon: <AlertTriangle size={12} strokeWidth={2} />,
  },
};

// ── shared style constants ────────────────────────────────────────────────────
export const C = {
  accent:    "#22B16B",
  accentH:   "#2AC57A",
  accent10:  "rgba(34,177,107,0.10)",
  accent15:  "rgba(34,177,107,0.15)",
  accent30:  "rgba(34,177,107,0.30)",
  onAccent:  "#031A0E",
  surface:   "#0D0D0D",
  border1:   "#1A1A1A",
  border2:   "#262626",
  textSec:   "#B8C5D4",
  textMuted: "#5A6A7E",
  textFaint: "#3A4A5E",
  w4:        "rgba(255,255,255,0.04)",
  w6:        "rgba(255,255,255,0.06)",
  w8:        "rgba(255,255,255,0.08)",
  error:     "#ff5252",
  errorFg:   "#ff7b7b",
  gold:      "#E8B84B",
} as const;

export function card(extra?: CSSProperties): CSSProperties {
  return { background: C.surface, border: `1px solid ${C.border1}`, borderRadius: 14, ...extra };
}
export function row(gap = 8): CSSProperties {
  return { display: "flex", alignItems: "center", gap };
}
export function col(gap = 0): CSSProperties {
  return { display: "flex", flexDirection: "column", gap };
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status, size = "md" }: { status: TitleStatus; size?: "sm" | "md" }) {
  const s = STATUS_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      padding: size === "sm" ? "4px 9px" : "5px 11px",
      borderRadius: 999, fontSize: size === "sm" ? 11 : 12, fontWeight: 700,
      color: s.fg, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────
export function Stars({ value = 0, size = 14, showNum = false, count }: {
  value?: number; size?: number; showNum?: boolean; count?: number;
}) {
  return (
    <span style={row(5)}>
      <span style={row(2)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const pct = Math.max(0, Math.min(1, value - i)) * 100;
          return (
            <span key={i} style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
              <span style={{ position: "absolute", inset: 0, display: "flex" }}>
                <Star size={size} fill="#2a3340" strokeWidth={0} color="#2a3340" />
              </span>
              <span style={{ position: "absolute", inset: 0, width: `${pct}%`, overflow: "hidden", display: "flex" }}>
                <Star size={size} fill={C.gold} strokeWidth={0} color={C.gold} />
              </span>
            </span>
          );
        })}
      </span>
      {showNum && value > 0 && (
        <span style={{ fontSize: size - 1, fontWeight: 700, color: C.gold }}>{value.toFixed(1)}</span>
      )}
      {count != null && (
        <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>({fmt(count)})</span>
      )}
    </span>
  );
}

// ── Poster ────────────────────────────────────────────────────────────────────
export function Poster({
  data, imageUrl, title = "", year, type, ratio = "2 / 3", rounded = 12, hover = false,
}: {
  data?: PosterData | null; imageUrl?: string; title?: string; year?: number | string; type?: string;
  ratio?: string; rounded?: number; hover?: boolean;
}) {
  if (imageUrl) {
    return (
      <div className={hover ? "st-poster-wrap" : undefined} style={{
        position: "relative", aspectRatio: ratio, width: "100%", borderRadius: rounded,
        overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        {hover && (
          <div className="st-poster-play" style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
            background: "rgba(3,8,14,0.45)", opacity: 0, transition: "opacity 0.22s ease",
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: "rgba(255,255,255,0.92)",
              display: "grid", placeItems: "center", paddingLeft: 3 }}>
              <Play size={22} fill="#0A0F17" strokeWidth={0} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const p = data ?? { from: "#1c2a38", to: "#0a1119", accent: "#3fae7e" };
  const initials = title.split(" ").filter(Boolean).slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return (
    <div className={hover ? "st-poster-wrap" : undefined} style={{
      position: "relative", aspectRatio: ratio, width: "100%", borderRadius: rounded,
      overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)",
      background: `linear-gradient(155deg, ${p.from} 0%, ${p.to} 78%)`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.5,
        background: `radial-gradient(120% 90% at 18% 8%, ${p.accent}33 0%, transparent 42%), radial-gradient(140% 120% at 90% 100%, ${p.accent}22 0%, transparent 50%)` }} />
      <div style={{ position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)" }} />
      <div style={{ position: "absolute", top: -8, right: 6, fontFamily: "var(--font-serif)",
        fontStyle: "italic", fontSize: 88, fontWeight: 700, color: "rgba(255,255,255,0.06)", lineHeight: 1, userSelect: "none" }}>
        {initials || "M"}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 13px 13px",
        background: "linear-gradient(0deg, rgba(0,0,0,0.62) 0%, transparent 100%)" }}>
        <div style={{ width: 26, height: 3, borderRadius: 2, background: p.accent, marginBottom: 9 }} />
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 700,
          fontSize: 17, lineHeight: 1.12, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
          {title}
        </div>
        {(type ?? year) && (
          <div style={{ marginTop: 7, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
            {[type, year].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {hover && (
        <div className="st-poster-play" style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          background: "rgba(3,8,14,0.45)", opacity: 0, transition: "opacity 0.22s ease",
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 999, background: "rgba(255,255,255,0.92)",
            display: "grid", placeItems: "center", paddingLeft: 3 }}>
            <Play size={22} fill="#0A0F17" strokeWidth={0} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── StudioLogo ────────────────────────────────────────────────────────────────
export function StudioLogo({ colors, size = 44, name = "Estudio", rounded = 12, imageUrl }: {
  colors?: { from: string; to: string }; size?: number; name?: string; rounded?: number; imageUrl?: string;
}) {
  const c = colors ?? { from: "#22B16B", to: "#0d4f33" };
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: rounded, flexShrink: 0, objectFit: "cover" }}
      />
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius: rounded, flexShrink: 0,
      background: `linear-gradient(140deg, ${c.from}, ${c.to})`, display: "grid", placeItems: "center",
      fontWeight: 800, fontSize: size * 0.4, color: "#fff", letterSpacing: "-0.02em",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)", position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", inset: 0,
        background: "radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,0.22), transparent 60%)" }} />
      <span style={{ position: "relative" }}>{initials}</span>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
export function Sparkline({ data = [], w = 92, h = 30, color = C.accent }: {
  data?: number[]; w?: number; h?: number; color?: string;
}) {
  if (!data.length) return <div style={{ width: w, height: h }} />;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    h - 2 - ((d - min) / range) * (h - 4),
  ]);
  const pathD = pts.map((p, i) => `${i ? "L" : "M"}${p[0]!.toFixed(1)} ${p[1]!.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;
  const gid = `spk-${Math.random().toString(36).slice(2, 7)}`;
  const last = pts[pts.length - 1]!;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

// Keep dropdowns inside the visible viewport, including the mobile keyboard.
// Portal rendering avoids clipping by the upload preview and scrollable dialogs.
export function useStudioDropdown(open: boolean, anchor: RefObject<HTMLElement>, width?: number, align: "left" | "right" = "left") {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const panelWidth = Math.min(width ?? rect.width, Math.max(0, viewportWidth - 16));
      const below = Math.max(0, viewportTop + viewportHeight - rect.bottom - 14);
      const above = Math.max(0, rect.top - viewportTop - 14);
      const upwards = below < Math.min(panelRef.current?.scrollHeight ?? 280, 280) && above > below;
      const maxHeight = Math.min(360, Math.max(0, viewportHeight - 16), upwards ? above : below);
      const panelHeight = Math.min(panelRef.current?.scrollHeight ?? maxHeight, maxHeight);
      const preferredLeft = align === "right" ? rect.right - panelWidth : rect.left;
      setPosition({
        position: "fixed", zIndex: 650, boxSizing: "border-box", width: panelWidth,
        left: Math.max(viewportLeft + 8, Math.min(preferredLeft, viewportLeft + viewportWidth - panelWidth - 8)),
        top: Math.max(viewportTop + 8, Math.min(upwards ? rect.top - 6 - panelHeight : rect.bottom + 6, viewportTop + viewportHeight - panelHeight - 8)),
        maxHeight, overflowY: "auto", overscrollBehavior: "contain", visibility: "visible",
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, anchor, width, align]);
  return { panelRef, position };
}

// ── Menu ──────────────────────────────────────────────────────────────────────
export function useStudioDialog(active: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll();
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.getClientRects().length > 0);
    (controls()[0] ?? dialog).focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0]; const last = elements[elements.length - 1];
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active]);
  return dialogRef;
}

export interface MenuItem {
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}

export function Menu({ trigger, items, align = "right", width = 196 }: {
  trigger: ReactNode; items: MenuItem[]; align?: "right" | "left"; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { panelRef, position } = useStudioDropdown(open, ref, width, align);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", h);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", h); document.removeEventListener("keydown", key); };
  }, [open, panelRef]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && createPortal(
        <div ref={panelRef} style={{
          ...position,
          background: "#101820", border: `1px solid ${C.border2}`, borderRadius: 12,
          padding: 6, boxShadow: "0 18px 44px -12px rgba(0,0,0,0.7)",
          animation: "dropIn 0.14s ease both",
          transformOrigin: align === "right" ? "top right" : "top left",
        }}>
          {items.map((it, i) => it.divider ? (
            <div key={i} style={{ height: 1, background: C.border1, margin: "5px 4px" }} />
          ) : (
            <button key={i} onClick={() => { setOpen(false); it.onClick?.(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                padding: "11px 10px", minHeight: 44, borderRadius: 8, border: "none", cursor: "pointer",
                background: "transparent", color: it.danger ? C.error : C.textSec,
                fontSize: 13.5, fontWeight: 600, overflowWrap: "anywhere", fontFamily: "inherit",
                transition: "background 0.14s, color 0.14s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = it.danger ? "rgba(255,82,82,0.10)" : C.w6;
                e.currentTarget.style.color = it.danger ? C.errorFg : "#fff";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = it.danger ? C.error : C.textSec;
              }}>
              {it.icon && <span style={{ display: "flex", flexShrink: 0 }}>{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>, document.body
      )}
    </div>
  );
}

// ── StudioSelect — custom dropdown that follows the design system ──────────────
export function StudioSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { panelRef, position } = useStudioDropdown(open, ref);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", handler); document.removeEventListener("keydown", key); };
  }, [open, panelRef]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: "100%", minWidth: 0, minHeight: 44, background: C.w4,
          border: `1px solid ${open ? C.accent : "#1E2D42"}`,
          borderRadius: 10, padding: "10px 14px",
          color: "#fff", fontSize: 14, fontWeight: 500,
          fontFamily: "inherit", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          outline: "none", transition: "border-color 0.18s",
        }}
      >
        <span style={{ minWidth: 0, overflowWrap: "anywhere", textAlign: "left" }}>{value}</span>
        <ChevronDown
          size={14}
          color={C.textMuted}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", flexShrink: 0 }}
        />
      </button>

      {open && createPortal(
        <div ref={panelRef} style={{
          ...position,
          background: "#0F1923", border: `1px solid ${C.border2}`,
          borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          animation: "dropIn 0.13s ease both",
        }}>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                width: "100%", minHeight: 44, padding: "10px 14px", textAlign: "left", overflowWrap: "anywhere",
                background: opt === value ? C.accent15 : "transparent",
                border: "none",
                color: opt === value ? C.accentH : C.textSec,
                fontSize: 13.5, fontWeight: opt === value ? 700 : 500,
                fontFamily: "inherit", cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => {
                if (opt !== value) {
                  (e.currentTarget as HTMLElement).style.background = C.w6;
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }
              }}
              onMouseLeave={e => {
                if (opt !== value) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = C.textSec;
                }
              }}
            >
              {opt}
            </button>
          ))}
        </div>, document.body
      )}
    </div>
  );
}
