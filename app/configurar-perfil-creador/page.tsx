"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Video, Globe, Upload } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const inputCls =
  "w-full rounded-[10px] border border-[#1E2D42] bg-[#0A1120] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors focus:border-[#22B16B]/60";

const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[#4A5A6E]";

function SocialInput({ icon, prefix, value, onChange, placeholder }: {
  icon: React.ReactNode; prefix: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="flex overflow-hidden rounded-[10px] border border-[#1E2D42] bg-[#0A1120]">
      <span className="flex shrink-0 items-center gap-1.5 border-r border-[#1E2D42] px-3 text-[12px] font-semibold text-[#4A5A6E]">
        {icon} {prefix}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-3 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none"
      />
    </div>
  );
}

export default function ConfigurarPerfilCreadorPage() {
  const router = useRouter();

  const [creatorName,   setCreatorName]   = useState("");
  const [studioName,    setStudioName]    = useState("");
  const [role,          setRole]          = useState("");
  const [location,      setLocation]      = useState("");
  const [bio,           setBio]           = useState("");
  const [instagram,     setInstagram]     = useState("");
  const [vimeo,         setVimeo]         = useState("");
  const [websiteUrl,    setWebsiteUrl]    = useState("");
  const [acceptTerms,   setAcceptTerms]   = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [init,          setInit]          = useState(true);
  const [error,         setError]         = useState("");
  // null = no decision yet (show conversion prompt), true = confirmed, false = declined
  const [conversionConfirmed, setConversionConfirmed] = useState<boolean | null>(null);
  const [isExistingViewer,    setIsExistingViewer]    = useState(false);
  const [existingDisplayName, setExistingDisplayName] = useState("");

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: creatorRow } = await supabase
        .from("creator_profiles")
        .select("user_id, studio_name")
        .eq("user_id", user.id)
        .maybeSingle();

      // Already fully set up as creator → go to studio
      if (creatorRow?.studio_name) { router.replace("/mi-estudio"); return; }

      // Check if they already have a viewer profile (existing account)
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      // Any user with an existing profiles row is a viewer account
      const hasViewerAccount = !!profileRow?.display_name;
      setIsExistingViewer(hasViewerAccount && !creatorRow);
      if (hasViewerAccount) setExistingDisplayName(profileRow!.display_name);

      // If the user already confirmed conversion in this session (cookie persisted
      // across navigation), skip the confirmation screen and go straight to the form.
      const alreadyConfirmed = document.cookie.includes("gma_creator_setup=confirmed");
      if (alreadyConfirmed && hasViewerAccount && !creatorRow) {
        setConversionConfirmed(true);
      }

      const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
      setCreatorName(metaName);
      setInit(false);
    }
    void check();
  }, [router]);

  const canSubmit =
    !!creatorName.trim() && !!studioName.trim() && acceptTerms && acceptPrivacy && !loading;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }

    const payload = {
      user_id:       user.id,
      creator_name:  creatorName.trim(),
      studio_name:   studioName.trim(),
      role:          role.trim()       || null,
      location:      location.trim()   || null,
      bio:           bio.trim().slice(0, 280) || null,
      instagram_url: instagram.trim()  || null,
      vimeo_url:     vimeo.trim()      || null,
      website_url:   websiteUrl.trim() || null,
    };

    const { data: existing } = await supabase
      .from("creator_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error: err } = existing
      ? await supabase.from("creator_profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("creator_profiles").insert(payload);

    if (err) {
      setError("Error al guardar. Inténtalo de nuevo.");
      setLoading(false);
    } else {
      document.cookie = "gma_creator_setup=; path=/; max-age=0; SameSite=Lax";
      router.push("/perfiles?next=/mi-estudio");
      router.refresh();
    }
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#060C14" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  // Existing viewer: ask before showing the creator form
  if (isExistingViewer && conversionConfirmed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "#060C14" }}>
        <div className="w-full max-w-[440px] rounded-[16px] p-8" style={{ background: "#0D1520", border: "1px solid #1E2D42" }}>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-3 py-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#22B16B]">Cuenta existente detectada</span>
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em] text-white">
            ¿Añadir acceso de creador?
          </h1>
          <p className="mt-3 text-[13px] leading-[1.6] text-[#8A9AB0]">
            Ya tienes una cuenta de espectador como{" "}
            <span className="font-semibold text-white">{existingDisplayName || "usuario"}</span>.
            Todas tus valoraciones, listas e historial se conservan intactos.
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-[#8A9AB0]">
            Si añades acceso de creador, tendrás también{" "}
            <span className="font-semibold text-[#22B16B]">Mi Estudio</span> disponible en tu cuenta.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                document.cookie = "gma_creator_setup=confirmed; path=/; max-age=600; SameSite=Lax";
                setConversionConfirmed(true);
              }}
              className="w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A]"
            >
              Sí, añadir acceso de creador
            </button>
            <button
              type="button"
              onClick={async () => {
                document.cookie = "gma_creator_setup=; path=/; max-age=0; SameSite=Lax";
                await getSupabaseBrowserClient().auth.signOut();
                router.push("/");
              }}
              className="w-full rounded-full border border-[#1E2D42] py-3 text-[14px] font-semibold text-[#B8C5D4] transition-colors hover:bg-white/[0.04]"
            >
              No, cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const panelCls = "rounded-[14px] p-6 flex flex-col";
  const panelStyle = { background: "#0D1520", border: "1px solid #1E2D42" };

  return (
    <div className="min-h-screen px-6 py-12" style={{ background: "#060C14" }}>
      <div className="mx-auto w-full max-w-[960px]">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-3 py-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#22B16B]">Perfil Creador</span>
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-white">Completa tu perfil</h1>
          <p className="mt-2 text-[13px] text-[#5A6A7E]">Así te verá la comunidad de GMA Filmo.</p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSave(e)}>
          {/* 2×2 grid */}
          <div className="grid grid-cols-2 gap-5">

            {/* Panel 1 — Identidad (top-left) */}
            <div className={panelCls} style={panelStyle}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#4A5A6E]">
                Identidad del estudio
              </p>

              {/* Logo */}
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] text-[20px] font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg,#22B16B,#1A7A4E)" }}
                >
                  {studioName[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-[11px] text-[#5A6A7E]">Logo · PNG, JPG o SVG</p>
                  <button
                    type="button"
                    onClick={() => setError("Sube tu logo desde Mi Estudio una vez dentro.")}
                    className="mt-1 flex items-center gap-1 rounded-full border border-[#1E2D42] px-2.5 py-0.5 text-[11px] font-semibold text-[#B8C5D4] transition-colors hover:bg-white/[0.04]"
                  >
                    <Upload size={11} /> Subir
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <label className={labelCls}>Nombre artístico <span className="text-[#ff5252]">*</span></label>
                  <input type="text" autoFocus value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="Tu nombre de creador" maxLength={60} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nombre del estudio <span className="text-[#ff5252]">*</span></label>
                  <input type="text" value={studioName} onChange={(e) => setStudioName(e.target.value)}
                    placeholder="Tu productora o estudio" maxLength={80} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Rol / disciplina</label>
                  <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                    placeholder="Director · Guionista" maxLength={80} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ubicación</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ciudad, país" maxLength={80} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Panel 2 — Biografía (top-right) */}
            <div className={panelCls} style={panelStyle}>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4A5A6E]">Biografía</p>
                <span className="text-[11px] text-[#4A5A6E]">{bio.length}/280</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="Cuéntale a la comunidad quién eres y qué tipo de cine haces…"
                className="flex-1 w-full resize-none rounded-[10px] border border-[#1E2D42] bg-[#0A1120] px-4 py-3 text-[14px] leading-[1.6] text-white placeholder-[#3A4A5E] outline-none transition-colors focus:border-[#22B16B]/60"
                style={{ minHeight: 180 }}
              />
            </div>

            {/* Panel 3 — Redes sociales (bottom-left) */}
            <div className={panelCls} style={panelStyle}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#4A5A6E]">
                Redes sociales{" "}
                <span className="font-normal normal-case tracking-normal text-[#4A5A6E]/70">· opcional</span>
              </p>
              <div className="flex flex-1 flex-col justify-center gap-3">
                <SocialInput icon={<AtSign size={13} />} prefix="instagram.com/" value={instagram} onChange={setInstagram} placeholder="usuario" />
                <SocialInput icon={<Video size={13} />}   prefix="vimeo.com/"     value={vimeo}      onChange={setVimeo}      placeholder="estudio" />
                <SocialInput icon={<Globe size={13} />}   prefix="https://"       value={websiteUrl} onChange={setWebsiteUrl} placeholder="tu-web.com" />
              </div>
            </div>

            {/* Panel 4 — Acuerdos (bottom-right) */}
            <div className={panelCls} style={panelStyle}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#4A5A6E]">Acuerdos</p>
              <div className="flex flex-1 flex-col justify-center gap-5">
                {[
                  {
                    checked: acceptTerms,
                    toggle: () => setAcceptTerms((v) => !v),
                    label: (
                      <>
                        He leído y acepto las{" "}
                        <a href="/terminos" className="font-semibold text-white underline-offset-2 hover:underline">
                          Condiciones de uso
                        </a>{" "}de GMA Filmo.
                      </>
                    ),
                  },
                  {
                    checked: acceptPrivacy,
                    toggle: () => setAcceptPrivacy((v) => !v),
                    label: (
                      <>
                        He leído y acepto la{" "}
                        <a href="/privacidad" className="font-semibold text-white underline-offset-2 hover:underline">
                          Política de privacidad
                        </a>.
                        {" "}Confirmo que el contenido que publique es de mi autoría o dispongo de los derechos necesarios.
                      </>
                    ),
                  },
                ].map(({ checked, toggle, label }, i) => (
                  <label key={i} className="flex cursor-pointer items-start gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={toggle}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked ? "border-[#22B16B] bg-[#22B16B]" : "border-[#2A3A50] bg-transparent"
                      }`}
                    >
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="#051910" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className="text-[13px] leading-[1.5] text-[#8A9AB0]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* Acciones */}
          <div className="mt-6 flex items-center justify-between gap-4 pb-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-[13px] font-semibold text-[#4A5A6E] transition-colors hover:text-white"
            >
              ← Cancelar y volver al inicio
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-[#22B16B] px-7 py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Empezar a crear →"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
