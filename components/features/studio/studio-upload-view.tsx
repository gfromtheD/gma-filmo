"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Film, Check, ChevronRight, Plus, Trash2, RefreshCw, Play, Info, CheckCircle2 } from "lucide-react";
import { C, card, row, col, Poster } from "./studio-ui";
import type { StudioData, PosterData, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  onNav: (id: StudioTabId) => void;
}

const STEPS = ["Archivo", "Detalles", "Vista previa"];

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ ...row(), justifyContent: "space-between", marginBottom: 8, display: "flex" }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: C.textFaint }}>
          {label}{required && <span style={{ color: C.accentH }}> *</span>}
        </span>
        {hint && <span style={{ fontSize: 11, fontWeight: 600, color: C.textFaint }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
      fontSize: 12.5, fontWeight: 700, transition: "all 0.15s ease",
      border: `1px solid ${active ? C.accent30 : C.border2}`,
      background: active ? C.accent15 : C.w4,
      color: active ? C.accentH : C.textSec,
    }}>{label}</button>
  );
}

interface FormState {
  title: string; description: string; genre: string; year: string;
  duration: string; language: string; subtitles: string[]; poster: PosterData; trailer: boolean;
}

export function UploadView({ data, onToast, onNav }: Props) {
  const [step, setStep]       = useState(0);
  const [file, setFile]       = useState<{ name: string; size: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const posterChoices = [
    data.posters["marea"]!, data.posters["tren"]!, data.posters["carto"]!,
    data.posters["hab204"]!, data.posters["piel"]!, data.posters["dias"]!,
  ].filter(Boolean);

  const [form, setForm] = useState<FormState>({
    title: "", description: "", genre: "Drama", year: "2026",
    duration: "", language: "Español", subtitles: [], poster: data.posters["nieve"]!,
    trailer: false,
  });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const startUpload = (name: string, size: string) => {
    setFile({ name, size });
    setProgress(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { if (timer.current) clearInterval(timer.current); return 100; }
        return Math.min(100, p + Math.random() * 14 + 4);
      });
    }, 320);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const canNext = step === 0 ? (!!file && progress >= 100) : step === 1 ? (!!form.title.trim() && !!form.duration.trim()) : true;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 10 }}>Mi Estudio</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Subir contenido</h1>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: C.textSec }}>Sube tu corto o película, completa la ficha y revísala antes de publicar.</p>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", gap: 0, marginBottom: 26, alignItems: "center" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? "0 0 auto" : "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                fontSize: 13, fontWeight: 800, transition: "all 0.2s ease",
                background: i < step ? C.accent : i === step ? C.accent15 : C.w4,
                border: `1px solid ${i <= step ? C.accent30 : C.border2}`,
                color: i < step ? C.onAccent : i === step ? C.accentH : C.textMuted }}>
                {i < step ? <Check size={15} strokeWidth={2.6} /> : i + 1}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: i <= step ? "#fff" : C.textMuted }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, margin: "0 16px", minWidth: 40,
                background: i < step ? C.accent30 : C.border1 }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: file */}
      {step === 0 && (
        <div>
          {!file ? (
            <div
              onClick={() => startUpload("marea_alta_master_v3.mov", "1.84 GB")}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); startUpload("marea_alta_master_v3.mov", "1.84 GB"); }}
              style={{ border: `1.5px dashed ${dragOver ? C.accent : C.border2}`, borderRadius: 16, padding: "56px 24px",
                textAlign: "center", cursor: "pointer", background: dragOver ? C.accent10 : C.w4,
                transition: "all 0.18s ease" }}>
              <span style={{ display: "grid", placeItems: "center", width: 64, height: 64, borderRadius: 18, margin: "0 auto 18px",
                background: C.accent10, border: `1px solid ${C.accent30}`, color: C.accentH }}>
                <Upload size={28} />
              </span>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Arrastra tu vídeo aquí</div>
              <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 7, color: C.textMuted }}>o haz clic para seleccionar un archivo</p>
              <div style={{ ...row(8), justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
                {["MP4", "MOV", "ProRes", "máx. 8 GB", "hasta 4K"].map(x => (
                  <span key={x} style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                    border: `1px solid ${C.border1}`, color: C.textFaint }}>{x}</span>
                ))}
              </div>
            </div>
          ) : (
            <div style={card({ padding: 22 })}>
              <div style={row(14)}>
                <span style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 11, flexShrink: 0,
                  background: "#131920", border: `1px solid ${C.border2}`, color: C.accentH }}>
                  <Film size={22} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...row(), justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>{file.size}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: C.w8, overflow: "hidden", marginTop: 11 }}>
                    <div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, transition: "width 0.3s ease",
                      background: progress >= 100 ? C.accent : `linear-gradient(90deg, ${C.accent}, ${C.accentH})` }} />
                  </div>
                  <div style={{ ...row(), justifyContent: "space-between", marginTop: 9 }}>
                    <span style={{ ...row(6), fontSize: 12.5, fontWeight: 700,
                      color: progress >= 100 ? C.accentH : C.textSec }}>
                      {progress >= 100
                        ? <><CheckCircle2 size={14} strokeWidth={2.2} /> Subida completa · listo para procesar</>
                        : <><span className="studio-spin"><RefreshCw size={13} /></span> Subiendo… {Math.round(progress)}%</>}
                    </span>
                    <button className="st-btn st-btn-ghost st-btn-sm st-btn-danger"
                      onClick={() => { if (timer.current) clearInterval(timer.current); setFile(null); setProgress(0); }}>
                      <Trash2 size={14} /> Quitar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: details */}
      {step === 1 && (
        <div style={col(20)}>
          <Field label="Título" required>
            <input className="st-input" value={form.title} onChange={e => set("title", e.target.value)} placeholder="p. ej. Marea alta" />
          </Field>
          <Field label="Descripción / sinopsis">
            <textarea className="st-textarea" value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Cuenta de qué va tu película en un par de frases…" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Duración" required>
              <input className="st-input" value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="14 min" />
            </Field>
            <Field label="Año">
              <select className="st-select" value={form.year} onChange={e => set("year", e.target.value)}>
                {["2026","2025","2024","2023","2022","2021"].map(y => <option key={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="Idioma">
              <select className="st-select" value={form.language} onChange={e => set("language", e.target.value)}>
                {data.languages.map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Género">
            <div style={{ ...row(8), flexWrap: "wrap" }}>
              {data.genres.map(g => <Chip key={g} label={g} active={form.genre === g} onClick={() => set("genre", g)} />)}
            </div>
          </Field>
          <Field label="Subtítulos" hint="opcional — selecciona los disponibles">
            <div style={{ ...row(8), flexWrap: "wrap" }}>
              {["Español","Inglés","Francés","Gallego","Portugués"].map(l => {
                const on = form.subtitles.includes(l);
                return <Chip key={l} label={l} active={on} onClick={() => set("subtitles", on ? form.subtitles.filter(x => x !== l) : [...form.subtitles, l])} />;
              })}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
            <Field label="Póster / thumbnail" hint="elige un diseño">
              <div style={{ ...row(10), flexWrap: "wrap" }}>
                {posterChoices.map((p, i) => (
                  <button key={i} type="button" onClick={() => set("poster", p)}
                    style={{ width: 58, borderRadius: 9, padding: 0, border: `2px solid ${form.poster === p ? C.accent : "transparent"}`,
                      background: "none", cursor: "pointer" }}>
                    <Poster data={p} title="" rounded={6} />
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Tráiler" hint="opcional">
              <button type="button" onClick={() => set("trailer", !form.trailer)}
                style={card({ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  borderColor: form.trailer ? C.accent30 : C.border1, background: form.trailer ? C.accent10 : C.w4 })}>
                {form.trailer
                  ? <CheckCircle2 size={18} color={C.accentH} strokeWidth={2} />
                  : <Plus size={18} color={C.textMuted} strokeWidth={2} />}
                <span style={{ fontSize: 13.5, fontWeight: 700, color: form.trailer ? "#fff" : C.textSec }}>
                  {form.trailer ? "trailer_marea.mp4 añadido" : "Añadir tráiler"}
                </span>
              </button>
            </Field>
          </div>
        </div>
      )}

      {/* Step 2: preview */}
      {step === 2 && (
        <div>
          <div style={card({ padding: 24, display: "grid", gridTemplateColumns: "190px 1fr", gap: 26 })}>
            <div>
              <Poster data={form.poster} title={form.title || "Sin título"} type={form.genre} year={form.year} />
              <button className="st-btn st-btn-secondary st-btn-sm" style={{ width: "100%", marginTop: 12, justifyContent: "center" }}>
                <Play size={14} /> Previsualizar vídeo
              </button>
            </div>
            <div>
              <div style={{ ...row(5), padding: "5px 11px", borderRadius: 999, background: C.accent10,
                border: `1px solid ${C.accent30}`, color: C.accentH, fontSize: 12, fontWeight: 700,
                display: "inline-flex", marginBottom: 12 }}>
                Así se verá en GMA Filmo
              </div>
              <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700 }}>{form.title || "Sin título"}</h2>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textMuted }}>{form.genre} · {form.duration || "—"} · {form.year} · {form.language}</div>
              <p style={{ marginTop: 14, fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
                {form.description || "Sin descripción. Vuelve al paso anterior para añadir una sinopsis."}
              </p>
              <div className="st-sep" style={{ margin: "18px 0" }} />
              <div style={col(10)}>
                {([["Subtítulos", form.subtitles.length ? form.subtitles.join(", ") : "Ninguno"],
                  ["Tráiler", form.trailer ? "Incluido" : "No incluido"],
                  ["Archivo", file ? file.name : "—"]] as [string, string][]).map(([l, v]) => (
                  <div key={l} style={{ ...row(), justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>{l}</span>
                    <span style={{ fontSize: 13, color: "#fff" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={card({ marginTop: 16, padding: "15px 18px", display: "flex", gap: 12, alignItems: "center",
            background: C.accent10, borderColor: C.accent30 })}>
            <Info size={18} color={C.accentH} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: C.textSec }}>
              Al publicar, tu título entra en <strong style={{ color: "#fff" }}>revisión</strong> (1–3 días). Recibirás un aviso cuando esté disponible para el público.
            </p>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div style={{ ...row(), justifyContent: "space-between", marginTop: 28 }}>
        <button className="st-btn st-btn-ghost" onClick={() => step === 0 ? onNav("titulos") : setStep(step - 1)}>
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
          {step === 0 ? "Cancelar" : "Atrás"}
        </button>
        {step < 2 ? (
          <button className="st-btn st-btn-accent" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continuar <ChevronRight size={16} />
          </button>
        ) : (
          <button className="st-btn st-btn-accent"
            onClick={() => { onToast(`«${form.title || "Tu título"}» enviado a revisión`); onNav("titulos"); }}>
            <Upload size={16} /> Publicar y enviar a revisión
          </button>
        )}
      </div>
    </div>
  );
}
