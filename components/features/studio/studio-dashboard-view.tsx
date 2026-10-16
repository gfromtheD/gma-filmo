"use client";

import styles from "./studio-responsive.module.css";

import { Eye, Star, Plus, ArrowUpRight, StatsReport as BarChart2, Calendar, Play as CirclePlay } from "@/components/ui/icons";
import { fmt, C, card, row, Poster } from "./studio-ui";
import type { StudioData, StudioTitle, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onNav: (id: StudioTabId, payload?: StudioTitle) => void;
  onOpenTitle: (t: StudioTitle) => void;
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

  const pubPct     = Math.round(published.length / Math.max(titles.length, 1) * 100);
  const reviewPct  = Math.round(inReview.length  / Math.max(titles.length, 1) * 100);

  return (
    <div className={styles.studio}>
      {/* ── Header ── */}
      <div className={styles.dashboardHeader} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32,
        alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}>
            {greeting}{creator.artistName ? `, ${creator.artistName}` : ""}
          </h1>
          <div className={styles.actions} style={{ ...row(10), marginTop: 16 }}>
            <button className="st-btn st-btn-secondary" onClick={() => onNav("subir")}>
              <Plus size={14} strokeWidth={2.4} /> Añadir título
            </button>
            <button className="st-btn st-btn-ghost" style={{ color: C.textMuted }}>
              <Calendar size={13} /> {today}
            </button>
            <button className="st-btn st-btn-accent" onClick={() => onNav("inicio")}>
              <BarChart2 size={13} /> Ver informe
            </button>
          </div>
        </div>
        <div className={styles.dashboardStats} style={{ ...row(40), alignItems: "flex-start" }}>
          {([
            { value: String(published.length), label: "TÍTULOS",         trend: null  },
            { value: creator.stats.totalViews == null ? "—" : fmt(creator.stats.totalViews),   label: "VISUALIZACIONES",  trend: null },
            { value: creator.stats.followers == null ? "—" : fmt(creator.stats.followers),    label: "SEGUIDORES",       trend: null  },
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
      <div className={styles.dashboard} style={{
        display: "grid",
        gridTemplateColumns: "1.1fr 1.2fr 1.05fr 1.05fr",
        gridTemplateAreas: `
          "progress stack   featured catalog"
          "gauge    table   table    checklist"
          "gauge    table   table    checklist"
        `,
        gap: 16,
      }}>

        {/* Valoración: sin cifras o actividad de demostración */}
        <div style={{ gridArea: "progress", ...card({ padding: "22px 24px" }) }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.12em", color: C.textFaint, marginBottom: 10 }}>Valoración media</div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {creator.stats.avgRating?.toFixed(1) ?? "—"}
          </div>
          <p style={{ fontSize: 13, color: C.textSec, marginTop: 12 }}>Las valoraciones agregadas todavía no están disponibles en el estudio.</p>
        </div>

        {/* stack — Publicados + Nuevos apiladas a la izquierda, En revisión a la derecha
            de ambas (misma altura combinada) para no dejar hueco en la columna */}
        <div className={styles.dashboardStack} style={{ gridArea: "stack", display: "grid",
          gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 16 }}>
          <div style={card({ padding: "16px 18px" })}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: C.textFaint, marginBottom: 10 }}>Publicados</div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>{pubPct}%</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{published.length} de {titles.length} títulos</div>
          </div>
          <div style={{ gridRow: "span 2", ...card({ padding: "18px", height: "100%",
            display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }) }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: C.textFaint }}>En revisión</div>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{reviewPct}%</div>
            <div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{inReview.length} título{inReview.length !== 1 ? "s" : ""} en cola de revisión</div>
              <div style={{ height: 4, borderRadius: 999, background: C.w8, overflow: "hidden", marginTop: 10 }}>
                <div style={{ height: "100%", width: `${reviewPct}%`, borderRadius: 999, background: "#E8B84B" }} />
              </div>
            </div>
          </div>
          <div style={card({ padding: "16px 18px" })}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>Seguidores</div>
            <p style={{ fontSize: 13, color: C.textSec }}>Esta métrica todavía no está disponible.</p>
          </div>
        </div>

        <div style={{ gridArea: "gauge", ...card({ padding: "18px 20px" }) }}>
          <h2 style={{ fontSize: 14, margin: 0 }}>Almacenamiento</h2>
          <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>El consumo de almacenamiento todavía no está disponible.</p>
        </div>

        {/* catalog — distribución */}
        <div style={{ gridArea: "catalog", ...card({ padding: "18px 20px", height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "center" }) }}>
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

        {/* featured — título destacado (compacto y horizontal: fila 1 fija, no bloquea
            el hueco que se abre a la derecha de "gauge" cuando se expande el desglose) */}
        {featured && (
          <div style={{ gridArea: "featured", ...card({ padding: "14px 16px", cursor: "pointer" }),
            height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}
            onClick={() => onOpenTitle(featured)}>
            <div style={{ ...row(), justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ ...row(5), background: C.accent, color: "#000",
                fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "3px 9px" }}>
                <Star size={9} fill="currentColor" strokeWidth={0} /> Destacado
              </span>
              <div style={row(6)}>
                <button className="st-btn st-btn-ghost st-btn-sm" style={{ padding: "4px 6px" }}
                  onClick={e => { e.stopPropagation(); onOpenTitle(featured); }}>
                  <CirclePlay size={14} />
                </button>
                <button className="st-btn st-btn-ghost st-btn-sm" style={{ padding: "4px 6px" }}>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 46, flexShrink: 0, borderRadius: 7, overflow: "hidden" }}>
                <Poster data={featured.poster} imageUrl={featured.r2PosterUrl} title={featured.title} type={featured.type} year={featured.year} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.01em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{featured.title}</div>
                <div style={{ ...row(8), marginTop: 5 }}>
                  <span style={{ ...row(4), fontSize: 11.5, color: C.textMuted }}>
                    <Eye size={11} /> {featured.views == null ? "—" : fmt(featured.views)}
                  </span>
                  {featured.rating != null && <span>{featured.rating.toFixed(1)} ★</span>}
                </div>
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
          <div className={styles.dashboardTableHead} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 1fr 1fr",
            gap: "0 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.1em", color: C.textFaint,
            padding: "0 8px 10px", borderBottom: `1px solid ${C.border1}` }}>
            <span>Título</span><span>Género</span><span>Vistas</span><span>Fecha</span><span>Estado</span>
          </div>
          {sortedTitles.length === 0 && <p style={{ color: C.textSec, fontSize: 13 }}>Todavía no has subido ningún título.</p>}
          {sortedTitles.slice(0, 6).map(t => (
            <div key={t.id} className={styles.dashboardTableRow}
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
              <span data-label="Género" style={{ fontSize: 12.5, color: C.textMuted }}>{t.genre}</span>
              <span data-label="Visualizaciones" style={{ fontSize: 13, fontWeight: 700 }}>{t.views ? fmt(t.views) : "—"}</span>
              <span data-label="Fecha" style={{ fontSize: 12, color: C.textMuted }}>{t.publishDate ?? String(t.year)}</span>
              <div data-label="Estado"><StatusBadge status={t.status} /></div>
            </div>
          ))}
        </div>

        {/* checklist — verificación (2 filas) */}
        <div style={{ gridArea: "checklist", ...card({ padding: "18px 20px" }) }}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Verificación</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textSec }}>El estado de verificación todavía no está disponible.</p>
        </div>
      </div>
    </div>
  );
}
