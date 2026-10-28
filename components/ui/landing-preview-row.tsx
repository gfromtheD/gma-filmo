"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { PosterArt } from "@/components/ui/poster-art";
import { LandingHoverPreview } from "@/components/ui/landing-hover-preview";
import { useHoverPreview } from "@/hooks/use-hover-preview";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import type { MovieMedia } from "@/types/catalog";

const SMALL_ARROW_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-transparent hover:bg-white hover:text-gma-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58D99B]";
/** Qué fracción del ancho visible avanza cada pulsación de flecha. */
const PAGE_FRACTION = 0.92;
/** Cuánto tras el último evento de scroll se considera que ya se ha asentado, para recolocar sin que se note. */
const SETTLE_MS = 150;

/** Una portada de la fila: en el móvil, tocarla pide acceso; en el ordenador, al pasar el cursor (con la misma
 *  espera y animación que en Inicio) se despliega la vista previa con la sinopsis y las dos formas de entrar. */
function PreviewTile({ item, onRequestLogin }: { readonly item: MovieMedia; readonly onRequestLogin: () => void }) {
  const preview = useHoverPreview<HTMLDivElement>(true);

  return (
    <div
      ref={preview.anchorRef}
      className="relative w-[clamp(260px,34vw,420px)] shrink-0 snap-start"
      onPointerEnter={preview.onPointerEnter}
      onPointerLeave={preview.onPointerLeave}
    >
      <button
        type="button"
        onClick={onRequestLogin}
        aria-label={`${item.title}: inicia sesión para ver`}
        className="block w-full rounded-[6px] text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#22B16B]"
      >
        <PosterArt style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
      </button>

      {preview.anchorBox && (
        <LandingHoverPreview
          item={item}
          anchorBox={preview.anchorBox}
          onPointerEnter={preview.keepOpen}
          onPointerLeave={preview.scheduleClose}
          onClose={preview.dismiss}
          isClosing={preview.isClosing}
          onRequestLogin={onRequestLogin}
        />
      )}
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
 *  lo que un visitante puede hacer — entrar.
 *
 *  Las flechas van junto al título (no encima de las portadas, para no estorbar la vista previa al pasar el
 *  cursor) y la fila es una «rueda» infinita: la lista se triplica y, cada vez que el scroll se asienta fuera de
 *  la copia del medio, se recoloca al instante (sin animación) a la copia equivalente — como las copias son
 *  idénticas, no se nota el salto y da la sensación de que el carrusel no se acaba nunca. */
export function LandingPreviewRow({ title, items, onRequestLogin }: LandingPreviewRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const setWidthRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoop = items.length > 1;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !isLoop) return;
    const setWidth = el.scrollWidth / 3;
    setWidthRef.current = setWidth;
    el.scrollLeft = setWidth;
  }, [isLoop, items.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isLoop) return;
    function handleScroll() {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const setWidth = setWidthRef.current;
        if (!setWidth || !el) return;
        if (el.scrollLeft >= setWidth * 2) el.scrollLeft -= setWidth;
        else if (el.scrollLeft < setWidth) el.scrollLeft += setWidth;
      }, SETTLE_MS);
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [isLoop]);

  if (!items.length) return null;
  const loopItems = isLoop ? [...items, ...items, ...items] : items;

  // Antes de cada pulsación (clics seguidos y rápidos incluidos) se recoloca al instante si hace falta: así nunca
  // se acumula fuera de la copia del medio esperando a que el scroll "se asiente".
  function normalizePosition() {
    const el = scrollRef.current;
    const setWidth = setWidthRef.current;
    if (!el || !setWidth) return;
    if (el.scrollLeft >= setWidth * 2) el.scrollLeft -= setWidth;
    else if (el.scrollLeft < setWidth) el.scrollLeft += setWidth;
  }

  function scrollPrev() {
    normalizePosition();
    scrollRef.current?.scrollBy({ left: -(scrollRef.current?.clientWidth ?? 0) * PAGE_FRACTION, behavior: "smooth" });
  }

  function scrollNext() {
    normalizePosition();
    scrollRef.current?.scrollBy({ left: (scrollRef.current?.clientWidth ?? 0) * PAGE_FRACTION, behavior: "smooth" });
  }

  return (
    <section aria-label={title} className="py-8 sm:py-10">
      <div className="flex items-center justify-between gap-4 px-6 sm:px-10 lg:px-16">
        <h2 className="text-[20px] font-bold text-white">{title}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={scrollPrev} aria-label={`${title}: anterior`} className={SMALL_ARROW_CLASS}>
            <ArrowLeft size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={scrollNext} aria-label={`${title}: siguiente`} className={SMALL_ARROW_CLASS}>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="mt-4 flex gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [scrollbar-width:none] snap-x snap-mandatory sm:gap-4 sm:px-10 lg:px-16 [&::-webkit-scrollbar]:hidden">
        {loopItems.map((item, i) => (
          <PreviewTile key={`${item.id}-${i}`} item={item} onRequestLogin={onRequestLogin} />
        ))}
      </div>
    </section>
  );
}
