"use client";

import { Eye, Clock, Star, Heart, TrendingUp, MessageSquare } from "lucide-react";
import { fmt, fmtFull, C, card, row, col, Stars, Poster } from "./studio-ui";
import type { StudioData, StudioTitle } from "./studio-types";

interface Props {
  data: StudioData;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  focusTitle?: StudioTitle | null;
}

function BarChart({ data, height = 180 }: { data: { m: string; v: number }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.v));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, padding: "0 2px" }}>
      {data.map((d) => {
        const h = (d.v / max) * 100;
        const peak = d.v === max;
        return (
          <div key={d.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: peak ? C.accentH : C.textFaint }}>{fmt(d.v)}</span>
            <div style={{ width: "100%", maxWidth: 30, height: `${h}%`, borderRadius: "6px 6px 3px 3px",
              background: peak ? `linear-gradient(180deg, ${C.accentH}, ${C.accent})` : "linear-gradient(180deg, #1f3a4d, rgba(22,41,54,0.3))",
              border: `1px solid ${peak ? C.accent30 : C.border2}`, transition: "all 0.2s ease" }} />
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textFaint }}>{d.m}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsView({ data, onToast }: Props) {
  const published = data.titles.filter(t => t.status === "publicado").sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const totalViews = data.creator.stats.totalViews;
  const maxViews = Math.max(...published.map(t => t.views ?? 0));

  const kpis = [
    { icon: <Eye size={16} />, label: "Visualizaciones totales", value: fmtFull(totalViews), trend: "+18% vs. trim. anterior" },
    { icon: <Clock size={16} />, label: "Tiempo de visión", value: "9.420 h", trend: "media 71% completado" },
    { icon: <Star size={16} />, label: "Valoración media", value: data.creator.stats.avgRating.toFixed(1), trend: `${fmt(3199)} valoraciones` },
    { icon: <Heart size={16} />, label: "Nuevos seguidores", value: "+1.204", trend: "este trimestre" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 10 }}>Mi Estudio</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Estadísticas</h1>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>Rendimiento de tu catálogo en los últimos 12 meses.</p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
        {kpis.map(k => (
          <div key={k.label} style={card({ padding: "18px 20px" })}>
            <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9,
              background: C.accent10, border: `1px solid ${C.accent30}`, color: C.accentH }}>{k.icon}</span>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 14, letterSpacing: "-0.02em" }}>{k.value}</div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginTop: 7 }}>{k.label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accentH, marginTop: 7 }}>{k.trend}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 22, marginBottom: 22 }}>
        <div style={card({ padding: "22px 24px" })}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Visualizaciones por mes</h2>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: C.textMuted }}>Pico en febrero — estreno de «Marea baja»</div>
            </div>
            <span style={{ ...row(5), padding: "5px 11px", borderRadius: 999, background: C.accent10,
              border: `1px solid ${C.accent30}`, color: C.accentH, fontSize: 12, fontWeight: 700 }}>
              <TrendingUp size={13} /> +18%
            </span>
          </div>
          <BarChart data={data.viewsTrend} />
        </div>

        <div style={card({ padding: "22px 24px" })}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Distribución de valoraciones</h2>
          <div style={{ ...row(12), alignItems: "flex-end", margin: "14px 0 18px" }}>
            <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" }}>{data.creator.stats.avgRating.toFixed(1)}</span>
            <div style={{ paddingBottom: 6 }}>
              <Stars value={data.creator.stats.avgRating} size={15} />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 5, color: C.textMuted }}>{fmt(3199)} valoraciones</div>
            </div>
          </div>
          <div style={col(9)}>
            {data.ratingBreakdown.map(r => (
              <div key={r.stars} style={row(10)}>
                <span style={{ ...row(3), width: 30, fontSize: 12, fontWeight: 700, color: C.textSec }}>
                  {r.stars}<Star size={11} fill={C.gold} strokeWidth={0} color={C.gold} />
                </span>
                <div style={{ flex: 1, height: 7, borderRadius: 999, background: C.w8, overflow: "hidden" }}>
                  <div style={{ width: `${r.pct}%`, height: "100%", borderRadius: 999,
                    background: `linear-gradient(90deg, ${C.accent}, ${C.accentH})` }} />
                </div>
                <span style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-title bars */}
      <div style={card({ padding: "22px 24px", marginBottom: 22 })}>
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 700 }}>Visualizaciones por título</h2>
        <div style={col(16)}>
          {published.map(t => (
            <div key={t.id} style={row(16)}>
              <div style={{ width: 38, flexShrink: 0 }}><Poster data={t.poster} title="" rounded={6} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...row(), justifyContent: "space-between", marginBottom: 7, gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                  <span style={row(12)}>
                    <Stars value={t.rating ?? 0} size={11} showNum />
                    <span style={{ fontSize: 13.5, fontWeight: 800, width: 64, textAlign: "right" }}>{fmtFull(t.views)}</span>
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: C.w8, overflow: "hidden" }}>
                  <div style={{ width: `${((t.views ?? 0) / maxViews) * 100}%`, height: "100%", borderRadius: 999,
                    background: `linear-gradient(90deg, ${C.accent}, ${C.accentH})` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent comments */}
      <div style={card({ padding: "22px 24px" })}>
        <div style={{ ...row(), justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Comentarios recientes</h2>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>{data.recentComments.length} nuevos</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {data.recentComments.map(c => (
            <div key={c.id} style={card({ padding: 16, background: C.w4 })}>
              <div style={{ ...row(), justifyContent: "space-between", marginBottom: 8 }}>
                <div style={row(10)}>
                  <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 999,
                    fontSize: 12, fontWeight: 800, background: "#131920", border: `1px solid ${C.border2}`, color: C.textSec }}>
                    {c.user.replace("@", "")[0]!.toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.user}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{c.title} · {c.date}</div>
                  </div>
                </div>
                <Stars value={c.rating} size={11} />
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: C.textSec }}>{`"${c.text}"`}</p>
              <div style={row(8)}>
                <button className="st-btn st-btn-secondary st-btn-sm" onClick={() => onToast("Respuesta enviada")}>
                  <MessageSquare size={13} /> Responder
                </button>
                <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => onToast("Gracias enviado al espectador")}>
                  <Heart size={13} /> Agradecer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
