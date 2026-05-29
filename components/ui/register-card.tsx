"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface RegisterCardProps {
  onBack?: () => void;
  onLogin?: () => void;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  );
}

function GuestIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors duration-150 focus:border-[#22B16B]";

const pillClass =
  "flex w-full items-center justify-center gap-3 rounded-full border border-[#1E2D42] bg-white/[0.04] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-50";

export function RegisterCard({ onBack, onLogin }: RegisterCardProps) {
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
    window.location.href = "/peliculas";
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <button type="button" onClick={onBack} className="mb-2 transition-opacity hover:opacity-75">
        <img src="/images/logo-gma.png" alt="GMA Filmo" className="h-16 w-auto" />
      </button>

      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">Únete a GMA Filmo</h1>
        <p className="mt-1.5 text-sm text-[#B8C5D4]">Forma parte de la comunidad.</p>
      </div>

      {error && (
        <div className="w-full rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
          {error}
        </div>
      )}
      {success && (
        <div className="w-full rounded-xl bg-[#22B16B]/10 px-4 py-2.5 text-center text-[13px] text-[#22B16B]">
          {success}
        </div>
      )}

      {/* Píldora Google */}
      <button type="button" onClick={() => void handleGoogle()} disabled={googleLoading} className={`${pillClass} mt-4`}>
        <GoogleIcon />
        {googleLoading ? "Conectando…" : "Continuar con Google"}
      </button>

      {/* Píldora correo */}
      <button
        type="button"
        onClick={() => setShowEmail(v => !v)}
        className={pillClass}
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
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña (mínimo 6 caracteres)"
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmar contraseña"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-black transition-[transform,background] hover:bg-[#2AC57A] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Píldora invitado */}
      <button type="button" onClick={() => void handleGuest()} className={pillClass}>
        <GuestIcon />
        Continuar como invitado
      </button>

      <p className="text-center text-[13px] text-[#6D7D94]">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-white transition-colors hover:text-[#22B16B]">
          Inicia sesión →
        </button>
      </p>
    </div>
  );
}
