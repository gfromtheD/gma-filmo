"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { SaveIcon } from "@/components/ui/save-icon";
import type { MediaItem, MovieMedia } from "@/types/catalog";

interface HeroProps {
  readonly item: MediaItem;
  readonly onPlay?: () => void;
  readonly onTrailer?: () => void;
  readonly onDetail?: () => void;
  readonly onAddList?: () => void;
  readonly inList?: boolean;
  readonly tag?: string;
  readonly backHref?: string;
}

function shortText(synopsis: string, tagline?: string): string {
  if (!tagline) return synopsis;
  return tagline.length <= synopsis.length ? tagline : synopsis;
}

// ─── Credits line ─────────────────────────────────────────────────────────────

function HeroCredits({ item }: { item: MediaItem }) {
  if (item.kind !== "movie") return null;
  const movie = item as MovieMedia;

  // Prefer structured artistas from DB
  let director: string | null = null;
  let illustrator: string | null = null;
  let directorSlug: string | null = null;
  let illustratorSlug: string | null = null;

  if (movie.artistas && movie.artistas.length > 0) {
    const directorCredit = movie.artistas.find((a) => /creador|director/i.test(a.role)) ?? movie.artistas[0];
    const illustratorCredit = movie.artistas.find((a) => /ilustrador|illustrator/i.test(a.role));
    director = directorCredit?.name ?? null;
    directorSlug = directorCredit?.slug ?? null;
    illustrator = illustratorCredit?.name ?? null;
    illustratorSlug = illustratorCredit?.slug ?? null;
  } else if (movie.author) {
    const creado = movie.author.match(/Creado por:\s*([^;]+)/i);
    const ilustr = movie.author.match(/Ilustraci[oó]n por:\s*([^;]+)/i);
    if (creado || ilustr) {
      director    = creado?.[1]?.trim() ?? null;
      illustrator = ilustr?.[1]?.trim() ?? null;
    } else {
      director = movie.author.trim();
    }
  }

  if (!director && !illustrator) return null;

  // If only one name exists, always show it as director
  if (!director && illustrator) {
    director    = illustrator;
    directorSlug = illustratorSlug;
    illustrator = null;
  }

  const parts = [
    ...(director ? [{ role: "Dirigido por", name: director, slug: directorSlug }] : []),
    ...(illustrator && illustrator !== director ? [{ role: "Ilustrado por", name: illustrator, slug: illustratorSlug }] : []),
  ];

  return (
    <div className="mt-4 flex flex-col gap-1">
      {parts.map(({ role, name, slug }) => (
        <p key={`${role}-${name}`} className="break-words text-[13px] text-[#C4C4C4]">
          {role} {slug ? <Link href={`/creadores/${encodeURIComponent(slug)}`} className="transition-colors hover:text-[#22B16B] hover:underline">{name}</Link> : name}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Hero({ item, onPlay, onTrailer, onDetail, onAddList, inList, tag, backHref }: HeroProps) {
  const seasons = item.kind === "series" ? item.seasons : undefined;
  const runtime = item.kind === "movie" ? item.runtime : undefined;

  return (
    <section
      className="relative isolate w-full overflow-hidden"
    >
      {/* Poster art fills the background — fadeIn on mount to crossfade between slides */}
      <div className="absolute inset-0 [&>div]:h-full" style={{ animation: "fadeIn 1.1s ease both" }}>
        <PosterArt style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
      </div>

      {/* Back arrow */}
      {backHref && (
        <Link
          href={backHref}
          aria-label="Volver al catálogo"
          className="absolute left-4 top-5 flex h-11 w-11 sm:left-6 lg:left-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          style={{ zIndex: 3 }}
        >
          <GmaIcon name="chevronLeft" size={18} />
        </Link>
      )}

      {/* Legibility gradients: left + bottom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 30%, transparent 60%), linear-gradient(180deg, transparent 40%, #000000 100%)",
          zIndex: 1,
        }}
      />

      {/* Content — left column, pinned to bottom */}
      <div
        className="relative flex min-h-[520px] items-end pb-8 pt-24 sm:min-h-[600px] sm:pb-14 sm:pt-28"
        style={{ zIndex: 2 }}
      >
        <div className="mx-auto w-full min-w-0 max-w-360 px-4 sm:px-6 lg:px-8">
          <motion.div
            style={{ maxWidth: 580 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Eyebrow label */}
            <div className="mb-3 break-words text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C7C7C]">
              {tag ?? item.tag ?? "DESTACADO"}
            </div>

            {/* Title */}
            <h1
              className="break-words text-[clamp(2rem,6vw,4rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-white"
            >
              {item.title}
            </h1>

            {/* Meta row */}
            <div className="my-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:my-4.5 text-[14px] font-semibold text-[#C4C4C4]">
              {item.kind === "movie" && (item as MovieMedia).approvalScore != null && (
                <span className="font-extrabold text-[#22B16B]">
                  {(item as MovieMedia).approvalScore}%
                </span>
              )}
              <span>{item.year}</span>
              {seasons != null && <span>{seasons} temp.</span>}
              {runtime != null && <span>{runtime}</span>}
                {item.tags?.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="max-w-full break-words rounded border border-gma-border px-2 py-0.75 text-[11px] tracking-[0.06em] text-[#C4C4C4]"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Tagline / hook */}
            {item.synopsis && (
              <p className="break-words text-sm leading-[1.55] text-[#DDE3DF] sm:text-[15px]" style={{ maxWidth: 560, marginTop: 8 }}>
                {shortText(item.synopsis, item.tagline)}
              </p>
            )}

            {/* CTAs */}
            <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-7 sm:gap-3">
              {onPlay && (
                <button
                  className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-full bg-[#22B16B] px-4 py-3 sm:px-5.5 text-[14px] font-bold text-gma-accent-fg transition-[transform,background] duration-150 hover:-translate-y-px hover:bg-[#2AC57A] active:scale-[0.96]"
                  onClick={onPlay}
                  type="button"
                >
                  <GmaIcon name="play" size={18} />
                  Ver ahora
                </button>
              )}
              {onTrailer && (
                <button
                  className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-full bg-gma-surface px-4 py-3 sm:px-5.5 text-[14px] font-bold text-white transition-[transform,background] duration-150 hover:-translate-y-px hover:bg-gma-border active:scale-[0.96]"
                  onClick={onTrailer}
                  type="button"
                >
                  <GmaIcon name="film" size={18} />
                  Ver trailer
                </button>
              )}
              {onDetail && (
                <button
                  className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-full bg-white/6 px-4 py-3 sm:px-5.5 text-[14px] font-bold text-white backdrop-blur-sm transition-[transform,background-color,color] duration-150 hover:-translate-y-px hover:bg-white hover:text-gma-surface-2 active:scale-[0.96]"
                  onClick={onDetail}
                  type="button"
                >
                  <GmaIcon name="info" size={18} />
                  Más información
                </button>
              )}
              {onAddList && (
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-[transform,background-color,color] duration-300 active:scale-[0.92]"
                  style={{
                    background: inList ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.06)",
                    color: inList ? "var(--gma-surface-2)" : "white",
                  }}
                  onClick={onAddList}
                  aria-label={inList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}
                  aria-pressed={inList}
                  type="button"
                >
                  <SaveIcon saved={inList ?? false} size={20} />
                </button>
              )}
            </div>

            {/* Credits line */}
            <HeroCredits item={item} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
