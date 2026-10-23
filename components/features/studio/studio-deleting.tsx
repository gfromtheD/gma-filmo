"use client";

import { C, row, useStudioDialog } from "./studio-ui";
import { ProgressRing } from "./upload/progress-ring";
import type { StudioTitle } from "./studio-types";

/** Velo breve sobre la portada mientras la tarjeta de una obra borrada sale de la lista. */
export function DeletingVeil({ size = 52, compact = false }: { readonly size?: number; readonly compact?: boolean }) {
  return (
    <div role="status" aria-label="Eliminando del servidor" style={{
      position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 8, background: "rgba(6,12,9,0.78)", backdropFilter: "blur(2px)", borderRadius: "inherit" }}>
      <ProgressRing value={null} label="Eliminando del servidor" size={size} stroke={compact ? 2 : 3} />
      {!compact && <span style={{ fontSize: 12, fontWeight: 700, color: "#DDE6E0", textAlign: "center", padding: "0 8px" }}>Eliminando…</span>}
    </div>
  );
}

export function DeleteTitleDialog({ title, busy, onCancel, onConfirm }: {
  readonly title: StudioTitle | null; readonly busy: boolean; readonly onCancel: () => void; readonly onConfirm: () => void;
}) {
  const dialogRef = useStudioDialog(Boolean(title), busy ? () => undefined : onCancel);
  if (!title) return null;
  return (
    <div onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, zIndex: 160, display: "grid", placeItems: "center", padding: 16,
      background: "color-mix(in srgb, var(--gma-bg) 70%, transparent)", backdropFilter: "blur(4px)" }}>
      <div ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="delete-title-heading" aria-describedby="delete-title-text"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(440px, 94vw)", background: "var(--gma-surface-2)", border: `1px solid ${C.border2}`, borderRadius: 18,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)", padding: 24, animation: "dropIn 0.18s ease both" }}>
        <h2 id="delete-title-heading" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>¿Eliminar «{title.title}»?</h2>
        <p id="delete-title-text" style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: C.textSec }}>
          Se borrarán la ficha y todos sus archivos del servidor: vídeo, tráiler, imágenes y extras. No se puede deshacer.
          La obra desaparece al momento; el espacio se libera solo, en segundo plano.
        </p>
        <div style={{ ...row(10), justifyContent: "flex-end", marginTop: 22 }}>
          <button type="button" className="st-btn st-btn-ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className="st-btn" onClick={onConfirm} disabled={busy}
            style={{ background: "#C8432F", color: "#fff", fontWeight: 700 }}>
            {busy ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
