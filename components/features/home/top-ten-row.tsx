"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { PosterArt } from "@/components/ui/poster-art";
import { SectionHeader } from "@/components/ui/section-header";
import { getDirectorName } from "@/lib/credits";
import { useScrollRow } from "@/hooks/use-scroll-row";
import type { MovieMedia } from "@/types/catalog";

interface TopTenRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly items: readonly MovieMedia[];
  readonly hrefFor: (item: MovieMedia) => string;
}

/** Espera al entrar en una tarjeta antes de expandirla (evita saltos al cruzar la fila con el cursor). */
const EXPAND_DELAY_MS = 90;

const ARROW_CLASS =
  "absolute top-[150px] z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/90 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white group-hover/row:opacity-100 disabled:pointer-events-none disabled:!opacity-0 lg:flex motion-reduce:transition-none";

/** Velo en degradado desde la izquierda (medido en la referencia) para leer el texto sobre la imagen. */
const WIDE_WASH =
  "linear-gradient(90deg, rgba(5,7,10,0.94) 0%, rgba(5,7,10,0.78) 48%, rgba(5,7,10,0.42) 78%, rgba(5,7,10,0.08) 100%), linear-gradient(transparent 55%, rgba(0,0,0,0.5) 100%)";

/**
 * Top 10: una tarjeta ancha (la activa, con descripción y botón de ver) y el resto en formato vertical
 * tipo carátula. Al pasar el cursor por una vertical se expande y la que estaba abierta se recoge.
 * En móvil son solo carátulas verticales.
 */
export function TopTenRow({ title, subtitle, items, hrefFor }: TopTenRowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ref, atStart, atEnd, scrollByPage } = useScrollRow();

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function activate(index: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActiveIndex(index), EXPAND_DELAY_MS);
  }

  function cancelPending() {
    if (timer.current) clearTimeout(timer.current);
  }

  if (items.length === 0) return null;

  return (
    <section className="group/row pt-12 lg:pt-16" aria-label={title}>
      <SectionHeader title={title} subtitle={subtitle} />

      <div className="relative">
        <button
          type="button"
          aria-label="Anterior"
          disabled={atStart}
          onClick={() => scrollByPage(-1)}
          className={`${ARROW_CLASS} left-4`}
        >
          <GmaIcon name="chevronLeft" size={22} />
        </button>

        <div
          ref={ref}
          className="flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scroll-padding-inline:12px] [scrollbar-width:none] lg:px-16 lg:[scroll-padding-inline:64px] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_4%,black_96%,transparent_100%)] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const href = hrefFor(item);
            const director = getDirectorName(item);
            const category = item.categories.find((c) => c !== "Cortometraje");
            return (
              <article
                key={item.id}
                className={`group/slot shrink-0 snap-start transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
                  isActive ? "w-[140px] lg:w-[616px]" : "w-[140px] lg:w-[200px]"
                }`}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") activate(index); }}
                onPointerLeave={cancelPending}
                onFocusCapture={() => setActiveIndex(index)}
              >
                <div className="relative h-[210px] overflow-hidden rounded-[8px] lg:h-[300px]">
                  <div className="absolute inset-0">
                    <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
                  </div>

                  {/* Velo y contenido de la tarjeta ancha (solo escritorio) */}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 hidden transition-opacity duration-500 motion-reduce:transition-none lg:block ${isActive ? "opacity-100" : "opacity-0"}`}
                    style={{ background: WIDE_WASH }}
                  />

                  <Link href={href} aria-label={item.title} className="absolute inset-0 z-[1] rounded-[8px] outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-[#22B16B]" />

                  <span className="pointer-events-none absolute left-0 top-0 z-[2] flex h-9 w-[30px] flex-col items-center justify-center rounded-br-[8px] bg-[#22B16B] font-extrabold leading-none text-[#031A0E]">
                    <span className="text-[8px] uppercase tracking-wide">Top</span>
                    <span className="text-[13px]">{index + 1}</span>
                  </span>

                  {isActive && (
                    <div className="pointer-events-none absolute inset-0 z-[2] hidden flex-col justify-center gap-2 p-4 pl-5 lg:flex" style={{ animation: "fadeIn 400ms ease 150ms both" }}>
                      <h3 className="line-clamp-2 max-w-[474px] text-[34px] font-extrabold uppercase leading-[1] text-white">{item.title}</h3>
                      {director && <p className="text-[12px] text-[#8A94A6]">{director}</p>}
                      {item.synopsis && (
                        <p className="line-clamp-4 max-w-[474px] text-[12.5px] leading-[1.55] text-[#EEF1F6]/75">{item.synopsis}</p>
                      )}
                      <Link
                        href={`/ver/${item.id}`}
                        className="pointer-events-auto mt-2 inline-flex h-8 w-fit items-center gap-2 rounded-[4px] bg-[#22B16B] px-3 text-[12.5px] font-semibold text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        <GmaIcon name="play" size={12} />
                        Ver ahora
                      </Link>
                    </div>
                  )}
                </div>

                <Link href={href} tabIndex={-1} aria-hidden="true" className="mt-2.5 block px-0.5">
                  <span className="line-clamp-1 block text-[13px] font-medium leading-snug text-[#EEF1F6] transition-colors duration-200 group-hover/slot:text-[#22B16B] motion-reduce:transition-none">
                    {item.title}
                  </span>
                  <span className="mt-1 flex items-center gap-x-1.5 text-[11px] leading-[11px] text-[#8A94A6]">
                    <span className="tabular-nums">{item.year}</span>
                    {category && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="line-clamp-1">{category}</span>
                      </>
                    )}
                  </span>
                </Link>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Siguiente"
          disabled={atEnd}
          onClick={() => scrollByPage(1)}
          className={`${ARROW_CLASS} right-4`}
        >
          <GmaIcon name="chevronRight" size={22} />
        </button>
      </div>
    </section>
  );
}
