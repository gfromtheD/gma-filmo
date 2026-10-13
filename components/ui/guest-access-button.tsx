"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function GuestAccessButton({ className }: { className: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enterAsGuest() {
    setLoading(true);
    setError("");
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      for (const name of ["gma_creator_pending", "gma_creator_setup"]) {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
      }
      document.cookie = "gma_guest=1; path=/; max-age=86400; SameSite=Lax";
      window.location.assign("/inicio");
    } catch {
      setError("No se pudo entrar como invitado. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button type="button" className={className} disabled={loading} onClick={() => void enterAsGuest()}>
        {loading ? "Entrando…" : "Continuar como invitado"}
      </button>
      {error && <p role="alert" className="text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
