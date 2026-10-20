"use client";

import { useEffect, useId, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MIN_PASSWORD_LENGTH, passwordErrorMessage, validateNewPassword } from "@/lib/auth/password";

/** Ruta a la que vuelve el enlace de «he olvidado mi contraseña». Debe estar en las Redirect URLs de Supabase. */
export const RECOVERY_REDIRECT_PATH = "/auth/callback/recuperar";

const INPUT =
  "w-full rounded-[8px] border border-gma-line-strong bg-gma-surface py-2.5 pl-3 pr-20 text-base text-white placeholder-[#7C7C7C] outline-none focus:border-[#22B16B] sm:text-[13.5px]";

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({ label, value, onChange, autoComplete, autoFocus }: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: "current-password" | "new-password";
  readonly autoFocus?: boolean;
}) {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-[#C4C4C4]">{label}</label>
      <div className="relative">
        <input
          id={id} type={isVisible ? "text" : "password"} value={value} autoComplete={autoComplete} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} className={INPUT}
        />
        <button type="button" onClick={() => setIsVisible((v) => !v)} aria-pressed={isVisible}
          className="absolute inset-y-0 right-1 my-auto h-8 rounded-[6px] px-2.5 text-[12px] font-semibold text-[#A8A8A8] hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          {isVisible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}

type Feedback = { readonly text: string; readonly danger?: boolean } | null;

/**
 * Cambio de contraseña dentro de Configuración, sin pasar por el correo. Si la cuenta ya tiene contraseña pide la
 * actual (se comprueba iniciando sesión con ella); si entró con Google, permite crear una.
 */
export function ChangePasswordForm({ email }: { readonly email: string | null }) {
  const [hasPassword, setHasPassword] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    void getSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const providers = (data.user.app_metadata?.providers as string[] | undefined) ?? [data.user.app_metadata?.provider as string];
      setHasPassword(providers.includes("email"));
    });
    return () => { cancelled = true; };
  }, []);

  const reset = () => { setCurrent(""); setNext(""); setConfirmation(""); };

  async function handleSave() {
    const invalid = validateNewPassword(next, confirmation);
    if (invalid) { setFeedback({ text: invalid, danger: true }); return; }
    if (hasPassword && !current) { setFeedback({ text: "Escribe tu contraseña actual.", danger: true }); return; }
    if (!email) { setFeedback({ text: "No encontramos el correo de tu cuenta. Recarga la página.", danger: true }); return; }

    setIsSaving(true);
    setFeedback(null);
    const supabase = getSupabaseBrowserClient();
    if (hasPassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: current });
      if (error) {
        setFeedback({ text: passwordErrorMessage({ code: error.code ?? "invalid_credentials", message: error.message }), danger: true });
        setIsSaving(false);
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setIsSaving(false);
    if (error) { setFeedback({ text: passwordErrorMessage(error), danger: true }); return; }
    reset();
    setIsOpen(false);
    setHasPassword(true);
    setFeedback({ text: hasPassword ? "Contraseña cambiada." : "Contraseña creada. Ya puedes entrar también con tu correo y esta contraseña." });
  }

  async function handleSendLink() {
    if (!email) return;
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${RECOVERY_REDIRECT_PATH}`,
    });
    setFeedback(error
      ? { text: "No se pudo enviar el enlace. Inténtalo de nuevo.", danger: true }
      : { text: `Hemos enviado un enlace a ${email}. Ábrelo en este mismo navegador.` });
  }

  const feedbackNode = feedback && (
    <p role="status" className={`mt-2 text-[12px] ${feedback.danger ? "text-[#ff5252]" : "text-[#22B16B]"}`}>{feedback.text}</p>
  );

  if (!isOpen) {
    return (
      <div>
        <div className="flex justify-end">
          <button type="button" onClick={() => { setIsOpen(true); setFeedback(null); }}
            className="min-h-11 rounded-full bg-gma-surface px-4 py-1.5 text-[13px] font-bold text-[#C4C4C4] transition-colors duration-150 hover:bg-gma-border hover:text-white">
            {hasPassword ? "Cambiar" : "Crear contraseña"}
          </button>
        </div>
        {feedbackNode}
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void handleSave(); }}>
      {hasPassword && <PasswordInput label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />}
      <PasswordInput label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" autoFocus={!hasPassword} />
      <PasswordInput label="Repite la nueva contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
      <p className="text-[12px] text-[#7C7C7C]">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => { reset(); setIsOpen(false); setFeedback(null); }}
          className="min-h-11 rounded-full px-4 text-[13px] font-semibold text-[#A8A8A8] hover:text-white">Cancelar</button>
        <button type="submit" disabled={isSaving}
          className="min-h-11 rounded-full bg-[#22B16B] px-5 text-[13px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-50">
          {isSaving ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
      {hasPassword && (
        <button type="button" onClick={() => void handleSendLink()} className="self-start text-[12.5px] font-semibold text-[#5FD39A] underline-offset-4 hover:underline">
          ¿No recuerdas la actual? Te enviamos un enlace
        </button>
      )}
      {feedbackNode}
    </form>
  );
}
