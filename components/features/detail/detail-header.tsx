"use client";

import { ShareAndroid as Share2 } from "@/components/ui/icons";
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
  "flex flex-col items-center justify-center gap-1.5 rounded-[4px] px-3 text-[12px] font-normal lg:text-[14px] lg:font-medium text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:h-10 lg:flex-row lg:gap-2.5 lg:px-3";

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
    <section className="relative isolate lg:min-h-[max(560px,calc(100svh-var(--gma-header-h)-60px))] lg:overflow-hidden">
      {/* Móvil: banda 16:9 a ancho completo (medida en Filmin); escritorio: fondo a sección completa. */}
      <div className="relative aspect-video w-full overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto">
        <PosterArt fill style={movie.style} title={movie.title} kind={movie.kind} ratio="landscape" imageUrl={movie.imageUrl} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] aspect-video bg-[linear-gradient(180deg,rgba(6,6,19,0)_55%,#060613_100%)] lg:inset-0 lg:aspect-auto lg:bg-[linear-gradient(90deg,#060613_0%,rgba(6,6,19,0.86)_26%,rgba(6,6,19,0)_72%),linear-gradient(180deg,rgba(6,6,19,0)_52%,#060613_100%)]"
      />

      <div className="relative z-[2] flex flex-col px-4 pb-8 pt-16 lg:min-h-[inherit] lg:justify-end lg:px-16 lg:pt-40">
        <div className="flex items-end gap-6">
          <div className="hidden aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-[3px] shadow-xl lg:block">
            <PosterArt fill style={movie.style} title={movie.title} kind={movie.kind} ratio="portrait" imageUrl={movie.imageUrl} />
          </div>

          <div className="min-w-0">
            {avgScore !== null && (
              <div className="mb-5 flex items-center gap-3 lg:mb-2">
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-[3px] border border-white px-1.5 text-[18px] font-extrabold leading-none text-white lg:rounded-none lg:text-[20px]">
                  {String(avgScore).replace(".", ",")}
                </span>
                <span className="text-[16px] leading-6 text-white lg:text-[15px] lg:font-medium lg:leading-tight">{voteCount} votos</span>
              </div>
            )}
            <h1 className="text-[32px] font-extrabold leading-9 text-white lg:text-[clamp(32px,3.4vw,48px)] lg:leading-[1.1]">{movie.title}</h1>
            {subtitle && <p className="mt-2.5 text-[18px] leading-[27px] text-white lg:mt-3 lg:text-[22px] lg:font-medium lg:leading-normal">{subtitle}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[16px] leading-6 text-white lg:mt-3 lg:font-medium lg:leading-normal">
              <span>{meta}</span>
              {(movie.tags ?? []).map((t) => (
                <span key={t} className="rounded-[3px] bg-[#242432] px-2 py-0.5 text-[12px] uppercase lg:bg-white/10 lg:font-bold">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {movie.synopsis && (
          <p className="mt-5 hidden line-clamp-3 max-w-[760px] lg:block text-[16px] leading-[1.5] text-[#B8C5D4]">{movie.synopsis}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-[4px] bg-[#22B16B] px-6 text-[20px] font-extrabold uppercase text-[#031A0E] lg:text-[18px] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:min-w-[260px]"
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
