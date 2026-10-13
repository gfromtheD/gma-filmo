"use client";

import styles from "./studio-responsive.module.css";

import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { useState, useEffect } from "react";
import { X, Check, AlertTriangle } from "lucide-react";
import { C, row, StatusBadge, Poster, useStudioDialog } from "./studio-ui";
import type { StudioData, StudioTitle } from "./studio-types";

interface Props {
  title: StudioTitle | null;
  onClose: () => void;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  data: StudioData;
}

interface FormState { title: string; description: string; genre: string; language: string; year: string; }

export function EditModal({ title: t, onClose, onToast, data }: Props) {
  const viewportBounds = useVisibleViewport(Boolean(t));
  const [form, setForm] = useState<FormState | null>(null);
  const dialogRef = useStudioDialog(Boolean(t && form), onClose);

  useEffect(() => {
    if (t) setForm({ title: t.title, description: t.description, genre: t.genre, language: t.language, year: String(t.year) });
  }, [t]);

  if (!t || !form) return null;
  const set = <K extends keyof FormState>(k: K, v: string) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className={styles.modalOverlay} onClick={onClose} style={{ position: "fixed", inset: 0, ...viewportBounds, zIndex: 150, display: "grid", placeItems: "center",
      padding: 20, background: "rgba(3,6,11,0.66)", backdropFilter: "blur(4px)", animation: "fadeIn 0.16s ease" }}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label="Editar metadatos" onClick={e => e.stopPropagation()} style={{ width: "min(620px, 96vw)", maxHeight: "90vh", overflowY: "auto",
        background: "#0b0f15", border: `1px solid ${C.border2}`, borderRadius: 18,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)", animation: "dropIn 0.18s ease both" }}>
        {/* Header */}
        <div className={styles.modalHeader} style={{ ...row(), justifyContent: "space-between", padding: "20px 24px",
          borderBottom: `1px solid ${C.border1}` }}>
          <div style={row(12)}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t.status === "rechazado" ? "Editar y reenviar" : "Editar metadatos"}</h2>
            <StatusBadge status={t.status} size="sm" />
          </div>
          <button type="button" aria-label="Cerrar edición de título" className="st-btn st-btn-ghost st-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className={styles.modalBody} style={{ padding: 24, display: "grid", gridTemplateColumns: "110px 1fr", gap: 22 }}>
          <div><Poster data={t.poster} title={form.title} type={form.genre} year={form.year} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                display: "block", marginBottom: 8, color: C.textFaint }}>Título</label>
              <input className="st-input" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                display: "block", marginBottom: 8, color: C.textFaint }}>Descripción</label>
              <textarea className="st-textarea" value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
            <div className={styles.fields3} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                  display: "block", marginBottom: 8, color: C.textFaint }}>Género</label>
                <select className="st-select" value={form.genre} onChange={e => set("genre", e.target.value)}>
                  {data.genres.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                  display: "block", marginBottom: 8, color: C.textFaint }}>Idioma</label>
                <select className="st-select" value={form.language} onChange={e => set("language", e.target.value)}>
                  {data.languages.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                  display: "block", marginBottom: 8, color: C.textFaint }}>Año</label>
                <select className="st-select" value={form.year} onChange={e => set("year", e.target.value)}>
                  {["2026","2025","2024","2023","2022"].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {t.status === "rechazado" && (
          <div style={{ margin: "0 24px 4px", padding: 14, borderRadius: 12,
            background: "rgba(255,82,82,0.06)", border: "1px solid rgba(255,82,82,0.25)" }}>
            <div style={{ ...row(8), color: C.errorFg, fontWeight: 700, fontSize: 12.5, marginBottom: 5 }}>
              <AlertTriangle size={14} /> Recuerda corregir antes de reenviar
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#e8b9b9" }}>{t.rejectReason}</p>
          </div>
        )}

        {/* Footer */}
        <div className={styles.modalFooter} style={{ ...row(), justifyContent: "flex-end", gap: 10, padding: "18px 24px",
          borderTop: `1px solid ${C.border1}` }}>
          <button className="st-btn st-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="st-btn st-btn-accent"
            onClick={() => {
              onClose();
              onToast(t.status === "rechazado"
                ? `«${form.title}» reenviado a revisión`
                : `Cambios guardados en «${form.title}»`);
            }}>
            <Check size={16} strokeWidth={2.2} />
            {t.status === "rechazado" ? "Reenviar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
