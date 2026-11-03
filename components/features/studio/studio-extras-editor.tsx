"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/api/auth-headers";
import { EXTRA_DESCRIPTION_MAX, EXTRA_TITLE_MAX } from "@/lib/extras/extras";
import { moveItem } from "@/lib/studio/extras-order";
import type { ManageableExtra } from "@/lib/media/engine-extras";
import { C, row } from "./studio-ui";

interface Props {
  readonly titleId: number;
  readonly onToast: (msg: string, opts?: { error?: boolean }) => void;
}

const ROLE_NAME: Record<ManageableExtra["role"], string> = { trailer: "Tráiler", extras: "Vídeo", extra_image: "Imagen" };
const LABEL_STYLE = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint } as const;

/** Nombre, descripción, orden y visibilidad de los extras ya subidos de una obra. No aparece si la obra no tiene extras. */
export function StudioExtrasEditor({ titleId, onToast }: Props) {
  const [items, setItems] = useState<ManageableExtra[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/creator/extras?titleId=${titleId}`, { headers: await authHeaders() });
        const body = (await res.json()) as { ok?: boolean; extras?: ManageableExtra[] };
        if (!cancelled) setItems(res.ok && body.ok ? (body.extras ?? []) : []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [titleId]);

  if (!items || items.length === 0) return null;

  const patch = (index: number, changes: Partial<ManageableExtra>) =>
    setItems((list) => list?.map((item, i) => (i === index ? { ...item, ...changes } : item)) ?? list);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/creator/extras", {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ titleId, items: items.map(({ assetId, label, description, hidden }) => ({ assetId, label, description, hidden })) }),
      });
      onToast(res.ok ? "Extras guardados" : "No se pudieron guardar los extras", res.ok ? undefined : { error: true });
    } catch {
      onToast("No se pudieron guardar los extras", { error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Extras de la obra" style={{ margin: "0 24px 20px", paddingTop: 18, borderTop: `1px solid ${C.border1}` }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>Extras</h3>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: C.textFaint }}>
        Ponles nombre, cámbiales el orden o escóndelos. El tráiler siempre va primero.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {items.map((item, index) => {
          const isTrailer = item.role === "trailer";
          return (
            <li key={item.assetId} style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border1}`, opacity: item.hidden ? 0.6 : 1, display: "grid", gap: 8 }}>
              <div style={{ ...row(8), justifyContent: "space-between" }}>
                <span style={LABEL_STYLE}>{ROLE_NAME[item.role]}{item.hidden ? " · oculto" : ""}</span>
                <span style={row(6)}>
                  <button type="button" className="st-btn st-btn-ghost" aria-label={`Subir ${item.label}`}
                    disabled={isTrailer || index === 0 || items[index - 1]?.role === "trailer"}
                    onClick={() => setItems((list) => (list ? moveItem(list, index, -1) : list))}>↑</button>
                  <button type="button" className="st-btn st-btn-ghost" aria-label={`Bajar ${item.label}`}
                    disabled={isTrailer || index === items.length - 1}
                    onClick={() => setItems((list) => (list ? moveItem(list, index, 1) : list))}>↓</button>
                  <button type="button" className="st-btn st-btn-ghost" aria-pressed={item.hidden}
                    onClick={() => patch(index, { hidden: !item.hidden })}>{item.hidden ? "Mostrar" : "Ocultar"}</button>
                </span>
              </div>
              <input className="st-input" aria-label={`Nombre de ${ROLE_NAME[item.role].toLowerCase()} ${index + 1}`} maxLength={EXTRA_TITLE_MAX}
                value={item.label} onChange={(e) => patch(index, { label: e.target.value })} />
              <textarea className="st-textarea" rows={2} aria-label={`Descripción de ${item.label}`} maxLength={EXTRA_DESCRIPTION_MAX}
                placeholder="Descripción (opcional)" value={item.description} onChange={(e) => patch(index, { description: e.target.value })} />
            </li>
          );
        })}
      </ul>
      <div style={{ ...row(), justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" className="st-btn st-btn-accent" disabled={saving} aria-busy={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar extras"}
        </button>
      </div>
    </section>
  );
}
