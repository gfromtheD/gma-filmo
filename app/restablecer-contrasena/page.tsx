"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/features/settings/password-fields";
import { MIN_PASSWORD_LENGTH, passwordErrorMessage, validateNewPassword } from "@/lib/auth/password";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Página a la que lleva el enlace del correo: aquí se elige la nueva contraseña (la sesión ya viene del enlace). */
export default function RestablecerContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit() {
    const invalid = validateNewPassword(password, confirmation);
    if (invalid) { setError(invalid); return; }
    setIsSaving(true);
    setError("");
    const { error: err } = await getSupabaseBrowserClient().auth.updateUser({ password });
    setIsSaving(false);
    if (err) { setError(passwordErrorMessage(err)); return; }
    setIsDone(true);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-black px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
        <Image src="/images/logo-gma.png" alt="GMA Filmo" height={64} width={200} className="h-14 w-auto" />
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md">
          {isDone ? (
            <>
              <h1 className="text-[22px] font-extrabold text-white">Contraseña cambiada</h1>
              <p className="mt-2 text-[14px] text-[#C4C4C4]">Ya puedes usar tu nueva contraseña para entrar.</p>
              <button type="button" onClick={() => { router.push("/perfiles"); router.refresh(); }}
                className="mt-6 min-h-11 w-full rounded-full bg-[#22B16B] text-[14px] font-bold text-[#031A0E] hover:bg-[#2AC57A]">
                Continuar
              </button>
            </>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
              <div>
                <h1 className="text-[22px] font-extrabold text-white">Elige una nueva contraseña</h1>
                <p className="mt-1.5 text-[13.5px] text-[#A8A8A8]">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
              </div>
              <PasswordInput label="Nueva contraseña" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
              <PasswordInput label="Repite la nueva contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
              {error && <p role="alert" className="text-[12.5px] text-[#ff5252]">{error}</p>}
              <button type="submit" disabled={isSaving}
                className="min-h-11 rounded-full bg-[#22B16B] text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-50">
                {isSaving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
