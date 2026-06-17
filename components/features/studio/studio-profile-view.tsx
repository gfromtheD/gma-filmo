"use client";

import { useState } from "react";
import { Check, Upload, Image as ImageIcon, Globe, AtSign, Video, Info, CheckCircle2 } from "lucide-react";
import { fmt, C, card, row, col, StudioLogo } from "./studio-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudioData } from "./studio-types";

interface Props {
  data: StudioData;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ ...row(), justifyContent: "space-between", marginBottom: 8, display: "flex" }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: C.textFaint }}>{label}</span>
        {hint && <span style={{ fontSize: 11, fontWeight: 600, color: C.textFaint }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SocialField({ icon, prefix, value, onChange, placeholder }: {
  icon: React.ReactNode; prefix: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div style={{ ...row(0), background: C.w4, border: `1px solid ${C.border2}`, borderRadius: 10, overflow: "hidden" }}>
      <span style={{ ...row(7), padding: "0 12px", color: C.textMuted, fontSize: 13, fontWeight: 600,
        borderRight: `1px solid ${C.border2}`, height: 42, flexShrink: 0 }}>
        {icon} {prefix}
      </span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: "0 13px" }} />
    </div>
  );
}

export function ProfileView({ data, onToast }: Props) {
  const c = data.creator;
  const [form, setForm] = useState({
    studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio,
    location: c.location, instagram: c.socials.instagram.replace("@", ""),
    vimeo: c.socials.vimeo.replace("vimeo.com/", ""), web: c.socials.web,
  });
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  async function handleSave() {
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); onToast("No se pudo guardar: sesión no encontrada", { error: true }); return; }

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        studio_name:  form.studioName.trim(),
        creator_name: form.artistName.trim(),
        bio:          form.bio.trim().slice(0, 300),
        location:     form.location.trim() || null,
        website_url:  form.web.trim() || null,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      onToast("Error al guardar el perfil", { error: true });
    } else {
      setDirty(false);
      onToast("Perfil actualizado");
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ ...row(), justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16, display: "flex" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 10 }}>Mi Estudio</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Perfil de creador</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: C.textSec }}>Así te ven los espectadores en GMA Filmo.</p>
        </div>
        <button className="st-btn st-btn-accent" disabled={!dirty || saving}
          onClick={() => void handleSave()}>
          <Check size={16} strokeWidth={2.2} /> {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Left: form */}
        <div style={col(22)}>
          {/* Identity */}
          <div style={card({ padding: 24 })}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 18 }}>Identidad del estudio</div>
            <div style={{ ...row(18), marginBottom: 22, flexWrap: "wrap", display: "flex" }}>
              <div style={{ position: "relative" }}>
                <StudioLogo colors={c.logoColors} size={78} name={form.studioName} rounded={18} />
                <button className="st-btn st-btn-secondary st-btn-icon"
                  style={{ position: "absolute", bottom: -6, right: -6, width: 30, height: 30, borderRadius: 999, background: "#101820" }}
                  onClick={() => onToast("Sube tu logo en formato PNG o SVG")}>
                  <ImageIcon size={14} />
                </button>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>Logo o foto del estudio. PNG, JPG o SVG · mín. 400×400px.</div>
                <div style={row(9)}>
                  <button className="st-btn st-btn-secondary st-btn-sm" onClick={() => onToast("Selector de archivo abierto")}>
                    <Upload size={14} /> Subir
                  </button>
                  <button className="st-btn st-btn-ghost st-btn-sm st-btn-danger" onClick={() => onToast("Logo eliminado", { error: true })}>
                    Quitar
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Nombre del estudio">
                <input className="st-input" value={form.studioName} onChange={e => set("studioName", e.target.value)} />
              </Field>
              <Field label="Nombre artístico">
                <input className="st-input" value={form.artistName} onChange={e => set("artistName", e.target.value)} />
              </Field>
              <Field label="Rol / disciplina">
                <input className="st-input" value={form.role} onChange={e => set("role", e.target.value)} />
              </Field>
              <Field label="Ubicación">
                <input className="st-input" value={form.location} onChange={e => set("location", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Bio */}
          <div style={card({ padding: 24 })}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 16 }}>Biografía</div>
            <Field label="Sobre el estudio" hint={`${form.bio.length}/280`}>
              <textarea className="st-textarea" style={{ minHeight: 120 }} maxLength={280}
                value={form.bio} onChange={e => set("bio", e.target.value)} />
            </Field>
          </div>

          {/* Socials */}
          <div style={card({ padding: 24 })}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 16 }}>
              Redes sociales <span style={{ color: C.textFaint, textTransform: "none", letterSpacing: 0 }}>· opcional</span>
            </div>
            <div style={col(13)}>
              <SocialField icon={<AtSign size={16} />} prefix="instagram.com/" value={form.instagram} onChange={v => set("instagram", v)} placeholder="usuario" />
              <SocialField icon={<Video size={16} />} prefix="vimeo.com/" value={form.vimeo} onChange={v => set("vimeo", v)} placeholder="estudio" />
              <SocialField icon={<Globe size={16} />} prefix="https://" value={form.web} onChange={v => set("web", v)} placeholder="tu-web.com" />
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div>
          <div style={{ position: "sticky", top: 100 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint, marginBottom: 12 }}>
              Vista pública
            </div>
            <div style={card({ overflow: "hidden" })}>
              <div style={{ height: 96, position: "relative",
                background: `linear-gradient(120deg, ${c.logoColors.from}, ${c.logoColors.to})` }}>
                <div style={{ position: "absolute", inset: 0,
                  background: "radial-gradient(80% 120% at 80% 0%, rgba(255,255,255,0.18), transparent 60%)" }} />
                <div style={{ position: "absolute", inset: 0,
                  backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 4px)" }} />
              </div>
              <div style={{ padding: "0 22px 22px", marginTop: -34 }}>
                <StudioLogo colors={c.logoColors} size={68} name={form.studioName} rounded={16} />
                <div style={{ ...row(8), marginTop: 14, alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{form.studioName}</h3>
                  {c.verified && <CheckCircle2 size={17} color={C.accentH} strokeWidth={2.2} />}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: C.textMuted }}>
                  {form.artistName} · {form.role}
                </div>
                <div style={{ ...row(14), marginTop: 14 }}>
                  {([["Títulos", c.stats.published], ["Seguidores", fmt(c.stats.followers)], ["Valoración", c.stats.avgRating.toFixed(1)]] as [string, string | number][]).map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{v}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>{l}</div>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 16, fontSize: 12.5, lineHeight: 1.55, color: C.textSec }}>{form.bio}</p>
                <div style={{ ...row(8), marginTop: 14, flexWrap: "wrap" }}>
                  {form.instagram && <span style={{ ...row(5), color: C.textMuted, fontSize: 12, fontWeight: 600 }}><AtSign size={14} /></span>}
                  {form.vimeo && <span style={{ ...row(5), color: C.textMuted, fontSize: 12, fontWeight: 600 }}><Video size={14} /></span>}
                  {form.web && <span style={{ ...row(5), color: C.textMuted, fontSize: 12, fontWeight: 600 }}><Globe size={14} /> {form.web}</span>}
                </div>
                <button className="st-btn st-btn-secondary" style={{ width: "100%", marginTop: 18, borderRadius: 10, justifyContent: "center" }}>
                  Seguir al estudio
                </button>
              </div>
            </div>
            <div style={card({ marginTop: 16, padding: "15px 18px", display: "flex", gap: 11, alignItems: "center" })}>
              <Info size={17} color={C.textMuted} style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>Los cambios se reflejan al instante en tu página pública.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
