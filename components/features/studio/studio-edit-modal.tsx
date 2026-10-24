"use client";

import styles from "./studio-responsive.module.css";

import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { useState, useEffect } from "react";
import { Xmark as X, Check, WarningTriangle as AlertTriangle } from "@/components/ui/icons";
import { C, row, StatusBadge, Poster, useStudioDialog } from "./studio-ui";
import type { StudioTitle } from "./studio-types";
import { editLanguageOptions, editProblem, editYearOptions, type TitleEditForm } from "@/lib/studio/title-edit";

interface Props {
  title: StudioTitle | null;
  onClose: () => void;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  /** Guarda en el servidor; `true` si se guardó (entonces se cierra). */
  onSave: (t: StudioTitle, form: TitleEditForm) => Promise<boolean>;
}

type FormState = { -readonly [K in keyof TitleEditForm]: string };

/**
 * Sin «Género»: en la base de datos ese campo es el tipo de obra (Película/Cortometraje) y el servidor trata el género como
 * colecciones del catálogo, que este formulario no conoce. Enseñarlo haría que guardar lo cambiara sin querer.
 */
export function EditModal({ title: t, onClose, onToast, onSave }: Props) {
  const viewportBounds = useVisibleViewport(Boolean(t));
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useStudioDialog(Boolean(t && form), onClose);

  useEffect(() => {
    if (t) setForm({ title: t.title, description: t.description, language: t.language, year: String(t.year) });
  }, [t]);

  if (!t || !form) return null;
  const set = <K extends keyof FormState>(k: K, v: string) => setForm(f => f ? { ...f, [k]: v } : f);
  const save = async () => {
    const problem = editProblem(form);
    if (problem) { onToast(problem, { error: true }); return; }
    setSaving(true);
    const saved = await onSave(t, form);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} style={{ position: "fixed", inset: 0, ...viewportBounds, zIndex: 150, display: "grid", placeItems: "center",
      padding: 20, background: "color-mix(in srgb, var(--gma-bg) 66%, transparent)", backdropFilter: "blur(4px)", animation: "fadeIn 0.16s ease" }}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label="Editar metadatos" onClick={e => e.stopPropagation()} style={{ width: "min(620px, 96vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--gma-surface-2)", border: `1px solid ${C.border2}`, borderRadius: 18,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)", animation: "dropIn 0.18s ease both" }}>
        {/* Header */}
        <div className={styles.modalHeader} style={{ ...row(), justifyContent: "space-between", padding: "20px 24px",
          borderBottom: `1px solid ${C.border1}` }}>
          <div style={row(12)}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Editar metadatos</h2>
            <StatusBadge status={t.status} size="sm" />
          </div>
          <button type="button" aria-label="Cerrar edición de título" className="st-btn st-btn-ghost st-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className={styles.modalBody} style={{ padding: 24, display: "grid", gridTemplateColumns: "110px 1fr", gap: 22 }}>
          <div><Poster data={t.poster} title={form.title} type={t.type} year={form.year} /></div>
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
            <div className={styles.fields3} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                  display: "block", marginBottom: 8, color: C.textFaint }}>Idioma</label>
                <select className="st-select" value={form.language} onChange={e => set("language", e.target.value)}>
                  {!form.language && <option value="">—</option>}
                  {editLanguageOptions(t.language).map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                  display: "block", marginBottom: 8, color: C.textFaint }}>Año</label>
                <select className="st-select" value={form.year} onChange={e => set("year", e.target.value)}>
                  {editYearOptions(String(t.year)).map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {t.status === "rechazado" && (
          <div style={{ margin: "0 24px 4px", padding: 14, borderRadius: 12,
            background: "rgba(255,82,82,0.06)", border: "1px solid rgba(255,82,82,0.25)" }}>
            <div style={{ ...row(8), color: C.errorFg, fontWeight: 700, fontSize: 12.5, marginBottom: 5 }}>
              <AlertTriangle size={14} /> Motivo del rechazo
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#e8b9b9" }}>{t.rejectReason}</p>
          </div>
        )}

        {/* Footer */}
        <div className={styles.modalFooter} style={{ ...row(), justifyContent: "flex-end", gap: 10, padding: "18px 24px",
          borderTop: `1px solid ${C.border1}` }}>
          <button className="st-btn st-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="st-btn st-btn-accent" disabled={saving} aria-busy={saving} onClick={() => void save()}>
            <Check size={16} strokeWidth={2.2} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
