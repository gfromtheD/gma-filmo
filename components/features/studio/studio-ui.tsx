"use client";

import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  CheckCircle2, Clock, Pencil, AlertTriangle, Star, Play, ChevronDown,
} from "lucide-react";
import type { PosterData, TitleStatus } from "./studio-types";

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

// ── Menu ──────────────────────────────────────────────────────────────────────
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
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", [align]: 0, width, zIndex: 60,
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
                padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "transparent", color: it.danger ? C.error : C.textSec,
                fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
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
        </div>
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: C.w4,
          border: `1px solid ${open ? C.accent : "#1E2D42"}`,
          borderRadius: 10, padding: "10px 14px",
          color: "#fff", fontSize: 14, fontWeight: 500,
          fontFamily: "inherit", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          outline: "none", transition: "border-color 0.18s",
        }}
      >
        <span>{value}</span>
        <ChevronDown
          size={14}
          color={C.textMuted}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "#0F1923", border: `1px solid ${C.border2}`,
          borderRadius: 10, overflow: "hidden", zIndex: 200,
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          animation: "dropIn 0.13s ease both",
        }}>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                width: "100%", padding: "10px 14px", textAlign: "left",
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
        </div>
      )}
    </div>
  );
}
