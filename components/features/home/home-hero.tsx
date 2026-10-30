"use client";

import { useEffect, useRef } from "react";
import { useHeroSuspended } from "@/hooks/use-hero-suspended";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getDirectorName } from "@/lib/credits";
import { useHeroTrailer } from "@/hooks/use-hero-trailer";
import { TrailerVideo } from "@/components/ui/trailer-video";
import { trailerEndpointFor } from "@/lib/media/player-adapter";
import type { MovieMedia } from "@/types/catalog";

interface HomeHeroProps {
  readonly item: MovieMedia;
  readonly detailHref: string;
  readonly canNavigate: boolean;
  readonly onPlay: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  /** Avisa de que un tráiler ocupa el hero (para no pasar de diapositiva mientras suena). */
  readonly onTrailerActiveChange?: (isActive: boolean) => void;
  /** El tráiler terminó: el carrusel puede avanzar. */
  readonly onTrailerEnded?: () => void;
  /** Copia saliente durante el fundido: sin tráiler, sin interacción, superpuesta a la nueva. */
  readonly isOverlay?: boolean;
  /** Llega tras un cambio de portada: el texto espera a que el anterior se haya ido y entra suave. */
  readonly isTransition?: boolean;
}

/** El volumen sale desde el centro del botón de pausa (su alto, 40 px, más la separación de 8 px). */
const VOLUME_OFFSET_PX = 48;

const ROUND_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Hero de portada a pantalla completa, bajo la cabecera transparente.
 * Contenido alineado a la izquierda en escritorio y centrado en móvil.
 */
/** Lo mínimo que hay que arrastrar el dedo para que cuente como deslizamiento. */
const SWIPE_MIN_PX = 48;

export function HomeHero({
  item,
  detailHref,
  canNavigate,
  onPlay,
  onPrev,
  onNext,
  onTrailerActiveChange,
  onTrailerEnded,
  isOverlay = false,
  isTransition = false,
}: HomeHeroProps) {
  const director = getDirectorName(item);
  const reduceMotion = useReducedMotion();
  const trailerEndpoint = trailerEndpointFor(item);
  const sectionRef = useRef<HTMLElement>(null);
  const isSuspended = useHeroSuspended(sectionRef);
  const trailer = useHeroTrailer(isOverlay ? undefined : item.trailerUrl ?? trailerEndpoint ?? undefined, isSuspended);

  useEffect(() => {
    onTrailerActiveChange?.(trailer.isActive);
    return () => onTrailerActiveChange?.(false);
  }, [trailer.isActive, onTrailerActiveChange]);


  // En móvil se pasa de portada deslizando el dedo hacia los lados (sin flechas). Cuenta como deslizamiento un gesto
  // claramente horizontal; uno vertical sigue siendo el scroll de la página.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeEnabled = canNavigate && !isOverlay;

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="Destacados"
      onTouchStart={swipeEnabled ? (event) => {
        const touch = event.touches[0];
        touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      } : undefined}
      onTouchEnd={swipeEnabled ? (event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0];
        touchStart.current = null;
        if (!start || !end) return;
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) onNext(); else onPrev();
      } : undefined}
      className={isOverlay ? "absolute inset-0" : "relative -mt-14 h-[clamp(520px,85vh,900px)] w-full touch-pan-y lg:-mt-16"}
    >
      {/* Imagen más alta que el hero (+20vh) con máscara: se desvanece hacia el resplandor ambiental */}
      <div
        className="absolute inset-x-0 top-0 z-0 overflow-hidden"
        style={{
          height: "calc(100% + 20vh)",
          animation: isOverlay ? undefined : "fadeIn 1000ms ease both",
          maskImage: "linear-gradient(to bottom, black 40%, transparent 98%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 98%)",
        }}
      >
        <PosterArt fill anchor="top" priority style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
        {/* Tráiler opcional: se funde sobre la portada cuando empieza a reproducirse */}
        {trailer.hasTrailer && trailer.isMounted && (
          <TrailerVideo
            videoRef={trailer.videoRef}
            src={item.trailerUrl}
            endpoint={trailerEndpoint}
            autoPlay
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={trailer.handlers.onPlaying}
            onPause={trailer.handlers.onPause}
            onEnded={() => {
              // Una sola vez por reproducción (evento del vídeo), nunca desde un efecto.
              trailer.handlers.onEnded();
              onTrailerEnded?.();
            }}
            onError={trailer.handlers.onError}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${
              trailer.isVisible ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Legibilidad: cabecera arriba, texto a la izquierda y base algo más oscura; el fundido al fondo lo hace la máscara de la imagen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--gma-bg) 60%, transparent) 0%, color-mix(in srgb, var(--gma-bg) 0%, transparent) 22%), linear-gradient(90deg, color-mix(in srgb, var(--gma-bg) 60%, transparent) 0%, color-mix(in srgb, var(--gma-bg) 0%, transparent) 55%), linear-gradient(0deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 50%)",
          }}
        />
      </div>

      <div
        role="group"
        aria-roledescription="slide"
        className={`relative z-[2] flex h-full flex-col items-center justify-end px-4 pb-20 text-center lg:items-start lg:px-16 lg:pb-24 lg:text-left ${
          isOverlay ? "hero-text-out" : isTransition ? "hero-text-in" : ""
        }`}
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

      {trailer.showControl && (
        // El botón de pausa/reproducir no se mueve: el de volumen nace de él hacia arriba mientras el tráiler suena y vuelve a
        // él al pausarlo. Va encima (no debajo) porque abajo en el móvil queda pegado al borde.
        <div className="absolute bottom-6 right-4 z-[3] lg:bottom-16 lg:right-16">
          <button
            type="button"
            onClick={trailer.toggle}
            aria-label={trailer.isPlaying ? "Pausar tráiler" : "Reproducir tráiler"}
            aria-pressed={trailer.isPlaying}
            className={`${ROUND_BUTTON} relative z-[1]`}
          >
            <GmaIcon name={trailer.isPlaying ? "pause" : "play"} size={18} />
          </button>
          <AnimatePresence initial={false}>
            {trailer.isPlaying && (
              <motion.button
                key="volumen"
                type="button"
                onClick={trailer.toggleMute}
                aria-label={trailer.isMuted ? "Activar el sonido del tráiler" : "Silenciar el tráiler"}
                aria-pressed={!trailer.isMuted}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: VOLUME_OFFSET_PX, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: VOLUME_OFFSET_PX, scale: 0.6 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`${ROUND_BUTTON} absolute bottom-full left-0 mb-2`}
              >
                <GmaIcon name={trailer.isMuted ? "mute" : "volume"} size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

    </section>
  );
}
