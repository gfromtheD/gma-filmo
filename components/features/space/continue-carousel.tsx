"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { FolderTabFrame } from "@/components/ui/folder-tab-frame";
import { GmaIcon } from "@/components/ui/gma-icon";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/poster-art";
import { FolderColorMenu } from "./folder-color-menu";
import type { MovieMedia } from "@/types/catalog";

export interface ContinueEntry {
  readonly item: MovieMedia;
  /** Cuánto llevas visto, de 0 a 1. */
  readonly progress: number;
}

const ARROW =
  "grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-[opacity,background-color] hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-0";

/**
 * Lo que dejaste a medias, como el contenido de la carpeta «Seguir viendo»: un carrusel cuyas portadas entran una a
 * una desde la carpeta, con la barra de lo que llevas visto. Se recorre con las flechas o deslizando.
 */
export function ContinueCarousel({ entries, color, onColor }: { readonly entries: readonly ContinueEntry[]; readonly color: string; readonly onColor: (hex: string) => void }) {
  const reduceMotion = useReducedMotion();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function measure() {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }
  const page = (direction: 1 | -1) => scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <FolderTabFrame color={color}>
      <section id="mi-lista-panel" aria-label="Seguir viendo" style={{ boxShadow: `inset 0 2px 0 ${color}, inset 0 1px 0 rgba(255,255,255,0.06)` }}
        className="rounded-[8px] rounded-tl-none border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))] p-5 backdrop-blur-xl sm:p-7">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-white">Seguir viendo</h2>
            <p className="text-[13px] tabular-nums text-[#8A8A8A]">{entries.length} {entries.length === 1 ? "obra a medias" : "obras a medias"}</p>
          </div>
          <div className="flex items-center gap-2">
            <FolderColorMenu color={color} onColor={onColor} />
            {entries.length > 1 && (
              <div className="hidden gap-2 sm:flex">
              <button type="button" aria-label="Anteriores" disabled={edges.start} onClick={() => page(-1)} className={ARROW}><ArrowLeft className="size-5" /></button>
              <button type="button" aria-label="Siguientes" disabled={edges.end} onClick={() => page(1)} className={ARROW}><ArrowRight className="size-5" /></button>
              </div>
            )}
          </div>
        </header>

        {entries.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-[8px] border border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-[16px] font-semibold text-white">No tienes nada a medias</p>
            <p className="mt-1.5 max-w-[42ch] text-[14px] leading-6 text-[#A8A8A8]">Cuando dejes una obra sin terminar, aparecerá aquí para retomarla justo donde la dejaste.</p>
            <Link href="/cortos" className="mt-5 inline-flex min-h-11 items-center rounded-[4px] bg-[#22B16B] px-5 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A]">Explorar cortos</Link>
          </div>
        ) : (
          <ul ref={scroller} onScroll={measure} className="-mx-1 mt-6 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
            {entries.map(({ item, progress }, index) => (
              <motion.li key={item.id} className="w-[260px] shrink-0 snap-start sm:w-[300px]"
                initial={reduceMotion ? false : { opacity: 0, x: -48, scale: 0.9, rotate: -2 }} animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.12 + Math.min(index, 6) * 0.07 }}>
                <Link href={`/ver/${item.id}`} className="group block rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <span className="relative block overflow-hidden rounded-[8px] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                    <PosterArt style={item.style} title="" kind="movie" ratio="landscape" imageUrl={item.imageUrl} />
                    <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="grid size-12 place-items-center rounded-full bg-[#22B16B] text-[#031A0E] shadow-[0_8px_24px_-6px_rgba(34,177,107,0.8)]"><GmaIcon name="play" size={20} /></span>
                    </span>
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15"><span className="block h-full" style={{ width: `${Math.round(progress * 100)}%`, background: color }} /></span>
                  </span>
                  <span className="mt-2 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold text-white">{item.title}</span>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-[#5FD39A]">{Math.round(progress * 100)}%</span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </FolderTabFrame>
  );
}
