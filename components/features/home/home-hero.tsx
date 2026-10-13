"use client";

import Link from "next/link";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getDirectorName } from "@/lib/credits";
import type { MovieMedia } from "@/types/catalog";

interface HomeHeroProps {
  readonly item: MovieMedia;
  readonly detailHref: string;
  readonly canNavigate: boolean;
  readonly isPaused: boolean;
  readonly onPlay: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onTogglePause: () => void;
}

const ROUND_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Hero de portada a pantalla completa, bajo la cabecera transparente.
 * Contenido alineado a la izquierda en escritorio y centrado en móvil.
 */
export function HomeHero({
  item,
  detailHref,
  canNavigate,
  isPaused,
  onPlay,
  onPrev,
  onNext,
  onTogglePause,
}: HomeHeroProps) {
  const director = getDirectorName(item);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Destacados"
      className="relative isolate -mt-14 h-[clamp(520px,78vh,720px)] w-full overflow-hidden lg:-mt-16 lg:h-[clamp(520px,69vh,760px)]"
    >
      <div className="absolute inset-0" style={{ animation: "fadeIn 1.1s ease both" }}>
        <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
      </div>

      {/* Legibilidad: cabecera arriba, texto a la izquierda y fundido inferior al fondo de la página */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,6,19,0.78) 0%, rgba(6,6,19,0) 24%), linear-gradient(90deg, rgba(6,6,19,0.72) 0%, rgba(6,6,19,0) 58%), linear-gradient(180deg, rgba(6,6,19,0) 58%, #060613 100%)",
        }}
      />

      <div
        role="group"
        aria-roledescription="slide"
        className="relative z-[2] flex h-full flex-col items-center justify-end px-4 pb-14 text-center lg:items-start lg:px-16 lg:pb-16 lg:text-left"
      >
        <span className="inline-flex h-6 items-center rounded-[3px] bg-[#22B16B] px-2 text-[12px] font-extrabold uppercase text-[#031A0E]">
          {item.tag ?? "Destacado"}
        </span>

        <h1 className="mt-3 line-clamp-4 max-w-[640px] text-[clamp(36px,5.4vw,84px)] font-extrabold uppercase leading-[0.96] text-white">
          <Link href={detailHref} className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            {item.title}
          </Link>
        </h1>

        {director && <p className="mt-3 text-[20px] font-medium text-white lg:text-[24px]">{director}</p>}

        <button
          type="button"
          onClick={onPlay}
          className="mt-6 inline-flex h-10 items-center rounded-[4px] bg-[#22B16B] px-4 text-[16px] font-medium text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Ver ahora
        </button>
      </div>

      {canNavigate && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={onPrev}
            className={`${ROUND_BUTTON} absolute left-3 top-1/2 z-[3] -translate-y-1/2 opacity-70 hover:opacity-100 lg:left-6`}
          >
            <GmaIcon name="chevronLeft" size={22} />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={onNext}
            className={`${ROUND_BUTTON} absolute right-3 top-1/2 z-[3] -translate-y-1/2 opacity-70 hover:opacity-100 lg:right-6`}
          >
            <GmaIcon name="chevronRight" size={22} />
          </button>
          <button
            type="button"
            aria-label={isPaused ? "Reanudar presentación" : "Pausar presentación"}
            aria-pressed={isPaused}
            onClick={onTogglePause}
            className={`${ROUND_BUTTON} absolute bottom-14 right-4 z-[3] hidden lg:bottom-16 lg:right-16 lg:flex`}
          >
            <GmaIcon name={isPaused ? "play" : "pause"} size={18} />
          </button>
        </>
      )}
    </section>
  );
}
