"use client";

import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
 * Fila horizontal con scroll-snap. Desde 768 px cada celda se calcula para que quepan N tarjetas completas más
 * un trozo (0,16) de la siguiente, que invita a deslizar (medido en Filmin: 438 px de celda a 1440 px). N = 2 en
 * tableta, 3 desde 1000 px y 4 desde 1500 px; la imagen es 16:9 y deja 8 px a cada lado. Las flechas reflejan los
 * extremos.
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

  // Si las tarjetas se reordenan (por ejemplo al llegar los datos del usuario), el scroll-snap del navegador sigue
  // a la tarjeta que estaba primero a su nueva posición y la fila arranca a mitad. Se vuelve al principio; si solo
  // se añaden tarjetas al final, no se toca.
  const keys = Children.toArray(children).map((child) => (isValidElement(child) ? String(child.key) : ""));
  const previousKeys = useRef(keys);
  useLayoutEffect(() => {
    const previous = previousKeys.current;
    previousKeys.current = keys;
    const el = scrollRef.current;
    if (!el) return;
    const onlyAppended = previous.length <= keys.length && previous.every((key, i) => key === keys[i]);
    if (!onlyAppended) el.scrollTo({ left: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join("|")]);

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
          className="flex min-w-0 snap-x snap-mandatory focus-visible:outline-2 focus-visible:outline-[#22B16B] overflow-x-auto scroll-smooth px-3 [scroll-padding-inline:12px] [scrollbar-width:none] md:px-2 lg:px-14 md:[scroll-padding-inline:8px] lg:[scroll-padding-inline:56px] [--n:2] min-[1000px]:[--n:3] min-[1500px]:[--n:4] [--pad-r:8px] lg:[--pad-r:56px] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_5%,black_95%,transparent_100%)] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto"
        >
          {Children.map(children, (child) => (
            <div className={`shrink-0 ${MOBILE_BASIS[mobileSize]} snap-start px-1 sm:basis-1/3 md:w-[calc((100%+var(--pad-r))/(var(--n)+0.16))] md:basis-auto md:px-2`}>
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
