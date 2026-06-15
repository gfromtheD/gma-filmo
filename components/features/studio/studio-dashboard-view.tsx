"use client";

import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { Film, Eye, Star, Heart, ArrowUp, ChevronRight, Plus, Clock, User, CheckCircle2, Check, HardDrive, Zap } from "lucide-react";
import { fmt, C, card, row, col, Stars, Poster, StudioLogo, Sparkline } from "./studio-ui";
import type { StudioData, StudioTitle, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onNav: (id: StudioTabId, payload?: StudioTitle) => void;
  onOpenTitle: (t: StudioTitle) => void;
}

function StatTile({ icon, label, value, sub, trend, spark }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; trend?: string; spark?: number[];
}) {
  return (
    <div style={card({ padding: "18px 20px", display: "flex", flexDirection: "column" })}>
      <div style={row()}>
        <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 9,
          background: C.accent10, border: `1px solid ${C.accent30}`, color: C.accentH, flexShrink: 0 }}>
          {icon}
        </span>
        {trend && (
          <span style={{ ...row(3), marginLeft: "auto", fontSize: 12, fontWeight: 700, color: C.accentH }}>
            <ArrowUp size={12} strokeWidth={2.4} />{trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 14, lineHeight: 1 }}>{value}</div>
      <div style={{ ...row(), justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>{label}</div>
          {sub && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 5, color: C.textMuted }}>{sub}</div>}
        </div>
        {spark && <Sparkline data={spark} w={84} h={30} />}
      </div>
    </div>
  );
}

const STORAGE = { used: 3.2, total: 5, files: 5 } as const;

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
  const [showPlans,  setShowPlans]  = useState(false);
  const [selectedGB, setSelectedGB] = useState(50);
  const pct    = Math.round((STORAGE.used / STORAGE.total) * 100);
  const freeGB = +(STORAGE.total - STORAGE.used).toFixed(1);
  const isWarn = pct >= 75;
  const isCrit = pct >= 90;

  const statusColor = isCrit ? C.error : isWarn ? C.gold : C.accentH;
  const trackColor  = isCrit ? "rgba(255,82,82,0.14)" : isWarn ? "rgba(232,184,75,0.14)" : C.accent15;
  const cardBorder  = isCrit ? "rgba(255,82,82,0.28)" : isWarn ? "rgba(232,184,75,0.22)" : C.border2;

  const progressMV = useMotionValue(0);
  const displayPct = useTransform(progressMV, (v) => Math.round(v));
  const radius     = 72;
  const circ       = 2 * Math.PI * radius;
  const dashOffset = useTransform(progressMV, (v) => circ - (v / 100) * circ);

  useEffect(() => {
    const a = animate(progressMV, pct, { duration: 1.5, ease: [0.43, 0.13, 0.23, 0.96] });
    return () => a.stop();
  }, [pct, progressMV]);

  const footerMsg = isCrit
    ? "Has alcanzado el límite de almacenamiento gratuito."
    : isWarn
      ? "Estás cerca del límite. Considera ampliar tu plan pronto."
      : `Con el espacio restante puedes subir aproximadamente ${Math.floor(freeGB / (STORAGE.used / STORAGE.files))} archivos más.`;

  return (
    <div style={card({ padding: "22px 26px", marginBottom: 22, borderColor: cardBorder })}>
      {/* Header */}
      <div style={{ ...row(12), justifyContent: "space-between", marginBottom: 22 }}>
        <div style={row(12)}>
          <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 9,
            background: trackColor, color: statusColor, flexShrink: 0 }}>
            <HardDrive size={17} />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Almacenamiento</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginTop: 1 }}>
              Plan gratuito · {STORAGE.total} GB incluidos
            </div>
          </div>
        </div>
        <button className="st-btn st-btn-secondary st-btn-sm"
          style={isWarn || isCrit ? { borderColor: `${statusColor}55`, color: statusColor } : {}}
          onClick={() => setShowPlans(v => !v)}>
          <Zap size={13} /> {showPlans ? "Cerrar" : "Ampliar plan"}
        </button>
      </div>

      {/* Radial ring + info */}
      <div style={{ ...row(32), alignItems: "center" }}>
        {/* SVG ring */}
        <div style={{ position: "relative", flexShrink: 0, width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 180 180"
            style={{ transform: "rotate(-90deg)", display: "block" }}
            role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <circle cx="90" cy="90" r={radius} strokeWidth="11" fill="transparent"
              stroke={trackColor} strokeDasharray="5 9" strokeLinecap="round" />
            <motion.circle cx="90" cy="90" r={radius} strokeWidth="11" fill="transparent"
              stroke={statusColor}
              strokeDasharray={`${circ} ${circ}`}
              strokeLinecap="round"
              style={{ strokeDashoffset: dashOffset }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <motion.span style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em",
                lineHeight: 1, color: "#fff" }}>
                {displayPct}
              </motion.span>
              <span style={{ fontSize: 17, fontWeight: 700, color: C.textMuted }}>%</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.textMuted }}>
              {STORAGE.used} / {STORAGE.total} GB
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {([
              ["Espacio usado",   `${STORAGE.used} GB`,    "#fff"      ],
              ["Espacio libre",   `${freeGB} GB`,           statusColor ],
              ["Archivos subidos", `${STORAGE.files}`,     "#fff"      ],
            ] as [string, string, string][]).map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>{label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: C.border1 }} />
          <div style={{ fontSize: 12.5, fontWeight: 600,
            color: isCrit ? C.errorFg : isWarn ? C.gold : C.textMuted }}>
            {footerMsg}
          </div>
        </div>
      </div>

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

export function DashboardView({ data, onNav, onOpenTitle }: Props) {
  const { creator, titles, recentComments } = data;
  const published = titles.filter(t => t.status === "publicado");
  const inReview  = titles.filter(t => t.status === "revision");
  const top = [...published].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <div style={card({ padding: "26px 28px", marginBottom: 22, position: "relative", overflow: "hidden",
        background: "linear-gradient(120deg, #0d1620 0%, #0D0D0D 60%)" })}>
        <div style={{ position: "absolute", top: -60, right: -30, width: 320, height: 320, borderRadius: "50%",
          background: `radial-gradient(circle, ${C.accent15}, transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ ...row(18), position: "relative", flexWrap: "wrap" }}>
          <StudioLogo colors={creator.logoColors} size={58} name={creator.studioName} rounded={15} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textMuted }}>Buenas tardes,</span>
            <div style={{ ...row(10), alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{creator.studioName}</h1>
              {creator.verified && (
                <span style={{ ...row(5), padding: "4px 10px", borderRadius: 999,
                  background: C.accent10, border: `1px solid ${C.accent30}`, color: C.accentH, fontSize: 12, fontWeight: 700 }}>
                  <CheckCircle2 size={13} strokeWidth={2.2} /> Verificado
                </span>
              )}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 15, color: C.textSec, fontStyle: "italic" }}>
              {'"Cada película es una marea que sube y se retira."'}
            </p>
          </div>
          <div style={row(10)}>
            <button className="st-btn st-btn-secondary" onClick={() => onNav("perfil")}>
              <User size={16} /> Perfil
            </button>
            <button className="st-btn st-btn-accent" onClick={() => onNav("subir")}>
              <Plus size={17} strokeWidth={2.2} /> Subir contenido
            </button>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
        <StatTile icon={<Film size={17} />} label="Títulos publicados" value={creator.stats.published}
          sub={`${creator.stats.titles} en total`} />
        <StatTile icon={<Eye size={17} />} label="Visualizaciones" value={fmt(creator.stats.totalViews)}
          trend="18%" spark={[6, 9, 11, 18, 15, 23, 19, 16]} />
        <StatTile icon={<Star size={17} />} label="Valoración media" value={creator.stats.avgRating.toFixed(1)}
          sub="sobre 5 estrellas" />
        <StatTile icon={<Heart size={17} />} label="Seguidores" value={fmt(creator.stats.followers)} trend="6%" />
      </div>

      {/* Storage occupancy */}
      <StorageCard />

      {/* Two-col section */}
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 22 }}>
        {/* Left: top titles */}
        <div>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Tu contenido con mejor rendimiento</h2>
            <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => onNav("titulos")}>
              Ver todo <ChevronRight size={15} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {top.map(t => (
              <div key={t.id} style={{ cursor: "pointer" }} onClick={() => onOpenTitle(t)}>
                <Poster data={t.poster} title={t.title} type={t.type} year={t.year} hover />
                <div style={{ ...row(), justifyContent: "space-between", marginTop: 9 }}>
                  <span style={{ ...row(4), fontSize: 12, fontWeight: 700, color: C.textSec }}>
                    <Eye size={13} /> {fmt(t.views)}
                  </span>
                  <Stars value={t.rating ?? 0} size={12} showNum />
                </div>
              </div>
            ))}
          </div>

          {inReview.length > 0 && (
            <div style={card({ marginTop: 18, padding: "16px 18px", display: "flex", alignItems: "center",
              gap: 14, borderColor: "rgba(232,184,75,0.28)", background: "rgba(232,184,75,0.05)" })}>
              <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 10,
                background: "rgba(232,184,75,0.12)", color: "#E8B84B", flexShrink: 0 }}>
                <Clock size={18} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{inReview.length} título en revisión</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, color: C.textMuted }}>
                  «{inReview[0]!.title}» — respuesta estimada en {inReview[0]!.reviewEta}.
                </div>
              </div>
              <button className="st-btn st-btn-secondary st-btn-sm" onClick={() => onNav("titulos")}>Ver estado</button>
            </div>
          )}
        </div>

        {/* Right: creator status + comments */}
        <div style={col(18)}>
          <div style={card({ padding: "18px 20px" })}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
              color: C.textFaint, marginBottom: 14 }}>Estado del creador</div>
            <div style={row(12)}>
              <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12,
                background: C.accent15, border: `1px solid ${C.accent30}`, color: C.accentH, flexShrink: 0 }}>
                <CheckCircle2 size={22} strokeWidth={2} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Creador verificado</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, color: C.textMuted }}>Desde {creator.verifiedSince}</div>
              </div>
            </div>
            <div style={{ height: 1, background: C.border1, margin: "16px 0" }} />
            <div style={col(11)}>
              {([
                ["Identidad confirmada", true],
                ["Derechos de contenido", true],
                ["Método de pago", true],
                ["Doble factor (2FA)", false],
              ] as [string, boolean][]).map(([l, ok]) => (
                <div key={l} style={{ ...row(), justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13.5, color: ok ? C.textSec : C.textMuted }}>{l}</span>
                  {ok ? (
                    <span style={{ ...row(5), color: C.accentH, fontSize: 12.5, fontWeight: 700 }}>
                      <Check size={14} strokeWidth={2.4} /> Listo
                    </span>
                  ) : (
                    <button className="st-btn st-btn-ghost st-btn-sm" style={{ color: "#E8B84B" }}>Activar</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={card({ padding: "18px 20px", flex: 1 })}>
            <div style={{ ...row(), justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>
                Comentarios recientes
              </div>
              <button className="st-btn st-btn-ghost st-btn-sm" style={{ padding: "2px 6px" }} onClick={() => onNav("estadisticas")}>
                Ver más
              </button>
            </div>
            <div style={col(14)}>
              {recentComments.slice(0, 3).map((c, i) => (
                <div key={c.id} style={{ borderBottom: i < 2 ? `1px solid ${C.border1}` : "none", paddingBottom: i < 2 ? 14 : 0 }}>
                  <div style={{ ...row(), justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.user}</span>
                    <Stars value={c.rating} size={11} />
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: C.textSec }}>{`"${c.text}"`}</p>
                  <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: C.textMuted }}>{c.title} · {c.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
