"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUsernameAvailability } from "@/hooks/use-username-availability";
import {
  USERNAME_MAX, normalizeUsername, usernameErrorMessage, usernameProblem, usernameSaveError,
} from "@/lib/profiles/username";

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
  // @ público: llega el provisional que puso la base de datos; si lo cambia aquí, cuenta como su primer cambio.
  const [username,        setUsername]        = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [usernameError,   setUsernameError]   = useState<string | null>(null);
  const [color,   setColor]   = useState<string>(COLORS[0]!.hex);
  const [loading, setLoading] = useState(false);
  const [init,    setInit]    = useState(true);

  // Mientras escribe: formato y disponibilidad del @ (el provisional de partida no cuenta como cambio).
  const candidate = normalizeUsername(username);
  const availability = useUsernameAvailability(candidate, initialUsername);
  const candidateProblem = candidate !== "" && candidate !== initialUsername ? usernameProblem(candidate) : null;
  const candidateProblemMessage = candidateProblem ? usernameErrorMessage(candidateProblem) : null;

  useEffect(() => {
    async function checkProfile() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_color, username")
        .eq("id", user.id)
        .maybeSingle();
      setUsername(data?.username ?? "");
      setInitialUsername(data?.username ?? "");

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

    const nextUsername = normalizeUsername(username);
    const problem = nextUsername && nextUsername !== initialUsername ? usernameProblem(nextUsername) : null;
    if (problem) { setUsernameError(usernameErrorMessage(problem)); setLoading(false); return; }

    await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: trimmed, avatar_color: color });

    if (nextUsername && nextUsername !== initialUsername) {
      const { error } = await supabase.from("profiles").update({ username: nextUsername }).eq("id", user.id);
      if (error) { setUsernameError(usernameErrorMessage(usernameSaveError(error))); setLoading(false); return; }
    }

    router.push("/perfiles");
    router.refresh();
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gma-surface-2)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  const initial = name[0]?.toUpperCase() ?? "?";
  const shownUsernameError = usernameError ?? candidateProblemMessage ?? (availability === "taken" ? usernameErrorMessage("taken") : null);

  return (
    <div
      className="flex min-h-screen min-h-[100dvh] items-center justify-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-[calc(3rem+env(safe-area-inset-top))] sm:pb-[calc(3rem+env(safe-area-inset-bottom))]"
      style={{ background: "var(--gma-surface-2)" }}
    >
      <div
        className="w-full min-w-0 p-6 sm:p-9"
        style={{
          maxWidth: 420,
          background: "var(--gma-panel)",
          border: "1px solid var(--gma-line-strong)",
          borderRadius: 16,
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
        <p className="mb-8 text-[13px] text-[#686868]">
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
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#585858]">
              Tu nombre
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              maxLength={40}
              className="min-w-0 w-full rounded-md border border-gma-line-strong bg-gma-panel px-4 py-3 text-[16px] text-white placeholder-[#585858] outline-none transition-colors focus:border-[#22B16B]/60"
              required
            />
            <p className="mt-1.5 text-[12px] text-[#686868]">Privado: solo lo ves tú.</p>
          </div>

          {/* @usuario */}
          {initialUsername && (
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#585858]">
                Nombre de usuario
              </label>
              <div className="flex min-w-0 items-center rounded-md border border-gma-line-strong bg-gma-panel px-4 transition-colors focus-within:border-[#22B16B]/60">
                <span aria-hidden="true" className="text-[16px] text-[#585858]">@</span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setUsernameError(null); }}
                  maxLength={USERNAME_MAX + 1}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={shownUsernameError ? true : undefined}
                  aria-describedby="username-hint"
                  className="min-w-0 w-full bg-transparent py-3 pl-0.5 text-[16px] text-white outline-none"
                />
              </div>
              <p id="username-hint" role="status" className={`mt-1.5 text-[12px] ${shownUsernameError ? "text-[#ff7b7b]" : availability === "free" ? "text-[#5FD39A]" : "text-[#686868]"}`}>
                {shownUsernameError
                  ?? (availability === "checking" ? "Comprobando…"
                    : availability === "free" ? `@${candidate} está libre.`
                      : "Público: es como te verán los demás al comentar. Puedes dejar este o elegir el tuyo.")}
              </p>
            </div>
          )}

          {/* Color */}
          <div>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-[#585858]">
              Color de perfil
            </p>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  aria-label={c.label}
                  aria-pressed={color === c.hex}
                  className="h-11 w-11 rounded-full transition-transform duration-100 hover:scale-110"
                  style={{
                    background: c.hex,
                    boxShadow:
                      color === c.hex
                        ? `0 0 0 2.5px var(--gma-panel), 0 0 0 4.5px ${c.hex}`
                        : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || availability === "taken" || Boolean(candidateProblem)}
            className="mt-2 w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Empezar a ver →"}
          </button>
        </form>
      </div>
    </div>
  );
}
