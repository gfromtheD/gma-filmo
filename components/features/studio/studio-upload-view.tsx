"use client";

import { useState, useEffect } from "react";
import { Upload, Check, ChevronRight, Plus, Trash2, Play, Info, CheckCircle2, Loader2, HelpCircle } from "lucide-react";
import { C, card, row, col, Poster, StudioSelect } from "./studio-ui";
import { UploadOrbital } from "./studio-upload-orbital";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudioData, PosterData, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  onNav: (id: StudioTabId) => void;
  onPublished?: () => void;
}

const STEPS = ["Archivo", "Detalles", "Vista previa"];

const DRAFT_KEY = "gma_studio_upload_draft";

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: C.textMuted, lineHeight: 1 }}
      >
        <HelpCircle size={12} />
      </button>
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          width: 230, padding: "10px 13px", borderRadius: 10, zIndex: 200, pointerEvents: "none",
          background: "#0F1923", border: `1px solid ${C.border2}`,
          boxShadow: "0 10px 32px rgba(0,0,0,0.7)",
          fontSize: 12, color: C.textSec, lineHeight: 1.55,
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            display: "block", width: 0, height: 0,
            borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
            borderTop: `5px solid ${C.border2}`,
          }} />
        </div>
      )}
    </span>
  );
}

function Field({ label, hint, required, info, children }: { label: string; hint?: string; required?: boolean; info?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ ...row(), justifyContent: "space-between", marginBottom: 8, display: "flex" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: C.textFaint }}>
          {label}{required && <span style={{ color: C.accentH }}> *</span>}
          {info && <InfoTooltip text={info} />}
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

interface MainFile {
  name: string;
  size: string;
  sizeBytes: number;
  r2Url: string;
}

export function UploadView({ data, onToast, onNav, onPublished }: Props) {
  const [step, setStep] = useState(0);
  const [mainFile, setMainFile] = useState<MainFile | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [publishing, setPublishing]       = useState(false);
  const [posterPreview, setPosterPreview] = useState<"h" | "v">("h");
  const [hasDraft, setHasDraft]           = useState(false);

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

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { step?: number; mainFile?: MainFile; assetUrls?: Record<string, string>; form?: FormState };
      if (d.mainFile)   setMainFile(d.mainFile);
      if (d.assetUrls)  setAssetUrls(d.assetUrls);
      if (d.form)       setForm(d.form);
      // If a main file exists but step was 0 (not yet advanced), jump to step 1
      const targetStep = typeof d.step === "number" ? d.step : 0;
      setStep(d.mainFile && targetStep === 0 ? 1 : targetStep);
      setHasDraft(true);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft whenever state changes (skip empty sessions)
  useEffect(() => {
    if (!mainFile && !form.title.trim()) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, mainFile, assetUrls, form }));
    } catch {}
  }, [step, mainFile, assetUrls, form]);

  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setStep(0);
    setMainFile(null);
    setAssetUrls({});
    setForm({ title: "", description: "", genre: "Drama", year: "2026", duration: "", language: "Español", subtitles: [], poster: data.posters["nieve"]!, trailer: false });
    setHasDraft(false);
  }

  const canNext = step === 0 ? !!mainFile : step === 1 ? (!!form.title.trim() && !!form.duration.trim()) : true;

  async function handlePublish() {
    if (!mainFile) return;
    setPublishing(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onToast("Tu sesión ha caducado. Por favor inicia sesión de nuevo.", { error: true });
        return;
      }

      const res = await fetch("/api/titles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title:         form.title.trim(),
          synopsis:      form.description.trim() || null,
          year:          form.year,
          duration:      form.duration.trim(),
          genre:         form.genre,
          language:      form.language,
          r2VideoUrl:    mainFile.r2Url,
          r2PosterUrl:   assetUrls["poster_h"] ?? assetUrls["poster_v"] ?? assetUrls["poster"] ?? null,
          r2SubtitleUrl: assetUrls["subtitles"] ?? null,
          fileSizeBytes: mainFile.sizeBytes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error del servidor" }));
        onToast((err as { error?: string }).error ?? "Error al publicar", { error: true });
        return;
      }

      const { title: created } = await res.json() as { title: { slug: string; title: string } };
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      onToast(`«${created.title}» publicado y disponible en el catálogo`);
      onPublished?.();
      onNav("titulos");
    } catch {
      onToast("Error inesperado al publicar. Inténtalo de nuevo.", { error: true });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 10 }}>Mi Estudio</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Subir contenido</h1>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: C.textSec }}>Sube tu corto o película, completa la ficha y revísala antes de publicar.</p>
      </div>

      {/* Draft banner */}
      {hasDraft && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderRadius: 10, marginBottom: 18,
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
        }}>
          <span style={{ fontSize: 13, color: "rgba(245,158,11,0.9)", fontWeight: 600 }}>
            Borrador restaurado — continúa desde donde lo dejaste
          </span>
          <button
            type="button"
            onClick={discardDraft}
            style={{
              background: "none", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 7,
              padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, color: "rgba(245,158,11,0.75)",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}
          >
            <Trash2 size={12} /> Descartar
          </button>
        </div>
      )}

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
        <UploadOrbital
          onMainReady={f => setMainFile(f)}
          onAssetReady={(assetType, url) => setAssetUrls(prev => ({ ...prev, [assetType]: url }))}
        />
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
              <StudioSelect value={form.year} onChange={v => set("year", v)} options={["2026","2025","2024","2023","2022","2021"]} />
            </Field>
            <Field label="Idioma">
              <StudioSelect value={form.language} onChange={v => set("language", v)} options={data.languages} />
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
            <Field
              label="Póster / thumbnail"
              hint="elige un diseño"
              info="Si tu corto o película no tiene póster o ilustración propia, pondremos uno de estos por defecto en el catálogo. Por eso te pedimos que elijas los colores y el estilo que mejor representen tu obra."
            >
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
            <Field
              label="Tráiler"
              hint="opcional"
              info="Si activas el tráiler, se reproducirá automáticamente cuando tu título aparezca en el carrusel de recomendaciones de la pantalla principal — en vez de mostrar el póster de manera estática, se reproducirá el tráiler."
            >
              <button type="button" onClick={() => set("trailer", !form.trailer)}
                style={card({ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  borderColor: form.trailer ? C.accent30 : C.border1, background: form.trailer ? C.accent10 : C.w4 })}>
                {form.trailer
                  ? <CheckCircle2 size={18} color={C.accentH} strokeWidth={2} />
                  : <Plus size={18} color={C.textMuted} strokeWidth={2} />}
                <span style={{ fontSize: 13.5, fontWeight: 700, color: form.trailer ? "#fff" : C.textSec }}>
                  {assetUrls["trailer"] ? "Tráiler subido ✓" : "Añadir tráiler"}
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
              {(() => {
                const hasBoth = !!(assetUrls["poster_h"] && assetUrls["poster_v"]);
                const activeSrc = hasBoth
                  ? (posterPreview === "h" ? assetUrls["poster_h"] : assetUrls["poster_v"])
                  : (assetUrls["poster_h"] ?? assetUrls["poster_v"] ?? assetUrls["poster"]);
                const isH = hasBoth && posterPreview === "h";
                return (
                  <>
                    {/* toggle — only when both posters are uploaded */}
                    {hasBoth && (
                      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                        {([["h", "Horizontal"], ["v", "Vertical"]] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPosterPreview(mode)}
                            style={{
                              flex: 1, padding: "5px 0", borderRadius: 7, cursor: "pointer",
                              fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                              border: `1px solid ${posterPreview === mode ? C.accent30 : C.border2}`,
                              background: posterPreview === mode ? C.accent15 : C.w4,
                              color: posterPreview === mode ? C.accentH : C.textMuted,
                              transition: "all 0.15s",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeSrc ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={activeSrc}
                          alt={form.title || "Póster"}
                          style={{
                            width: "100%", borderRadius: 10, objectFit: "cover", display: "block",
                            aspectRatio: isH ? "16/9" : "2/3",
                          }}
                        />
                        {hasBoth && (
                          <div style={{
                            position: "absolute", bottom: 8, left: 8,
                            fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em",
                            padding: "2px 7px", borderRadius: 999,
                            background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.7)",
                          }}>
                            {isH ? "CARRUSEL" : "CATÁLOGO"}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Poster data={form.poster} title={form.title || "Sin título"} type={form.genre} year={form.year} />
                    )}
                  </>
                );
              })()}
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
                {([
                  ["Subtítulos", form.subtitles.length ? form.subtitles.join(", ") : "Ninguno"],
                  ["Tráiler", assetUrls["trailer"] ? "Subido ✓" : "No incluido"],
                  ["Póster", (assetUrls["poster_h"] ?? assetUrls["poster_v"] ?? assetUrls["poster"]) ? "Imagen subida ✓" : "Diseño predeterminado"],
                  ["Archivo", mainFile?.name ?? "—"],
                  ["Tamaño", mainFile?.size ?? "—"],
                ] as [string, string][]).map(([l, v]) => (
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
              Al publicar, tu título quedará <strong style={{ color: "#fff" }}>disponible inmediatamente</strong> en el catálogo de GMA Filmo.
            </p>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div style={{ ...row(), justifyContent: "space-between", marginTop: 28 }}>
        <button className="st-btn st-btn-ghost" onClick={() => step === 0 ? onNav("titulos") : setStep(step - 1)} disabled={publishing}>
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
          {step === 0 ? "Cancelar" : "Atrás"}
        </button>
        {step < 2 ? (
          <button className="st-btn st-btn-accent" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continuar <ChevronRight size={16} />
          </button>
        ) : (
          <button className="st-btn st-btn-accent" disabled={publishing} onClick={handlePublish}>
            {publishing
              ? <><Loader2 size={16} className="studio-spin" /> Publicando…</>
              : <><Upload size={16} /> Publicar en GMA Filmo</>}
          </button>
        )}
      </div>
    </div>
  );
}
