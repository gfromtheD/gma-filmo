"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { Eye, Star, ChevronDown, Plus, Check, HardDrive, Zap, ArrowUpRight, BarChart2, Calendar, CirclePlay } from "lucide-react";
import { fmt, C, card, row, Stars, Poster } from "./studio-ui";
import type { StudioData, StudioTitle, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onNav: (id: StudioTabId, payload?: StudioTitle) => void;
  onOpenTitle: (t: StudioTitle) => void;
}

const STORAGE = { used: 3.2, total: 10, files: 5 } as const;

const STORAGE_BREAKDOWN = [
  { key: "peliculas",  label: "Películas",  gb: 1.1, color: "#6C8EF5" },
  { key: "cortos",     label: "Cortos",     gb: 1.4, color: "#22B16B" },
  { key: "subtitulos", label: "Subtítulos", gb: 0.4, color: "#E8B84B" },
  { key: "extras",     label: "Extras",     gb: 0.3, color: "#B87AEF" },
] as const;

function StorageRing({ pct, color, trackColor, label, sub, dur = 1.5, size = 140 }: {
  pct: number; color: string; trackColor: string;
  label: string; sub: string; dur?: number; size?: number;
}) {
  const stroke = 9;
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const mv   = useMotionValue(0);
  const disp = useTransform(mv, (v) => Math.round(v));
  const off  = useTransform(mv, (v) => circ - (v / 100) * circ);

  useEffect(() => {
    const a = animate(mv, pct, { duration: dur, ease: [0.43, 0.13, 0.23, 0.96] });
    return () => a.stop();
  }, [pct, mv, dur]);

  const half = size / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={half} cy={half} r={r} strokeWidth={stroke} fill="transparent"
            stroke={trackColor} strokeDasharray="5 9" strokeLinecap="round" />
          <motion.circle cx={half} cy={half} r={r} strokeWidth={stroke} fill="transparent"
            stroke={color} strokeDasharray={`${circ} ${circ}`} strokeLinecap="round"
            style={{ strokeDashoffset: off }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <motion.span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "#fff" }}>
              {disp}
            </motion.span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>%</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>{sub}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{label}</div>
    </div>
  );
}

const SLIDER_MIN = 5;
const SLIDER_MAX = 500;

function calcPrice(gb: number): number {
  if (gb <= 5) return 0;
  const extra = gb - 5;
  const t1 = Math.min(extra, 15)  * 0.20; // 5-20 GB: €0.20/GB
  const t2 = Math.min(Math.max(extra - 15, 0), 80) * 0.12; // 20-100 GB: €0.12/GB
  const t3 = Math.max(extra - 95, 0) * 0.08; // 100-500 GB: €0.08/GB
  return t1 + t2 + t3;
}

function RollingDigit({ digit, size }: { digit: string; size: number }) {
  const n = parseInt(digit, 10);
  return (
    <div style={{ height: size, overflow: "hidden", width: size * 0.6, flexShrink: 0 }}>
      <motion.div
        animate={{ y: -n * size }}
        transition={{ duration: 0.52, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ willChange: "transform" }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{
            height: size, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.88, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "#fff",
          }}>
            {i}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function PriceRoller({ price }: { price: number }) {
  const formatted  = price.toFixed(2);
  const [raw, dec] = formatted.split(".");
  const intStr     = raw!.padStart(2, "0");
  const leadFaded  = raw!.length === 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: C.accentH, marginRight: 1, paddingBottom: 5 }}>€</span>
      <div style={{ opacity: leadFaded ? 0.15 : 1, transition: "opacity 0.3s" }}>
        <RollingDigit digit={intStr[0]!} size={46} />
      </div>
      <RollingDigit digit={intStr[1]!} size={46} />
      <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, margin: "0 1px 5px", color: "#fff" }}>,</span>
      <RollingDigit digit={dec![0]!} size={32} />
      <RollingDigit digit={dec![1]!} size={32} />
    </div>
  );
}

function StorageCard() {
  const [showPlans,     setShowPlans]     = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedGB,    setSelectedGB]    = useState(50);

  const total   = STORAGE.total;
  const pct     = Math.round((STORAGE.used / total) * 100);
  const freeGB  = +(total - STORAGE.used).toFixed(1);
  const isWarn  = pct >= 75;
  const isCrit  = pct >= 90;

  const statusColor = isCrit ? C.error : isWarn ? C.gold : C.accentH;
  const trackColor  = isCrit ? "rgba(255,82,82,0.14)" : isWarn ? "rgba(232,184,75,0.14)" : C.accent15;
  const cardBorder  = isCrit ? "rgba(255,82,82,0.28)" : isWarn ? "rgba(232,184,75,0.22)" : C.border2;

  const footerMsg = isCrit
    ? "Has alcanzado el límite de almacenamiento gratuito."
    : isWarn
      ? "Estás cerca del límite. Considera ampliar tu plan pronto."
      : `Tienes ${freeGB} GB libres · ${STORAGE.files} archivos subidos.`;

  return (
    <div style={card({ padding: "14px 16px", marginBottom: 22, borderColor: cardBorder, width: "fit-content" })}>
      {/* Header — solo título, sin botones */}
      <div style={{ ...row(10), marginBottom: 14 }}>
        <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 9,
          background: trackColor, color: statusColor, flexShrink: 0 }}>
          <HardDrive size={17} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Almacenamiento</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginTop: 1 }}>
            Plan gratuito · {total} GB incluidos
          </div>
        </div>
      </div>

      {/* Rings row — main siempre visible, desglose se despliega a la derecha */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-end", justifyContent: "center" }}>
        <StorageRing
          pct={pct} color={statusColor} trackColor={trackColor}
          label="Total" sub={`${STORAGE.used} / ${total} GB`}
        />
        <AnimatePresence>
          {showBreakdown && STORAGE_BREAKDOWN.map(({ key, label, gb, color }, i) => (
            <motion.div key={key} style={{ flexShrink: 0 }}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0, transition: { delay: i * 0.07, duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
              exit={{ opacity: 0, x: 30, transition: { delay: (STORAGE_BREAKDOWN.length - 1 - i) * 0.07, duration: 0.25, ease: [0.4, 0, 0.2, 1] } }}
            >
              <StorageRing
                pct={Math.round((gb / total) * 100)}
                color={color} trackColor={`${color}22`}
                label={label} sub={`${gb} GB`} dur={1.2}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer + botón desglose */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600,
          color: isCrit ? C.errorFg : isWarn ? C.gold : C.textMuted }}>
          {footerMsg}
        </div>
        <button className="st-btn st-btn-secondary st-btn-sm"
          onClick={() => setShowBreakdown(v => !v)}>
          <motion.span animate={{ rotate: showBreakdown ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: "inline-flex" }}>
            <ChevronDown size={13} />
          </motion.span>
          {showBreakdown ? "Cerrar" : "Ver desglose"}
        </button>
      </div>

      {/* Ampliar plan — solo visible dentro del desglose */}
      <AnimatePresence>
        {showBreakdown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border1}`, marginTop: 12 }}>
              <button className="st-btn st-btn-secondary st-btn-sm"
                style={isWarn || isCrit ? { borderColor: `${statusColor}55`, color: statusColor } : {}}
                onClick={() => setShowPlans(v => !v)}>
                <Zap size={13} /> {showPlans ? "Cerrar" : "Ampliar plan"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage slider + price calculator */}
      {showPlans && (() => {
        const price    = calcPrice(selectedGB);
        const isFree   = selectedGB <= 5;
        const extraGB  = selectedGB - 5;
        const sliderPct = ((selectedGB - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

        return (
          <div style={{ marginTop: 20, borderTop: `1px solid ${C.border1}`, paddingTop: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: C.textFaint, marginBottom: 18 }}>
              Elige cuánto espacio necesitas
            </div>
            <div style={{ ...row(20), alignItems: "stretch" }}>
              {/* Slider column */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ ...row(), justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {selectedGB}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.textMuted }}>GB</span>
                  </div>
                  {isFree && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.accentH, padding: "3px 10px",
                      background: C.accent10, borderRadius: 999, border: `1px solid ${C.accent30}` }}>
                      Plan actual
                    </span>
                  )}
                </div>
                <input
                  type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={5}
                  value={selectedGB}
                  onChange={e => setSelectedGB(Number(e.target.value))}
                  className="st-slider"
                  style={{
                    background: `linear-gradient(to right, ${C.accent} 0%, ${C.accent} ${sliderPct}%, ${C.w8} ${sliderPct}%, ${C.w8} 100%)`,
                  }}
                />
                <div style={{ ...row(), justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textFaint }}>5 GB · Gratis</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textFaint }}>500 GB</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
                  Los planes de pago estarán disponibles próximamente. Te notificaremos cuando estén activos.
                </p>
              </div>

              {/* Price card */}
              <div style={{ flexShrink: 0, width: 160, padding: "18px 16px", borderRadius: 14, textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                border: `1px solid ${isFree ? C.accent30 : C.border2}`,
                background: isFree ? C.accent10 : C.w6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.07em", color: isFree ? C.accentH : C.textMuted }}>
                  {isFree ? "Plan incluido" : "Precio estimado"}
                </div>
                {isFree ? (
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em",
                    color: C.accentH, lineHeight: 1.1, marginTop: 4 }}>
                    Gratis
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <PriceRoller price={price} />
                  </div>
                )}
                {!isFree && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>/&nbsp;mes</div>
                )}
                {!isFree && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: C.textMuted, marginTop: 4 }}>
                    {extraGB} GB adicionales
                  </div>
                )}
                {!isFree && (
                  <button className="st-btn st-btn-accent st-btn-sm"
                    style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>
                    Seleccionar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ActivityDots() {
  const COLS = 14, ROWS = 7;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: COLS }, (_, w) => (
        <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {Array.from({ length: ROWS }, (_, d) => {
            const n = ((w * 7 + d) * 37 + 13) % 10;
            const level = n < 3 ? 0 : n < 5 ? 1 : n < 7 ? 2 : n < 9 ? 3 : 4;
            const bg = [
              "rgba(255,255,255,0.05)",
              "rgba(34,177,107,0.15)",
              "rgba(34,177,107,0.3)",
              "rgba(34,177,107,0.55)",
              "#22B16B",
            ][level];
            return <div key={d} style={{ width: 10, height: 10, borderRadius: 2, background: bg }} />;
          })}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === "publicado" ? { bg: "rgba(34,177,107,0.12)", color: "#22B16B",  border: "rgba(34,177,107,0.3)",  label: "Publicado"   } :
    status === "revision"  ? { bg: "rgba(232,184,75,0.12)", color: "#E8B84B",  border: "rgba(232,184,75,0.3)",  label: "En revisión" } :
                             { bg: "rgba(255,255,255,0.05)", color: C.textMuted, border: C.border1,              label: "Borrador"    };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

export function DashboardView({ data, onNav, onOpenTitle }: Props) {
  const { creator, titles } = data;
  const published    = titles.filter(t => t.status === "publicado");
  const inReview     = titles.filter(t => t.status === "revision");
  const top          = [...published].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const featured     = titles.find(t => t.featured) ?? top[0];
  const sortedTitles = [...titles].sort((a, b) =>
    (b.publishDate ?? b.submittedDate ?? "").localeCompare(a.publishDate ?? a.submittedDate ?? "")
  );

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const today    = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  const verificationItems = [
    { label: "Identidad confirmada",   sub: "Completado",              done: true  },
    { label: "Derechos de contenido",  sub: "Completado",              done: true  },
    { label: "Método de pago",         sub: "Completado",              done: true  },
    { label: "Foto del estudio",       sub: "Completado",              done: true  },
    { label: "Doble factor (2FA)",     sub: "Pendiente · recomendado", done: false },
  ];
  const doneCount  = verificationItems.filter(v => v.done).length;
  const pubPct     = Math.round(published.length / Math.max(titles.length, 1) * 100);
  const reviewPct  = Math.round(inReview.length  / Math.max(titles.length, 1) * 100);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32,
        alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}>
            {greeting}, {creator.artistName}
          </h1>
          <div style={{ ...row(10), marginTop: 16 }}>
            <button className="st-btn st-btn-secondary" onClick={() => onNav("subir")}>
              <Plus size={14} strokeWidth={2.4} /> Añadir título
            </button>
            <button className="st-btn st-btn-ghost" style={{ color: C.textMuted }}>
              <Calendar size={13} /> {today}
            </button>
            <button className="st-btn st-btn-accent" onClick={() => onNav("estadisticas")}>
              <BarChart2 size={13} /> Ver informe
            </button>
          </div>
        </div>
        <div style={{ ...row(40), alignItems: "flex-start" }}>
          {([
            { value: String(creator.stats.published), label: "TÍTULOS",         trend: null  },
            { value: fmt(creator.stats.totalViews),   label: "VISUALIZACIONES",  trend: "18%" },
            { value: fmt(creator.stats.followers),    label: "SEGUIDORES",       trend: "6%"  },
          ] as const).map(({ value, label, trend }) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div style={{ ...row(8), justifyContent: "flex-end", alignItems: "baseline" }}>
                <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</span>
                {trend && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.accentH,
                    background: C.accent10, border: `1px solid ${C.accent30}`,
                    borderRadius: 999, padding: "2px 7px" }}>{trend}</span>
                )}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.13em", color: C.textFaint, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bento grid ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.35fr 0.9fr 1.05fr 1.05fr",
        gridTemplateAreas: `
          "progress stack   gauge     catalog"
          "featured table   table     checklist"
          "featured table   table     checklist"
        `,
        gap: 16,
      }}>

        {/* progress — valoración + activity dots */}
        <div style={{ gridArea: "progress", ...card({ padding: "22px 24px" }) }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.12em", color: C.textFaint, marginBottom: 10 }}>Valoración media</div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {Math.round(creator.stats.avgRating / 5 * 100)}%
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 5 }}>
            {creator.stats.avgRating.toFixed(1)} ★ · sobre 5 estrellas
          </div>
          <div style={{ marginTop: 18 }}><ActivityDots /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textFaint, marginTop: 6 }}>
            <span>Jul 2025</span><span>Jun 2026</span>
          </div>
        </div>

        {/* stack — 2 mini cards apiladas */}
        <div style={{ gridArea: "stack", display: "grid", gridTemplateRows: "1fr 1fr", gap: 16 }}>
          <div style={card({ padding: "16px 18px" })}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: C.textFaint, marginBottom: 10 }}>Publicados</div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>{pubPct}%</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{published.length} de {titles.length} títulos</div>
          </div>
          <div style={card({ padding: "16px 18px" })}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: C.textFaint, marginBottom: 10 }}>Nuevos</div>
            <div style={{ ...row(8), alignItems: "baseline" }}>
              <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>14%</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accentH }}>+5%</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>seguidores este mes</div>
          </div>
        </div>

        {/* gauge — almacenamiento */}
        <div style={{ gridArea: "gauge", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <StorageCard />
        </div>

        {/* catalog — distribución */}
        <div style={{ gridArea: "catalog", ...card({ padding: "18px 20px" }) }}>
          <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ width: `${pubPct}%`,    background: C.accentH, transition: "width 0.6s ease" }} />
            <div style={{ width: `${reviewPct}%`, background: "#E8B84B", transition: "width 0.6s ease" }} />
            <div style={{ flex: 1, background: C.w8 }} />
          </div>
          {[
            { label: "Publicados",         count: published.length,                                   color: C.accentH   },
            { label: "En revisión",        count: inReview.length,                                    color: "#E8B84B"   },
            { label: "Borradores / otros", count: titles.length - published.length - inReview.length, color: C.textFaint },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ ...row(), justifyContent: "space-between", padding: "9px 0",
              borderBottom: `1px solid ${C.border1}` }}>
              <span style={{ ...row(8), fontSize: 13.5, color: C.textSec }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color,
                  flexShrink: 0, display: "inline-block" }} />
                {label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{count}</span>
            </div>
          ))}
          <button className="st-btn st-btn-secondary"
            style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
            onClick={() => onNav("titulos")}>Gestionar títulos</button>
        </div>

        {/* featured — título destacado */}
        {featured && (
          <div style={{ gridArea: "featured", borderRadius: 14, overflow: "hidden", cursor: "pointer",
            border: `1px solid ${C.border2}`, display: "flex", flexDirection: "column", minHeight: 230 }}
            onClick={() => onOpenTitle(featured)}>
            <div style={{ flex: 1, padding: "14px 16px",
              background: `linear-gradient(160deg, ${featured.poster.from}66 0%, ${featured.poster.to}44 100%)`,
              display: "flex", flexDirection: "column" }}>
              <div style={{ ...row(), justifyContent: "space-between" }}>
                <span style={{ ...row(5), background: C.accent, color: "#000",
                  fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "3px 10px" }}>
                  <Star size={10} fill="currentColor" strokeWidth={0} /> Destacado
                </span>
                <div style={row(8)}>
                  <button className="st-btn st-btn-ghost st-btn-sm" style={{ padding: "5px 7px" }}
                    onClick={e => { e.stopPropagation(); onOpenTitle(featured); }}>
                    <CirclePlay size={15} />
                  </button>
                  <button className="st-btn st-btn-ghost st-btn-sm" style={{ padding: "5px 7px" }}>
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 0" }}>
                <Poster data={featured.poster} imageUrl={featured.r2PosterUrl} title={featured.title} type={featured.type} year={featured.year} />
              </div>
            </div>
            <div style={{ padding: "12px 16px 14px", background: C.w6, borderTop: `1px solid ${C.border1}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>{featured.title}</div>
              <div style={{ ...row(10), marginTop: 6 }}>
                <span style={{ ...row(4), fontSize: 12, color: C.textMuted }}>
                  <Eye size={12} /> {fmt(featured.views ?? 0)}
                </span>
                <Stars value={featured.rating ?? 0} size={11} showNum />
              </div>
            </div>
          </div>
        )}

        {/* table — últimos títulos (2 cols × 2 filas) */}
        <div style={{ gridArea: "table", ...card({ padding: "18px 20px" }) }}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Últimos títulos</span>
            <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => onNav("titulos")}>
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 1fr 1fr",
            gap: "0 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.1em", color: C.textFaint,
            padding: "0 8px 10px", borderBottom: `1px solid ${C.border1}` }}>
            <span>Título</span><span>Género</span><span>Vistas</span><span>Fecha</span><span>Estado</span>
          </div>
          {sortedTitles.slice(0, 6).map(t => (
            <div key={t.id}
              style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 1fr 1fr",
                gap: "0 12px", alignItems: "center", padding: "9px 8px",
                borderTop: `1px solid ${C.border1}`, cursor: "pointer", borderRadius: 9 }}
              onClick={() => onOpenTitle(t)}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ ...row(10), minWidth: 0 }}>
                <div style={{ width: 28, height: 38, borderRadius: 5, overflow: "hidden", flexShrink: 0 }}>
                  <Poster data={t.poster} imageUrl={t.r2PosterUrl} title={t.title} type={t.type} year={t.year} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
              </div>
              <span style={{ fontSize: 12.5, color: C.textMuted }}>{t.genre}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t.views ? fmt(t.views) : "—"}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>{t.publishDate ?? String(t.year)}</span>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>

        {/* checklist — verificación (2 filas) */}
        <div style={{ gridArea: "checklist", ...card({ padding: "18px 20px" }) }}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Verificación</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.accentH,
              background: C.accent10, border: `1px solid ${C.accent30}`,
              borderRadius: 999, padding: "2px 9px" }}>
              {doneCount}/{verificationItems.length}
            </span>
          </div>
          {verificationItems.map((item, i) => (
            <div key={item.label} style={{ ...row(12), padding: "11px 0",
              borderBottom: i < verificationItems.length - 1 ? `1px solid ${C.border1}` : "none" }}>
              <span style={{ display: "grid", placeItems: "center", width: 32, height: 32,
                borderRadius: 9, flexShrink: 0,
                background: item.done ? C.accent10 : "rgba(255,255,255,0.04)",
                border: `1px solid ${item.done ? C.accent30 : C.border1}` }}>
                {item.done
                  ? <Check size={14} strokeWidth={2.5} color={C.accentH} />
                  : <span style={{ width: 14, height: 14, borderRadius: "50%",
                      border: `2px solid ${C.border2}`, display: "block" }} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.done ? "#fff" : C.textMuted }}>{item.label}</div>
                <div style={{ fontSize: 11, marginTop: 1, color: item.done ? C.textMuted : "#E8B84B" }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
