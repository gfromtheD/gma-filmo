"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LoadingLabel } from "@/components/ui/loading-label";
import { AUTH_GOOGLE, AUTH_INPUT, AUTH_NOTICE_ERROR, AUTH_NOTICE_OK, AUTH_SECONDARY, AUTH_SUBMIT, GoogleIcon, MailIcon } from "@/components/ui/auth-shared";

interface CreatorRegisterCardProps {
  onLogin?: () => void;
}

export function CreatorRegisterCard({ onLogin }: CreatorRegisterCardProps) {
  const [showEmail,     setShowEmail]     = useState(false);
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [creatorName,   setCreatorName]   = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");
  // Set when an existing viewer account is detected and must confirm the switch to creator
  const [pendingUpgrade, setPendingUpgrade] = useState<{ userId: string } | null>(null);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    // Flag stored in cookie — query params in redirectTo are rejected by Supabase
    document.cookie = "gma_creator_pending=1; path=/; max-age=300; SameSite=Lax";
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "openid email profile",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (err) { setError(err.message); setGoogleLoading(false); }
  }

  async function confirmUpgrade() {
    if (!pendingUpgrade) return;
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase
      .from("creator_profiles")
      .insert({ user_id: pendingUpgrade.userId, creator_name: creatorName.trim() });

    if (err) {
      setError("No se pudo convertir la cuenta. Inténtalo de nuevo.");
      setLoading(false);
      setPendingUpgrade(null);
      return;
    }
    window.location.href = "/mi-estudio";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!creatorName.trim()) { setError("Introduce tu nombre de creador."); return; }
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    // ── Try sign-in first — covers existing users wanting creator status ──
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (!signInErr && signInData.user) {
      document.cookie = "gma_guest=; path=/; max-age=0; SameSite=Lax";

      const { data: existingCreator } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("user_id", signInData.user.id)
        .maybeSingle();

      // Ya es creador: entra como cualquier otra persona (selector de perfiles y, de ahí, Inicio). A Mi Estudio llega desde
      // el menú de su cuenta cuando quiera.
      if (existingCreator) {
        window.location.href = "/perfiles";
        return;
      }

      // Existing viewer account, no creator profile yet → ask before switching
      setPendingUpgrade({ userId: signInData.user.id });
      setLoading(false);
      return;
    }

    // ── Sign-in failed → treat as new user registration ──────────────────
    if (!confirm) { setError("Por favor confirma tu contraseña."); setLoading(false); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); setLoading(false); return; }
    if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); setLoading(false); return; }

    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { is_creator: true, creator_name: creatorName.trim() },
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      setLoading(false);
    } else {
      setSuccess("Cuenta creada. Revisa tu correo para confirmar.");
      setTimeout(() => onLogin?.(), 3000);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {error && (
        <div className={AUTH_NOTICE_ERROR}>
          {error}
        </div>
      )}
      {success && (
        <div className={AUTH_NOTICE_OK}>
          {success}
        </div>
      )}

      {pendingUpgrade && (
        <div className="w-full rounded-2xl border border-[#22B16B]/30 bg-[#22B16B]/[0.06] p-5">
          <h2 className="text-[16px] font-extrabold text-white">Convertir tu cuenta en creador</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#C4C4C4]">
            El correo <span className="font-semibold text-white">{email}</span> ya tiene una cuenta de
            espectador. Si continúas, se convertirá <span className="font-semibold text-white">también</span>{" "}
            en cuenta de creador: conservarás todo tu acceso actual y se desbloqueará{" "}
            <span className="font-semibold text-[#22B16B]">Mi Estudio</span>.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void confirmUpgrade()}
              disabled={loading}
              className={AUTH_SUBMIT}
            >
              {loading ? <LoadingLabel>Convirtiendo</LoadingLabel> : "Sí, convertir mi cuenta"}
            </button>
            <button
              type="button"
              onClick={() => { setPendingUpgrade(null); setError(""); }}
              disabled={loading}
              className={AUTH_SECONDARY}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!pendingUpgrade && (
       <>
      <button type="button" onClick={() => void handleGoogle()} disabled={googleLoading} className={AUTH_GOOGLE}>
        <GoogleIcon />
        {googleLoading ? <LoadingLabel>Conectando</LoadingLabel> : "Continuar con Google"}
      </button>

      <button type="button" onClick={() => setShowEmail(v => !v)} className={AUTH_SECONDARY}>
        <MailIcon />
        Continuar con correo
      </button>

      <AnimatePresence>
        {showEmail && (
          <motion.div
            key="creator-email-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="w-full overflow-hidden"
          >
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 pt-1">
              <input
                type="text"
                required
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Nombre artístico o del proyecto"
                maxLength={60}
                className={AUTH_INPUT}
              />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className={AUTH_INPUT}
              />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className={AUTH_INPUT}
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmar contraseña (solo si es cuenta nueva)"
                className={AUTH_INPUT}
              />
              <p className="text-[11px] text-[#585858]">
                Si ya tienes cuenta, deja la confirmación vacía e introduce tus credenciales.
              </p>
              <button
                type="submit"
                disabled={loading}
                className={AUTH_SUBMIT}
              >
                {loading ? <LoadingLabel>Verificando</LoadingLabel> : "Continuar como creador"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[15px] font-medium text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.9)]">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-white transition-colors hover:text-[#22B16B]">
          Inicia sesión →
        </button>
      </p>
       </>
      )}
    </div>
  );
}
