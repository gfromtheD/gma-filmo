"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LoadingLabel } from "@/components/ui/loading-label";
import { AUTH_GOOGLE, AUTH_INPUT, AUTH_NOTICE_ERROR, AUTH_NOTICE_OK, AUTH_SECONDARY, AUTH_SUBMIT, GoogleIcon, MailIcon } from "@/components/ui/auth-shared";

interface LoginCardProps {
  onRegister?: () => void;
  onCreatorRegister?: () => void;
}

function LoginCardInner({ onRegister }: LoginCardProps) {
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
    if (searchParams.get("error") === "recuperar") setError("El enlace para cambiar la contraseña ha caducado o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».");
    else if (searchParams.get("error")) setError("Error de autenticación. Inténtalo de nuevo.");
  }, [searchParams]);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    // Ensure any leftover creator-pending cookie doesn't pollute this normal login
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
      redirectTo: `${window.location.origin}/auth/callback/recuperar`,
    });
    if (err) {
      setError(err.message);
    } else {
      setResetMsg(`Enlace enviado a ${email.trim()}. Revisa tu bandeja.`);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {error && (
        <div className={AUTH_NOTICE_ERROR}>
          {error}
        </div>
      )}
      {resetMsg && (
        <div className={AUTH_NOTICE_OK}>
          {resetMsg}
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
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className="text-[14px] text-[#B5B5B5] transition-colors hover:text-white"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={AUTH_SUBMIT}
              >
                {loading ? <LoadingLabel>Iniciando sesión</LoadingLabel> : "Iniciar sesión"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[15px] font-medium text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.9)]">
        ¿Aún no tienes cuenta?{" "}
        <button type="button" onClick={onRegister} className="font-bold text-[#58D99B] transition-colors hover:underline">
          Regístrate
        </button>
      </p>

    </div>
  );
}

export function LoginCard({ onRegister, onCreatorRegister }: LoginCardProps) {
  return (
    <Suspense fallback={<div />}>
      <LoginCardInner onRegister={onRegister} onCreatorRegister={onCreatorRegister} />
    </Suspense>
  );
}
