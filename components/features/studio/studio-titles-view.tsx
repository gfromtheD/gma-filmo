"use client";

import { useState } from "react";
import {
  Plus, Search, Eye, EyeOff, Pencil, Trash2, MoreHorizontal,
  RefreshCw, BarChart2, X, Clock, AlertTriangle, Upload, LayoutGrid, List, CheckCircle2,
} from "lucide-react";
import { fmt, fmtFull, C, card, row, col, StatusBadge, Stars, Poster, Menu, type MenuItem } from "./studio-ui";
import type { StudioData, StudioTitle, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onNav: (id: StudioTabId, payload?: StudioTitle) => void;
  onEditTitle: (t: StudioTitle) => void;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  openTitle: StudioTitle | null;
  setOpenTitle: (t: StudioTitle | null) => void;
}

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "publicado", label: "Publicados" },
  { id: "revision", label: "En revisión" },
  { id: "borrador", label: "Borradores" },
  { id: "rechazado", label: "Rechazados" },
];

function actionsFor(t: StudioTitle, handlers: {
  onStats: (t: StudioTitle) => void;
  onEdit: (t: StudioTitle) => void;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  onOpen: (t: StudioTitle) => void;
}): MenuItem[] {
  const base: MenuItem[] = [{ label: "Ver detalles", icon: <Eye size={16} />, onClick: () => handlers.onOpen(t) }];
  if (t.status === "publicado") return [
    ...base,
    { label: "Editar metadatos", icon: <Pencil size={16} />, onClick: () => handlers.onEdit(t) },
    { label: "Ver estadísticas", icon: <BarChart2 size={16} />, onClick: () => handlers.onStats(t) },
    { divider: true },
    { label: "Despublicar", icon: <EyeOff size={16} />, onClick: () => handlers.onToast(`«${t.title}» se ha despublicado`) },
    { label: "Eliminar", icon: <Trash2 size={16} />, danger: true, onClick: () => handlers.onToast(`«${t.title}» eliminado`, { error: true }) },
  ];
  if (t.status === "borrador") return [
    { label: "Continuar edición", icon: <Pencil size={16} />, onClick: () => handlers.onEdit(t) },
    { label: "Enviar a revisión", icon: <Upload size={16} />, onClick: () => handlers.onToast(`«${t.title}» enviado a revisión`) },
    { divider: true },
    { label: "Eliminar borrador", icon: <Trash2 size={16} />, danger: true, onClick: () => handlers.onToast("Borrador eliminado", { error: true }) },
  ];
  if (t.status === "revision") return [
    ...base,
    { label: "Editar metadatos", icon: <Pencil size={16} />, onClick: () => handlers.onEdit(t) },
    { divider: true },
    { label: "Retirar de revisión", icon: <X size={16} />, onClick: () => handlers.onToast(`«${t.title}» retirado de revisión`) },
  ];
  return [
    ...base,
    { label: "Editar y reenviar", icon: <RefreshCw size={16} />, onClick: () => handlers.onEdit(t) },
    { divider: true },
    { label: "Eliminar", icon: <Trash2 size={16} />, danger: true, onClick: () => handlers.onToast(`«${t.title}» eliminado`, { error: true }) },
  ];
}

interface Handlers {
  onOpen: (t: StudioTitle) => void;
  onEdit: (t: StudioTitle) => void;
  onStats: (t: StudioTitle) => void;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
}

function GridCard({ t, handlers }: { t: StudioTitle; handlers: Handlers }) {
  return (
    <div style={card({ padding: 12, display: "flex", flexDirection: "column" })}>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={() => handlers.onOpen(t)}>
        <Poster data={t.poster} title={t.title} type={t.type} year={t.year} hover />
        <div style={{ position: "absolute", top: 9, left: 9 }}><StatusBadge status={t.status} size="sm" /></div>
      </div>
      <div style={{ ...row(), justifyContent: "space-between", alignItems: "flex-start", marginTop: 12, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: C.textMuted }}>{t.type} · {t.duration}</div>
        </div>
        <Menu align="right" trigger={
          <button className="st-btn st-btn-ghost st-btn-icon" style={{ width: 32, height: 32 }}>
            <MoreHorizontal size={18} />
          </button>
        } items={actionsFor(t, handlers)} />
      </div>
      <div className="st-sep" style={{ margin: "11px 0 10px" }} />
      {t.status === "publicado" ? (
        <div style={{ ...row(), justifyContent: "space-between" }}>
          <span style={{ ...row(5), fontSize: 12.5, fontWeight: 700, color: C.textSec }}>
            <Eye size={14} /> {fmt(t.views)}
          </span>
          <Stars value={t.rating ?? 0} size={12} showNum />
        </div>
      ) : t.status === "revision" ? (
        <div style={{ ...row(6), fontSize: 12.5, fontWeight: 600, color: "#E8B84B" }}>
          <Clock size={13} /> Enviado {t.submittedDate}
        </div>
      ) : t.status === "borrador" ? (
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ color: C.textMuted }}>{t.lastEdited}</span>
            <span style={{ color: C.textSec }}>{t.completeness}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: C.w8, overflow: "hidden" }}>
            <div style={{ width: `${t.completeness}%`, height: "100%", background: C.accent, borderRadius: 999 }} />
          </div>
        </div>
      ) : (
        <div style={{ ...row(6), fontSize: 12.5, fontWeight: 600, color: C.errorFg }}>
          <AlertTriangle size={13} /> Rechazado {t.rejectedDate}
        </div>
      )}
    </div>
  );
}

function ListRow({ t, handlers }: { t: StudioTitle; handlers: Handlers }) {
  return (
    <div style={card({ padding: 12, display: "grid",
      gridTemplateColumns: "52px 2.4fr 1fr 1.1fr 0.9fr 40px", gap: 16, alignItems: "center" })}>
      <div style={{ width: 52, cursor: "pointer" }} onClick={() => handlers.onOpen(t)}>
        <Poster data={t.poster} title={t.title} rounded={7} />
      </div>
      <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => handlers.onOpen(t)}>
        <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 3, color: C.textMuted }}>{t.type} · {t.genre} · {t.duration} · {t.year}</div>
      </div>
      <div><StatusBadge status={t.status} size="sm" /></div>
      <div>
        {t.status === "publicado"
          ? <span style={{ ...row(5), fontSize: 13.5, fontWeight: 700 }}><Eye size={14} color={C.textMuted} /> {fmtFull(t.views)}</span>
          : <span style={{ fontSize: 13, color: C.textMuted }}>—</span>}
      </div>
      <div>{t.status === "publicado" ? <Stars value={t.rating ?? 0} size={12} showNum /> : <span style={{ fontSize: 13, color: C.textMuted }}>—</span>}</div>
      <Menu align="right" trigger={
        <button className="st-btn st-btn-ghost st-btn-icon" style={{ width: 34, height: 34 }}>
          <MoreHorizontal size={18} />
        </button>
      } items={actionsFor(t, handlers)} />
    </div>
  );
}

function Drawer({ t, onClose, onEdit, onStats }: {
  t: StudioTitle | null; onClose: () => void;
  onEdit: (t: StudioTitle) => void; onStats: (t: StudioTitle) => void;
}) {
  if (!t) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end",
      background: "rgba(3,6,11,0.62)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(460px, 94vw)", height: "100%", overflowY: "auto",
        background: "#0b0f15", borderLeft: `1px solid ${C.border2}`, animation: "drawerIn 0.32s ease" }}>
        <div style={{ padding: 22 }}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 18 }}>
            <StatusBadge status={t.status} />
            <button className="st-btn st-btn-ghost st-btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
          <div style={{ width: 150, marginBottom: 18 }}><Poster data={t.poster} title={t.title} type={t.type} year={t.year} /></div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>{t.title}</h2>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>{t.type} · {t.genre} · {t.duration} · {t.year}</div>
          <p style={{ marginTop: 14, fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>{t.description}</p>

          {t.status === "rechazado" && (
            <div style={card({ marginTop: 16, padding: 15, borderColor: "rgba(255,82,82,0.3)", background: "rgba(255,82,82,0.06)" })}>
              <div style={{ ...row(8), color: C.errorFg, fontWeight: 700, fontSize: 13, marginBottom: 7 }}>
                <AlertTriangle size={15} /> Motivo del rechazo
              </div>
              <p style={{ margin: 0, color: "#e8b9b9", fontSize: 13 }}>{t.rejectReason}</p>
            </div>
          )}
          {t.status === "revision" && (
            <div style={card({ marginTop: 16, padding: 15, borderColor: "rgba(232,184,75,0.3)", background: "rgba(232,184,75,0.05)" })}>
              <div style={{ ...row(8), color: "#E8B84B", fontWeight: 700, fontSize: 13 }}>
                <Clock size={15} /> En revisión desde {t.submittedDate}
              </div>
              <p style={{ margin: "7px 0 0", fontSize: 13, color: C.textSec }}>Respuesta estimada en {t.reviewEta}. Te avisaremos por correo.</p>
            </div>
          )}
          {t.status === "publicado" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 18 }}>
              {([["Vistas", fmtFull(t.views), <Eye size={15} key="e" color={C.accentH} />],
                ["Valoración", (t.rating ?? 0).toFixed(1), <CheckCircle2 size={15} key="s" color={C.accentH} />],
                ["Comentarios", t.comments ?? 0, <X size={15} key="m" color={C.accentH} />]] as [string, string | number, React.ReactNode][]).map(([l, v, ic]) => (
                <div key={l} style={card({ padding: "13px 12px" })}>
                  {ic}
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>{v}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          <div className="st-sep" style={{ margin: "20px 0" }} />
          <div style={col(11)}>
            {([["Idioma", t.language], ["Subtítulos", t.subtitles.length ? t.subtitles.join(", ") : "Ninguno"],
              ["Publicado", t.publishDate ?? "—"]] as [string, string][]).map(([l, v]) => (
              <div key={l} style={{ ...row(), justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>{l}</span>
                <span style={{ fontSize: 13, color: "#fff" }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ ...row(10), marginTop: 22 }}>
            {t.status === "publicado" && (
              <button className="st-btn st-btn-secondary" style={{ flex: 1, justifyContent: "center" }}
                onClick={() => { onStats(t); onClose(); }}>
                <BarChart2 size={16} /> Estadísticas
              </button>
            )}
            <button className="st-btn st-btn-accent" style={{ flex: 1, justifyContent: "center" }}
              onClick={() => { onEdit(t); onClose(); }}>
              {t.status === "rechazado" ? <><RefreshCw size={16} /> Editar y reenviar</> : <><Pencil size={16} /> Editar metadatos</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TitlesView({ data, onNav, onEditTitle, onToast, openTitle, setOpenTitle }: Props) {
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [layout, setLayout] = useState<"grid" | "lista">("grid");

  const counts = data.titles.reduce<Record<string, number>>((a, t) => {
    a[t.status] = (a[t.status] ?? 0) + 1;
    return a;
  }, {});

  let list = data.titles.filter(t => filter === "todos" || t.status === filter);
  if (q.trim()) list = list.filter(t => t.title.toLowerCase().includes(q.toLowerCase()));

  const handlers: Handlers = {
    onOpen: (t: StudioTitle) => setOpenTitle(t),
    onEdit: onEditTitle,
    onStats: (t: StudioTitle) => onNav("estadisticas", t),
    onToast,
  };

  return (
    <div>
      <div style={{ ...row(), justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16, display: "flex" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 10 }}>Mi Estudio</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Mis títulos</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: C.textSec }}>
            {data.titles.length} obras · {counts["publicado"] ?? 0} publicadas, {counts["revision"] ?? 0} en revisión.
          </p>
        </div>
        <button className="st-btn st-btn-accent" onClick={() => onNav("subir")}>
          <Plus size={17} strokeWidth={2.2} /> Subir contenido
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ ...row(), justifyContent: "space-between", marginBottom: 20, gap: 14, flexWrap: "wrap", display: "flex" }}>
        <div style={{ ...row(8), flexWrap: "wrap" }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            const count = f.id === "todos" ? data.titles.length : (counts[f.id] ?? 0);
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, border: `1px solid ${active ? C.accent30 : C.border2}`,
                background: active ? C.accent15 : C.w4,
                color: active ? C.accentH : C.textSec,
                transition: "all 0.16s ease",
              }}>
                {f.label} <span style={{ opacity: 0.6, marginLeft: 2 }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={row(10)}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint }} />
            <input className="st-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar título…"
              style={{ width: 200, paddingLeft: 36 }} />
          </div>
          <div style={{ ...row(4), background: C.w4, border: `1px solid ${C.border2}`, borderRadius: 8, padding: 3 }}>
            <button className="st-btn st-btn-ghost" onClick={() => setLayout("grid")}
              style={{ width: 30, height: 30, padding: 0, borderRadius: 6, display: "grid", placeItems: "center",
                background: layout === "grid" ? C.w8 : "transparent", color: layout === "grid" ? "#fff" : C.textMuted }}>
              <LayoutGrid size={15} />
            </button>
            <button className="st-btn st-btn-ghost" onClick={() => setLayout("lista")}
              style={{ width: 30, height: 30, padding: 0, borderRadius: 6, display: "grid", placeItems: "center",
                background: layout === "lista" ? C.w8 : "transparent", color: layout === "lista" ? "#fff" : C.textMuted }}>
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div style={card({ padding: "60px 20px", textAlign: "center" })}>
          <div style={{ color: C.textFaint, margin: "0 auto 14px", display: "flex", justifyContent: "center" }}>
            <Search size={36} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nada por aquí</div>
          <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 6, color: C.textMuted }}>No hay títulos que coincidan con este filtro.</p>
        </div>
      ) : layout === "lista" ? (
        <div style={col(10)}>
          <div style={{ display: "grid", gridTemplateColumns: "52px 2.4fr 1fr 1.1fr 0.9fr 40px", gap: 16, padding: "0 12px" }}>
            {["", "Título", "Estado", "Vistas", "Valoración", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>{h}</div>
            ))}
          </div>
          {list.map(t => <ListRow key={t.id} t={t} handlers={handlers} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))", gap: 18 }}>
          {list.map(t => <GridCard key={t.id} t={t} handlers={handlers} />)}
        </div>
      )}

      <Drawer t={openTitle} onClose={() => setOpenTitle(null)} onEdit={onEditTitle}
        onStats={(t) => onNav("estadisticas", t)} />
    </div>
  );
}

