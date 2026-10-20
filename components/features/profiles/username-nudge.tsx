"use client";

import Link from "next/link";
import { useState } from "react";
import { useUserProfile } from "@/hooks/use-user-profile";
import { formatHandle } from "@/lib/profiles/username";

const DISMISSED_KEY = "gma:username-nudge-dismissed";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Invita a elegir el @ mientras se tenga el provisional (`usuario_123456`, sin cambio hecho todavía). Se puede cerrar;
 * desaparece sola en cuanto la persona elige el suyo.
 */
export function UsernameNudge() {
  const { username, usernameChangedAt, isLoaded } = useUserProfile();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!isLoaded || !username || usernameChangedAt !== null || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // sin almacenamiento: se cierra solo hasta recargar
    }
  }

  return (
    <div role="status" className="mb-8 flex max-w-[520px] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 text-center text-[14px] text-[#A8A8A8]">
      <span>
        Tu @ es provisional (<strong className="font-semibold text-white">{formatHandle(username)}</strong>).
      </span>
      <Link href="/configuracion" className="font-bold text-[#5FD39A] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white">
        Elige el tuyo
      </Link>
      <button type="button" onClick={dismiss} aria-label="Ocultar este aviso" className="text-[13px] text-[#7C7C7C] hover:text-white focus-visible:outline-2 focus-visible:outline-white">
        Ahora no
      </button>
    </div>
  );
}
