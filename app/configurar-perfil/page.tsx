"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const COLORS = [
  { id: "green",  hex: "#22B16B", label: "Verde" },
  { id: "blue",   hex: "#3B82F6", label: "Azul" },
  { id: "purple", hex: "#8B5CF6", label: "Violeta" },
  { id: "coral",  hex: "#F97316", label: "Coral" },
  { id: "rose",   hex: "#F43F5E", label: "Rosa" },
  { id: "amber",  hex: "#F59E0B", label: "Ámbar" },
] as const;

export default function ConfigurarPerfilPage() {
  const router    = useRouter();
  const [name,    setName]    = useState("");
  const [color,   setColor]   = useState<string>(COLORS[0]!.hex);
  const [loading, setLoading] = useState(false);
  const [init,    setInit]    = useState(true);

  useEffect(() => {
    async function checkProfile() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_color")
        .eq("id", user.id)
        .maybeSingle();

      // Skip setup if a real name is already saved
      const name = data?.display_name?.trim() ?? "";
      if (name && name !== "Espectador") {
        router.replace("/perfiles");
        return;
      }

      // Pre-fill name: prefer Google/email metadata, fall back to email local-part
      const metaName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
      const emailLocal = (user.email ?? "").split("@")[0] ?? "";
      setName(metaName || emailLocal);

      // Pre-fill color: use saved value or pick one deterministically from the email
      if (data?.avatar_color) {
        setColor(data.avatar_color);
      } else {
        const seed = (user.email ?? "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
        setColor(COLORS[seed % COLORS.length]!.hex);
      }
      setInit(false);
    }
    void checkProfile();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }

    await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: trimmed, avatar_color: color });

    router.push("/perfiles");
    router.refresh();
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0A0F17" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "#0A0F17" }}
    >
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
        {/* Logo */}
        <div className="mb-8 flex items-baseline gap-1.5">
          <span className="text-[20px] font-extrabold uppercase tracking-[0.02em] text-white">GMA</span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#22B16B" }}>filmo</span>
        </div>

        <h1 className="mb-1 text-[24px] font-extrabold tracking-[-0.02em] text-white">
          Configura tu perfil
        </h1>
        <p className="mb-8 text-[13px] text-[#5A6A7E]">
          Elige cómo quieres que te veamos en GMA·filmo.
        </p>

        {/* Avatar preview */}
        <div className="mb-8 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-[32px] font-extrabold text-[#031A0E] transition-colors duration-200"
            style={{ background: color }}
          >
            {initial}
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Nombre
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              maxLength={40}
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
              required
            />
          </div>

          {/* Color */}
          <div>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Color de perfil
            </p>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  aria-label={c.label}
                  aria-pressed={color === c.hex}
                  className="h-8 w-8 rounded-full transition-transform duration-100 hover:scale-110"
                  style={{
                    background: c.hex,
                    boxShadow:
                      color === c.hex
                        ? `0 0 0 2.5px #111827, 0 0 0 4.5px ${c.hex}`
                        : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="mt-2 w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Empezar a ver →"}
          </button>
        </form>
      </div>
    </div>
  );
}
