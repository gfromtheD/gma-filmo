"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { SectionHeader } from "@/components/ui/section-header";

/** Formato de celda en móvil (fracción del ancho útil), medido en Filmin: panorámica pequeña 1/2, grande 1/1, cartel 1/3. */
export type CarouselMobileSize = "frame" | "wide" | "poster";

const MOBILE_BASIS: Record<CarouselMobileSize, string> = {
  frame: "basis-1/2",
  wide: "basis-full",
  poster: "basis-1/3",
};

interface CarouselProps {
  readonly title: string;
  /** Línea secundaria bajo el título (qué contiene la fila). */
  readonly subtitle?: string;
  readonly mobileSize?: CarouselMobileSize;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

const ARROW_CLASS =
  "absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/90 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white group-hover/row:opacity-100 disabled:pointer-events-none disabled:!opacity-0 lg:flex motion-reduce:transition-none";

/**
 * Fila horizontal con scroll-snap. El ancho de cada tarjeta es una fracción del
 * ancho útil (2 / 3 / 4 / 5 columnas según el ancho de la ventana), de modo que
 * la composición se mantiene al redimensionar. Las flechas reflejan los extremos.
 */
export function Carousel({ title, subtitle, action, children, mobileSize = "frame" }: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateEdges);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      observer?.disconnect();
    };
  }, [updateEdges]);

  function scrollByPage(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section className="group/row pt-12 lg:pt-16">
      <SectionHeader title={title} subtitle={subtitle} action={action} />

      <div className="relative">
        <button
          type="button"
          aria-label="Anterior"
          disabled={edges.atStart}
          onClick={() => scrollByPage(-1)}
          className={`${ARROW_CLASS} left-4`}
        >
          <GmaIcon name="chevronLeft" size={22} />
        </button>

        <div
          ref={scrollRef}
          role="region"
          aria-label={title}
          tabIndex={0}
          className="flex min-w-0 snap-x snap-mandatory focus-visible:outline-2 focus-visible:outline-[#22B16B] overflow-x-auto scroll-smooth px-3 [scroll-padding-inline:12px] [scrollbar-width:none] md:gap-1.5 md:px-12 lg:px-20 xl:px-24 md:[scroll-padding-inline:48px] lg:[scroll-padding-inline:80px] xl:[scroll-padding-inline:96px] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_5%,black_95%,transparent_100%)] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto"
        >
          {Children.map(children, (child) => (
            <div className={`shrink-0 ${MOBILE_BASIS[mobileSize]} snap-start px-1 sm:basis-1/3 md:w-[320px] md:basis-auto md:px-0.5`}>
              {child}
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Siguiente"
          disabled={edges.atEnd}
          onClick={() => scrollByPage(1)}
          className={`${ARROW_CLASS} right-4`}
        >
          <GmaIcon name="chevronRight" size={22} />
        </button>
      </div>
    </section>
  );
}
