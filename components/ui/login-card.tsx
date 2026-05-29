"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface LoginCardProps {
  onBack?: () => void;
  onRegister?: () => void;
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

function GuestIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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

const inputClass =
  "w-full rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors duration-150 focus:border-[#22B16B]";

const pillClass =
  "flex w-full items-center justify-center gap-3 rounded-full border border-[#1E2D42] bg-white/[0.04] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-50";

function LoginCardInner({ onBack, onRegister }: LoginCardProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [showEmail,     setShowEmail]     = useState(false);
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,         setError]         = useState("");
  const [resetMsg,      setResetMsg]      = useState("");

  useEffect(() => {
    if (searchParams.get("error")) setError("Error de autenticación. Inténtalo de nuevo.");
  }, [searchParams]);

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

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetMsg("");
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (err) {
      setError(
        err.message.toLowerCase().includes("invalid") || err.message.toLowerCase().includes("credentials")
          ? "Correo o contraseña incorrectos."
          : err.message
      );
      setLoading(false);
    } else {
      document.cookie = "gma_guest=; path=/; max-age=0; SameSite=Lax";
      router.push("/perfiles");
      router.refresh();
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError("Introduce tu correo electrónico primero."); return; }
    setError("");
    setResetMsg("");
    const { error: err } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    if (err) {
      setError(err.message);
    } else {
      setResetMsg(`Enlace enviado a ${email.trim()}. Revisa tu bandeja.`);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <button type="button" onClick={onBack} className="mb-2 transition-opacity hover:opacity-75">
        <img src="/images/logo-gma.png" alt="GMA Filmo" className="h-16 w-auto" />
      </button>

      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">Bienvenido de nuevo</h1>
        <p className="mt-1.5 text-sm text-[#B8C5D4]">Ingresa para continuar.</p>
      </div>

      {error && (
        <div className="w-full rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
          {error}
        </div>
      )}
      {resetMsg && (
        <div className="w-full rounded-xl bg-[#22B16B]/10 px-4 py-2.5 text-center text-[13px] text-[#22B16B]">
          {resetMsg}
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
        Continuar con tu correo
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
            <form onSubmit={(e) => void handleEmailLogin(e)} className="flex flex-col gap-3 pt-1">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className={inputClass}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className="text-[12.5px] text-[#5A6A7E] transition-colors hover:text-white"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white py-3 text-[14px] font-bold text-black transition-[transform,background] hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Iniciando sesión…" : "Iniciar sesión"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Píldora invitado */}
      <button
        type="button"
        onClick={async () => {
          await getSupabaseBrowserClient().auth.signOut();
          document.cookie = "gma_guest=1; path=/; max-age=86400; SameSite=Lax";
          window.location.href = "/inicio";
        }}
        className={pillClass}
      >
        <GuestIcon />
        Continuar como invitado
      </button>

      <p className="text-center text-[13px] text-[#6D7D94]">
        ¿Aún no tienes cuenta?{" "}
        <button type="button" onClick={onRegister} className="font-semibold text-[#22B16B] transition-colors hover:underline">
          Regístrate
        </button>
      </p>
    </div>
  );
}

export function LoginCard({ onBack, onRegister }: LoginCardProps) {
  return (
    <Suspense fallback={<div />}>
      <LoginCardInner onBack={onBack} onRegister={onRegister} />
    </Suspense>
  );
}
