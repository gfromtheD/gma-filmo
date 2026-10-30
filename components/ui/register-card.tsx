"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LoadingLabel } from "@/components/ui/loading-label";
import { AUTH_GOOGLE, AUTH_INPUT, AUTH_NOTICE_ERROR, AUTH_NOTICE_OK, AUTH_SECONDARY, AUTH_SUBMIT, GoogleIcon, MailIcon, GuestIcon } from "@/components/ui/auth-shared";

interface RegisterCardProps {
  onLogin?: () => void;
  onCreatorRegister?: () => void;
}

export function RegisterCard({ onLogin }: RegisterCardProps) {
  const [showEmail,     setShowEmail]     = useState(false);
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    document.cookie = "gma_creator_pending=; path=/; max-age=0; SameSite=Lax";
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true);
    const { error: err } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      setSuccess("Cuenta creada. Revisa tu correo para confirmar.");
      setTimeout(() => onLogin?.(), 3000);
    }
  }

  async function handleGuest() {
    await getSupabaseBrowserClient().auth.signOut();
    document.cookie = "gma_guest=1; path=/; max-age=86400; SameSite=Lax";
    window.location.href = "/inicio";
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

      {/* Píldora Google */}
      <button type="button" onClick={() => void handleGoogle()} disabled={googleLoading} className={AUTH_GOOGLE}>
        <GoogleIcon />
        {googleLoading ? <LoadingLabel>Conectando</LoadingLabel> : "Continuar con Google"}
      </button>

      {/* Píldora correo */}
      <button
        type="button"
        onClick={() => setShowEmail(v => !v)}
        className={AUTH_SECONDARY}
      >
        <MailIcon />
        Registrarse con tu correo
      </button>

      {/* Formulario expandible */}
      <AnimatePresence>
        {showEmail && (
          <motion.div
            key="email-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="w-full overflow-hidden"
          >
            <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-3 pt-1">
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña (mínimo 6 caracteres)"
                className={AUTH_INPUT}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmar contraseña"
                className={AUTH_INPUT}
              />
              <button
                type="submit"
                disabled={loading}
                className={AUTH_SUBMIT}
              >
                {loading ? <LoadingLabel>Creando cuenta</LoadingLabel> : "Crear cuenta"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Píldora invitado */}
      <button type="button" onClick={() => void handleGuest()} className={AUTH_SECONDARY}>
        <GuestIcon />
        Continuar como invitado
      </button>

      <p className="text-center text-[15px] font-medium text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.9)]">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-white transition-colors hover:text-[#22B16B]">
          Inicia sesión →
        </button>
      </p>

    </div>
  );
}
