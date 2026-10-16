"use client";

import { useState } from "react";
import { ClampedText } from "@/components/features/detail/clamped-text";
import { DetailCard } from "@/components/features/detail/detail-cards";
import { Check } from "@/components/ui/icons";
import type { MovieMedia } from "@/types/catalog";

interface SynopsisCardProps {
  readonly movie: MovieMedia;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** Alto máximo de la tarjeta plegada (el de la columna derecha); `null` en pantallas estrechas. */
  readonly targetHeight: number | null;
}

export function SynopsisCard({ movie, expanded, onToggle, targetHeight }: SynopsisCardProps) {
  const [open,    setOpen]    = useState(false);
  const [text,    setText]    = useState("");
  const [sent,    setSent]    = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      const { data: { session } } = await (await import("@/lib/supabase/browser")).getSupabaseBrowserClient().auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/synopsis-proposals", {
        method: "POST",
        headers,
        body: JSON.stringify({ peliculaId: movie.numericId, proposedText: text.trim() }),
      });
      if (!res.ok) { setError("No se pudo enviar. Inicia sesión e inténtalo de nuevo."); return; }
      setSent(true);
      setOpen(false);
      setText("");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <DetailCard title="Sinopsis" className="lg:flex-1">
      <ClampedText
        text={movie.fullSynopsis ?? movie.synopsis}
        expanded={expanded}
        onToggle={onToggle}
        targetHeight={targetHeight}
        className="whitespace-pre-line break-words text-[15px] leading-[1.7] text-white"
      />

      {/* Aviso de IA + invitación a proponer una sinopsis mejor */}
      {sent ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#22B16B]">
          <Check size={16} strokeWidth={2} aria-hidden="true" />
          Gracias por tu aportación: la revisaremos pronto.
        </p>
      ) : (
        <>
          <p className="mt-4 text-[11px] leading-[1.5] text-[#7C7C7C]">
            <span>Sinopsis generada con IA.</span>{" "}
            ¿No encaja con el corto?{" "}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline cursor-pointer rounded-sm font-semibold underline underline-offset-2 transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Propón una mejor
            </button>
          </p>

          {open && (
            <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-white/10 bg-black/30 p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Tu propuesta de sinopsis"
                placeholder="Escribe aquí la sinopsis correcta para este corto…"
                rows={4}
                className="w-full resize-none rounded-[8px] border border-white/10 bg-gma-surface px-3 py-2.5 text-base leading-[1.6] text-[#DDE3DF] placeholder-[#7C7C7C] outline-none transition-colors focus:border-[#22B16B]/60 sm:text-[14px]"
              />
              {error && <p role="alert" className="text-[12px] text-[#ff7b7b]">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!text.trim() || sending}
                  className="min-h-10 rounded-full bg-[#22B16B] px-5 py-1.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? "Enviando…" : "Enviar propuesta"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-10 rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#BBBBBB] transition-colors hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </DetailCard>
  );
}
