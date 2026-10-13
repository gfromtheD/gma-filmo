"use client";

import { Share2 } from "lucide-react";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getDirectorName } from "@/lib/credits";
import type { MovieMedia } from "@/types/catalog";

interface DetailHeaderProps {
  readonly movie: MovieMedia;
  readonly avgScore: number | null;
  readonly voteCount: number;
  readonly inList: boolean;
  readonly onPlay: () => void;
  readonly onToggleList: () => void;
  readonly onRate: () => void;
  readonly onShare: () => void;
}

const TERTIARY =
  "flex flex-col items-center justify-center gap-1.5 rounded-[4px] px-3 text-[14px] font-medium text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:h-10 lg:flex-row lg:gap-2.5 lg:px-3";

/**
 * Cabecera de ficha: imagen a todo ancho con fundidos, póster, nota de la
 * comunidad, título, metadatos, sinopsis y acciones. Solo presentación.
 */
export function DetailHeader({
  movie,
  avgScore,
  voteCount,
  inList,
  onPlay,
  onToggleList,
  onRate,
  onShare,
}: DetailHeaderProps) {
  const director = getDirectorName(movie);
  const genre = movie.categories.find((c) => c !== "Cortometraje") ?? movie.genre ?? null;
  const subtitle = [director, genre].filter(Boolean).join(" · ");
  const meta = [String(movie.year), movie.runtime].filter(Boolean).join(" · ");

  return (
    <section className="relative isolate min-h-[max(560px,calc(100svh-var(--gma-header-h)-60px))] overflow-hidden">
      <div className="absolute inset-0">
        <PosterArt fill style={movie.style} title={movie.title} kind={movie.kind} ratio="landscape" imageUrl={movie.imageUrl} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(90deg, #060613 0%, rgba(6,6,19,0.86) 26%, rgba(6,6,19,0) 72%), linear-gradient(180deg, rgba(6,6,19,0) 52%, #060613 100%)",
        }}
      />

      <div className="relative z-[2] flex min-h-[inherit] flex-col justify-end px-4 pb-8 pt-40 lg:px-16">
        <div className="flex items-end gap-6">
          <div className="hidden aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-[3px] shadow-xl lg:block">
            <PosterArt fill style={movie.style} title={movie.title} kind={movie.kind} ratio="portrait" imageUrl={movie.imageUrl} />
          </div>

          <div className="min-w-0">
            {avgScore !== null && (
              <div className="mb-2 flex items-center gap-3">
                <span className="inline-flex h-10 min-w-10 items-center justify-center border border-white px-1.5 text-[20px] font-extrabold leading-none text-white">
                  {String(avgScore).replace(".", ",")}
                </span>
                <span className="text-[15px] font-medium leading-tight text-white">{voteCount} votos</span>
              </div>
            )}
            <h1 className="text-[clamp(32px,3.4vw,48px)] font-extrabold leading-[1.1] text-white">{movie.title}</h1>
            {subtitle && <p className="mt-3 text-[18px] font-medium text-white lg:text-[22px]">{subtitle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[16px] font-medium text-white">
              <span>{meta}</span>
              {(movie.tags ?? []).map((t) => (
                <span key={t} className="rounded-[3px] bg-white/10 px-2 py-0.5 text-[12px] font-bold uppercase">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {movie.synopsis && (
          <p className="mt-5 line-clamp-3 max-w-[760px] text-[16px] leading-[1.5] text-[#B8C5D4]">{movie.synopsis}</p>
        )}

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-[4px] bg-[#22B16B] px-6 text-[18px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:min-w-[260px]"
          >
            <GmaIcon name="play" size={20} />
            Ver ahora
          </button>

          <div className="grid grid-cols-3 gap-1 lg:ml-auto lg:flex lg:gap-3">
            <button type="button" onClick={onToggleList} aria-pressed={inList} className={`${TERTIARY} h-16`}>
              <GmaIcon name={inList ? "check" : "bookmark"} size={22} />
              {inList ? "Guardada" : "Guardar"}
            </button>
            <button type="button" onClick={onRate} className={`${TERTIARY} h-16`}>
              <GmaIcon name="star" size={22} />
              Valorar
            </button>
            <button type="button" onClick={onShare} className={`${TERTIARY} h-16`}>
              <Share2 size={22} aria-hidden="true" />
              Compartir
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
