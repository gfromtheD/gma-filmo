"use client";

import { useState, useEffect } from "react";
import { Check, Upload, Image as ImageIcon, Info, CheckCircle2, Pencil, X, MapPin } from "lucide-react";
import { fmt, C, card, row, col, StudioLogo } from "./studio-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SocialLinksPanel, SocialPlatformIcon, getSocialPlatform, socialDisplayText } from "@/components/ui/social-links-panel";
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

export function ProfileView({ data, onToast }: Props) {
  const c = data.creator;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio,
    location: c.location,
  });
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(c.socials);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const setSocial = (k: string, v: string) => { setSocialLinks(s => ({ ...s, [k]: v })); setDirty(true); };

  // `data.creator` llega primero con datos de muestra y se sustituye por los
  // reales tras el fetch async en StudioScreen — sin este efecto, este estado
  // local se quedaría congelado con la muestra inicial para siempre.
  useEffect(() => {
    if (editing) return; // no pisar una edición en curso
    setForm({ studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio, location: c.location });
    setSocialLinks(c.socials);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  async function handleSave() {
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); onToast("No se pudo guardar: sesión no encontrada", { error: true }); return; }

    const cleanSocialLinks = Object.fromEntries(
      Object.entries(socialLinks).map(([k, v]) => [k, v.trim()]).filter(([, v]) => !!v)
    );

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        studio_name:  form.studioName.trim(),
        creator_name: form.artistName.trim(),
        role:         form.role.trim() || null,
        bio:          form.bio.trim().slice(0, 300),
        location:     form.location.trim() || null,
        social_links: cleanSocialLinks,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      onToast("Error al guardar el perfil", { error: true });
    } else {
      setDirty(false);
      setEditing(false);
      onToast("Perfil actualizado");
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ ...row(), justifyContent: "space-between", alignItems: "flex-end",
        marginBottom: 32, flexWrap: "wrap", gap: 16, display: "flex" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.08em", color: C.textFaint, marginBottom: 10 }}>Mi Estudio</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Perfil de creador
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: C.textSec }}>
            Así te ven los espectadores en GMA Filmo.
          </p>
        </div>

        {/* Button slot — shared */}
        <div style={row(10)}>
          {editing && (
            <button className="st-btn st-btn-ghost" onClick={() => setEditing(false)}>
              <X size={15} /> Cancelar
            </button>
          )}
          {editing ? (
            <button className="st-btn st-btn-accent" disabled={!dirty || saving}
              onClick={() => void handleSave()}>
              <Check size={15} strokeWidth={2.2} /> {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          ) : (
            <button className="st-btn st-btn-accent" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Editar perfil
            </button>
          )}
        </div>
      </div>

      {/* ── View: etiqueta en grande ── */}
      {!editing && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>

          {/* Profile card — protagonista */}
          <div style={{ width: "100%", maxWidth: 540, borderRadius: 20, overflow: "hidden",
            border: `1px solid ${C.border2}`, background: C.w6 }}>

            {/* Banner */}
            <div style={{ height: 140, position: "relative",
              background: `linear-gradient(120deg, ${c.logoColors.from}, ${c.logoColors.to})` }}>
              <div style={{ position: "absolute", inset: 0,
                background: "radial-gradient(80% 120% at 80% 0%, rgba(255,255,255,0.18), transparent 60%)" }} />
              <div style={{ position: "absolute", inset: 0,
                backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 4px)" }} />
            </div>

            {/* Content */}
            <div style={{ padding: "0 28px 28px", marginTop: -46 }}>
              <StudioLogo colors={c.logoColors} size={90} name={form.studioName} rounded={20} imageUrl={c.avatarUrl} />

              <div style={{ ...row(10), marginTop: 16, alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>
                  {form.studioName}
                </h2>
                {c.verified && <CheckCircle2 size={20} color={C.accentH} strokeWidth={2.2} />}
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 5, color: C.textMuted }}>
                {form.artistName}
                {form.role && <span style={{ color: C.textFaint }}> · {form.role}</span>}
              </div>

              {form.location && (
                <div style={{ ...row(5), marginTop: 8, fontSize: 13, color: C.textFaint, fontWeight: 600 }}>
                  <MapPin size={13} /> {form.location}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1, marginTop: 22, background: C.border1, borderRadius: 12, overflow: "hidden" }}>
                {([
                  ["Títulos",    c.stats.published],
                  ["Seguidores", fmt(c.stats.followers)],
                  ["Valoración", c.stats.avgRating.toFixed(1)],
                ] as [string, string | number][]).map(([l, v]) => (
                  <div key={l} style={{ background: C.w6, padding: "16px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>{v}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.09em", color: C.textFaint, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Bio */}
              {form.bio && (
                <p style={{ margin: "20px 0 0", fontSize: 14, lineHeight: 1.65, color: C.textSec }}>
                  {form.bio}
                </p>
              )}

              {/* Socials */}
              {Object.values(socialLinks).some((v) => v.trim()) && (
                <div style={{ ...row(14), marginTop: 18, flexWrap: "wrap" }}>
                  {Object.entries(socialLinks).filter(([, v]) => v.trim()).map(([key, value]) => {
                    const platform = getSocialPlatform(key);
                    if (!platform) return null;
                    return (
                      <span key={key} style={{ ...row(5), color: C.textMuted, fontSize: 13, fontWeight: 600 }}>
                        <SocialPlatformIcon platform={platform} size={14} /> {socialDisplayText(key, value.trim())}
                      </span>
                    );
                  })}
                </div>
              )}

              <button className="st-btn st-btn-secondary"
                style={{ width: "100%", marginTop: 22, borderRadius: 10, justifyContent: "center" }}>
                Seguir al estudio
              </button>
            </div>
          </div>

          {/* Hint */}
          <div style={{ ...row(9), fontSize: 12.5, color: C.textFaint }}>
            <Info size={14} />
            Esta es tu etiqueta pública tal como la ven los espectadores. Pulsa «Editar perfil» para modificarla.
          </div>
        </div>
      )}

      {/* ── View: formulario de edición ── */}
      {editing && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>

          {/* Left: form */}
          <div style={col(22)}>
            {/* Identity */}
            <div style={card({ padding: 24 })}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: C.textFaint, marginBottom: 18 }}>Identidad del estudio</div>
              <div style={{ ...row(18), marginBottom: 22, flexWrap: "wrap", display: "flex" }}>
                <div style={{ position: "relative" }}>
                  <StudioLogo colors={c.logoColors} size={78} name={form.studioName} rounded={18} imageUrl={c.avatarUrl} />
                  <button className="st-btn st-btn-secondary st-btn-icon"
                    style={{ position: "absolute", bottom: -6, right: -6, width: 30, height: 30,
                      borderRadius: 999, background: "#101820" }}
                    onClick={() => onToast("Sube tu logo en formato PNG o SVG")}>
                    <ImageIcon size={14} />
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>
                    Logo o foto del estudio. PNG, JPG o SVG · mín. 400×400px.
                  </div>
                  <div style={row(9)}>
                    <button className="st-btn st-btn-secondary st-btn-sm"
                      onClick={() => onToast("Selector de archivo abierto")}>
                      <Upload size={14} /> Subir
                    </button>
                    <button className="st-btn st-btn-ghost st-btn-sm st-btn-danger"
                      onClick={() => onToast("Logo eliminado", { error: true })}>
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
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: C.textFaint, marginBottom: 16 }}>Biografía</div>
              <Field label="Sobre el estudio" hint={`${form.bio.length}/280`}>
                <textarea className="st-textarea" style={{ minHeight: 120 }} maxLength={280}
                  value={form.bio} onChange={e => set("bio", e.target.value)} />
              </Field>
            </div>

            {/* Socials */}
            <div style={card({ padding: 24 })}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: C.textFaint, marginBottom: 16 }}>
                Redes sociales <span style={{ color: C.textFaint, textTransform: "none", letterSpacing: 0 }}>· opcional</span>
              </div>
              <SocialLinksPanel values={socialLinks} onChange={setSocial} accentColor={C.accentH} />
            </div>
          </div>

          {/* Right: live preview */}
          <div>
            <div style={{ position: "sticky", top: 100 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: C.textFaint, marginBottom: 12 }}>Vista previa</div>
              <div style={card({ overflow: "hidden" })}>
                <div style={{ height: 96, position: "relative",
                  background: `linear-gradient(120deg, ${c.logoColors.from}, ${c.logoColors.to})` }}>
                  <div style={{ position: "absolute", inset: 0,
                    background: "radial-gradient(80% 120% at 80% 0%, rgba(255,255,255,0.18), transparent 60%)" }} />
                  <div style={{ position: "absolute", inset: 0,
                    backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 4px)" }} />
                </div>
                <div style={{ padding: "0 20px 20px", marginTop: -34 }}>
                  <StudioLogo colors={c.logoColors} size={66} name={form.studioName} rounded={15} imageUrl={c.avatarUrl} />
                  <div style={{ ...row(8), marginTop: 12, alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{form.studioName}</h3>
                    {c.verified && <CheckCircle2 size={15} color={C.accentH} strokeWidth={2.2} />}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: C.textMuted }}>
                    {form.artistName}{form.role && ` · ${form.role}`}
                  </div>
                  <div style={{ ...row(14), marginTop: 14 }}>
                    {([["Títulos", c.stats.published], ["Seguidores", fmt(c.stats.followers)], ["Valoración", c.stats.avgRating.toFixed(1)]] as [string, string | number][]).map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{v}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textFaint }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 14, fontSize: 12, lineHeight: 1.55, color: C.textSec }}>{form.bio}</p>
                  <button className="st-btn st-btn-secondary"
                    style={{ width: "100%", marginTop: 16, borderRadius: 10, justifyContent: "center" }}>
                    Seguir al estudio
                  </button>
                </div>
              </div>
              <div style={card({ marginTop: 14, padding: "13px 16px", display: "flex", gap: 10, alignItems: "center" })}>
                <Info size={15} color={C.textMuted} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>
                  Los cambios se reflejan al instante en tu página pública.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
