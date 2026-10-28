"use client";

import { useState } from "react";
import { PosterArt } from "@/components/ui/poster-art";
import { workPath } from "@/lib/catalog/work-path";
import { enterAsGuest } from "@/lib/auth/guest-access";
import type { MovieMedia } from "@/types/catalog";

const CTA_CLASS =
  "flex min-h-9 items-center justify-center rounded-full px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** Una portada de la fila: en el móvil, tocarla pide acceso; en el ordenador, al pasar el cursor se ofrece entrar. */
function PreviewTile({ item, onRequestLogin }: { readonly item: MovieMedia; readonly onRequestLogin: () => void }) {
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState(false);

  async function watchAsGuest() {
    setGuestLoading(true);
    setGuestError(false);
    try {
      await enterAsGuest(workPath(item));
    } catch {
      setGuestError(true);
      setGuestLoading(false);
    }
  }

  return (
    <div className="group/tile relative w-[clamp(220px,32vw,320px)] shrink-0 snap-start">
      <button
        type="button"
        onClick={onRequestLogin}
        aria-label={`${item.title}: inicia sesión para ver`}
        className="block w-full rounded-[6px] text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#22B16B] sm:pointer-events-none"
      >
        <PosterArt style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
      </button>

      {/* Solo en ordenador (hover de verdad): al pasar el cursor, la ficha ofrece entrar en vez de reproducir. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden flex-col justify-end rounded-[6px] bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100 sm:flex"
      >
        <p className="truncate text-[13.5px] font-bold text-white">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/75">{item.synopsis}</p>
        <div className="mt-2.5 flex gap-1.5">
          <button type="button" onClick={onRequestLogin} className={`${CTA_CLASS} flex-1 bg-white text-gma-surface-2 hover:bg-white/90`}>
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => void watchAsGuest()}
            disabled={guestLoading}
            className={`${CTA_CLASS} flex-1 border border-white/30 bg-transparent text-white hover:bg-white/10 disabled:opacity-60`}
          >
            {guestLoading ? "Entrando…" : "Ver como invitado"}
          </button>
        </div>
        {guestError && <p role="alert" className="mt-1.5 text-[11px] text-red-300">No se pudo entrar. Inténtalo de nuevo.</p>}
      </div>
    </div>
  );
}

interface LandingPreviewRowProps {
  readonly title: string;
  readonly items: readonly MovieMedia[];
  /** Abre el panel de acceso (el mismo «Elige cómo entrar» de siempre). */
  readonly onRequestLogin: () => void;
}

/** Fila horizontal de avance del catálogo para quien todavía no ha entrado: sin guardar en lista ni valoración, solo
 *  lo que un visitante puede hacer — entrar. */
export function LandingPreviewRow({ title, items, onRequestLogin }: LandingPreviewRowProps) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="py-8 sm:py-10">
      <h2 className="px-6 text-[20px] font-bold text-white sm:px-10 lg:px-16">{title}</h2>
      <div className="mt-4 flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] snap-x snap-mandatory sm:gap-4 sm:px-10 lg:px-16 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <PreviewTile key={item.id} item={item} onRequestLogin={onRequestLogin} />
        ))}
      </div>
    </section>
  );
}
