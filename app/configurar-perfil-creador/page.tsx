"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ConfigurarPerfilCreadorPage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("");
  const [studioName,  setStudioName]  = useState("");
  const [location,    setLocation]    = useState("");
  const [websiteUrl,  setWebsiteUrl]  = useState("");
  const [loading,     setLoading]     = useState(false);
  const [init,        setInit]        = useState(true);
  const [error,       setError]       = useState("");

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) { router.replace("/perfiles"); return; }

      const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
      setCreatorName(metaName);
      setInit(false);
    }
    void check();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName   = creatorName.trim();
    const trimmedStudio = studioName.trim();
    if (!trimmedName || !trimmedStudio) return;
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }

    const { error: err } = await supabase
      .from("creator_profiles")
      .insert({
        user_id:      user.id,
        creator_name: trimmedName,
        studio_name:  trimmedStudio,
        location:     location.trim()   || null,
        website_url:  websiteUrl.trim() || null,
      });

    if (err) {
      setError("Error al guardar. Inténtalo de nuevo.");
      setLoading(false);
    } else {
      router.push("/perfiles");
      router.refresh();
    }
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0A0F17" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: "#0A0F17" }}>
      <div
        className="w-full"
        style={{
          maxWidth: 420,
          background: "#111827",
          border: "1px solid #1E2D42",
          borderRadius: 16,
          padding: "40px 36px",
        }}
      >
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#22B16B]">Perfil Creador</span>
        </div>

        <h1 className="mb-1 mt-4 text-[24px] font-extrabold tracking-[-0.02em] text-white">
          Un último paso
        </h1>
        <p className="mb-8 text-[13px] text-[#5A6A7E]">
          ¿Cómo quieres que te conozca la comunidad?
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Nombre artístico o del proyecto
            </label>
            <input
              type="text"
              autoFocus
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Tu nombre de creador"
              maxLength={60}
              required
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Nombre del estudio
            </label>
            <input
              type="text"
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              placeholder="Nombre de tu productora o estudio"
              maxLength={80}
              required
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Ubicación <span className="text-[#4A5A6E]/70">(opcional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ciudad, país"
              maxLength={80}
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Web <span className="text-[#4A5A6E]/70">(opcional)</span>
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://tu-web.com"
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !creatorName.trim() || !studioName.trim()}
            className="mt-2 w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Empezar a crear →"}
          </button>
        </form>
      </div>
    </div>
  );
}
