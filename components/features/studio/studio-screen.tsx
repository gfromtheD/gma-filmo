"use client";

import { useState, useEffect } from "react";
import { MySpaceScreen } from "@/components/features/space/my-space-screen";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import type { MovieMedia } from "@/types/catalog";

interface StudioScreenProps {
  readonly items: readonly MovieMedia[];
}

type StudioTab = "spectator" | "creator";

function getInitialTab(): StudioTab {
  if (typeof window === "undefined") return "creator";
  return (sessionStorage.getItem("studio-tab") as StudioTab) ?? "creator";
}

export function StudioScreen({ items }: StudioScreenProps) {
  const [tab,         setTab]         = useState<StudioTab>(getInitialTab);
  const [creatorName, setCreatorName] = useState("");
  const [bio,         setBio]         = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState("");
  const userId = useSupabaseUserId();

  useEffect(() => {
    sessionStorage.setItem("studio-tab", tab);
  }, [tab]);

  useEffect(() => {
    if (!userId) return;
    getSupabaseBrowserClient()
      .from("creator_profiles")
      .select("creator_name, bio")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCreatorName(data.creator_name);
          setBio(data.bio ?? "");
        }
      });
  }, [userId]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setSaveMsg("");
    const { error } = await getSupabaseBrowserClient()
      .from("creator_profiles")
      .update({ creator_name: creatorName.trim(), bio: bio.trim() || null })
      .eq("user_id", userId);
    setSaving(false);
    setSaveMsg(error ? "Error al guardar." : "Guardado.");
    setTimeout(() => setSaveMsg(""), 2500);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-10">
      {/* Header + Toggle */}
      <div className="mb-10 flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-white">Mi Estudio</h1>
        <div className="flex items-center rounded-full border border-[#262626] bg-[#0D0D0D] p-1">
          <button
            type="button"
            onClick={() => setTab("spectator")}
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: tab === "spectator" ? "#22B16B" : "transparent",
              color: tab === "spectator" ? "#031A0E" : "#B8C5D4",
            }}
          >
            Espectador
          </button>
          <button
            type="button"
            onClick={() => setTab("creator")}
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: tab === "creator" ? "#22B16B" : "transparent",
              color: tab === "creator" ? "#031A0E" : "#B8C5D4",
            }}
          >
            Creador
          </button>
        </div>
      </div>

      {/* Spectator view */}
      {tab === "spectator" && <MySpaceScreen items={items} />}

      {/* Creator view */}
      {tab === "creator" && (
        <div className="flex flex-col gap-8">
          {/* Profile editor */}
          <section className="rounded-[14px] border border-[#1E1E1E] bg-[#0D0D0D] p-6">
            <h2 className="mb-5 text-[16px] font-bold text-white">Perfil de creador</h2>
            <form onSubmit={(e) => void handleSaveProfile(e)} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
                  Nombre artístico
                </label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Tu nombre de creador"
                  maxLength={60}
                  required
                  className="w-full rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors focus:border-[#22B16B]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
                  Bio <span className="normal-case text-[#3A4A5E]">(opcional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cuéntanos sobre tu proyecto..."
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors focus:border-[#22B16B]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !creatorName.trim()}
                  className="rounded-full bg-[#22B16B] px-6 py-2.5 text-[13px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                {saveMsg && (
                  <span className="text-[13px] text-[#22B16B]">{saveMsg}</span>
                )}
              </div>
            </form>
          </section>

          {/* Upload placeholder */}
          <section className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#262626] py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A] text-[#3A3A3A]">
              <GmaIcon name="film" size={24} />
            </div>
            <p className="mb-1 text-[15px] font-bold text-white">Subir contenido</p>
            <p className="text-[13px] text-[#5A6A7E]">Próximamente podrás subir tus cortos y largometrajes.</p>
          </section>
        </div>
      )}
    </div>
  );
}
