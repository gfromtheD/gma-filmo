"use client";

import { useState } from "react";
import { enterAsGuest } from "@/lib/auth/guest-access";

export function GuestAccessButton({ className }: { className: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setLoading(true);
    setError("");
    try {
      await enterAsGuest("/inicio");
    } catch {
      setError("No se pudo entrar como invitado. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button type="button" className={className} disabled={loading} onClick={() => void go()}>
        {loading ? "Entrando…" : "Continuar como invitado"}
      </button>
      {error && <p role="alert" className="text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
