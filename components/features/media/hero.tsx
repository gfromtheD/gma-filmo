"use client";

import Link from "next/link";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import type { MediaItem, MovieMedia } from "@/types/catalog";

interface HeroProps {
  readonly item: MediaItem;
  readonly onPlay?: () => void;
  readonly onTrailer?: () => void;
  readonly onDetail?: () => void;
  readonly onAddList?: () => void;
  readonly inList?: boolean;
  readonly tag?: string;
  readonly fullSynopsis?: boolean;
  readonly backHref?: string;
}

// ─── Credits line ─────────────────────────────────────────────────────────────

function HeroCredits({ item }: { item: MediaItem }) {
  if (item.kind !== "movie") return null;
  const movie = item as MovieMedia;

  // Prefer structured artistas from DB
  let director: string | null = null;
  let illustrator: string | null = null;

  if (movie.artistas && movie.artistas.length > 0) {
    director    = movie.artistas.find((a) => a.role === "creador")?.name ?? null;
    illustrator = movie.artistas.find((a) => a.role === "ilustrador")?.name ?? null;
  } else if (movie.author) {
    // Fallback: parse "Creado por: X; Ilustración por: Y"
    const creado = movie.author.match(/Creado por:\s*([^;]+)/i);
    const ilustr = movie.author.match(/Ilustraci[oó]n por:\s*([^;]+)/i);
    director    = creado?.[1]?.trim() ?? null;
    illustrator = ilustr?.[1]?.trim() ?? null;
  }

  if (!director && !illustrator) return null;

  // If only one name exists, always show it as director
  if (!director && illustrator) {
    director    = illustrator;
    illustrator = null;
  }

  const parts: string[] = [];
  if (director) parts.push(`Dirigido por ${director}`);
  if (illustrator && illustrator !== director) parts.push(`Ilustrado por ${illustrator}`);

  return (
    <div
      className="mt-4 flex flex-col gap-1"
      style={{ animation: "fadeUp 0.45s ease both", animationDelay: "0.2s" }}
    >
      {parts.map((p) => (
        <p key={p} className="text-[13px] text-[#6D7D94]">{p}</p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Hero({ item, onPlay, onTrailer, onDetail, onAddList, inList, tag, fullSynopsis = false, backHref }: HeroProps) {
  const seasons = item.kind === "series" ? item.seasons : undefined;
  const runtime = item.kind === "movie" ? item.runtime : undefined;

  return (
    <section
      className="relative w-full overflow-hidden isolate"
      style={{ height: 600 }}
    >
      {/* Poster art fills the background — fadeIn on mount to crossfade between slides */}
      <div className="absolute inset-0" style={{ animation: "fadeIn 0.8s ease both" }}>
        <PosterArt style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
      </div>

      {/* Back arrow */}
      {backHref && (
        <Link
          href={backHref}
          className="absolute left-8 top-7 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
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
        className="relative flex h-full items-end pb-14"
        style={{ zIndex: 2 }}
      >
        <div className="mx-auto w-full max-w-360 px-8">
          <div style={{ maxWidth: 580 }}>
            {/* Eyebrow label */}
            <div
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D7D94]"
              style={{ animation: "fadeUp 0.45s ease both" }}
            >
              {tag ?? item.tag ?? "DESTACADO"}
            </div>

            {/* Title */}
            <h1
              className="font-extrabold text-white"
              style={{
                fontSize: 64,
                letterSpacing: "-0.03em",
                lineHeight: 0.96,
                animation: "fadeUp 0.45s ease both",
                animationDelay: "0.05s",
              }}
            >
              {item.title}
            </h1>

            {/* Meta row */}
            <div
              className="my-4.5 flex flex-wrap items-center gap-3.5 text-[14px] font-semibold text-[#B8C5D4]"
              style={{ animation: "fadeUp 0.45s ease both", animationDelay: "0.1s" }}
            >
              {item.kind === "movie" && (item as MovieMedia).approvalScore != null && (
                <span className="font-extrabold text-[#22B16B]">
                  {(item as MovieMedia).approvalScore}%
                </span>
              )}
              <span>{item.year}</span>
              {seasons != null && <span>{seasons} temp.</span>}
              {runtime != null && <span>{runtime}</span>}
              {item.author && (
                <span className="rounded border border-[#262626] px-2 py-0.75 text-[11px] tracking-[0.06em] text-[#B8C5D4]">
                  {item.author}
                </span>
              )}
              {item.tags?.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded border border-[#262626] px-2 py-0.75 text-[11px] tracking-[0.06em] text-[#B8C5D4]"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Tagline / hook — only rendered when there's content */}
            {(fullSynopsis ? item.synopsis : item.tagline) && (
              <p
                className="text-[15px] leading-[1.55] text-[#D9E2EC]"
                style={{
                  maxWidth: 560,
                  marginTop: 8,
                  animation: "fadeUp 0.45s ease both",
                  animationDelay: "0.1s",
                }}
              >
                {fullSynopsis ? item.synopsis : item.tagline}
              </p>
            )}

            {/* CTAs */}
            <div
              className="mt-7 flex flex-wrap gap-3"
              style={{ animation: "fadeUp 0.45s ease both", animationDelay: "0.15s" }}
            >
              {onPlay && (
                <button
                  className="inline-flex items-center gap-2.5 rounded-full bg-[#22B16B] px-5.5 py-3 text-[14px] font-bold text-gma-accent-fg transition-[transform,background] duration-150 hover:-translate-y-px hover:bg-[#2AC57A] active:scale-[0.96]"
                  onClick={onPlay}
                  type="button"
                >
                  <GmaIcon name="play" size={18} />
                  Ver ahora
                </button>
              )}
              {onTrailer && (
                <button
                  className="inline-flex items-center gap-2.5 rounded-full bg-[#1A1A1A] px-5.5 py-3 text-[14px] font-bold text-white transition-[transform,background] duration-150 hover:-translate-y-px hover:bg-[#262626] active:scale-[0.96]"
                  onClick={onTrailer}
                  type="button"
                >
                  <GmaIcon name="film" size={18} />
                  Ver trailer
                </button>
              )}
              {onDetail && (
                <button
                  className="inline-flex items-center gap-2.5 rounded-full bg-white/6 px-5.5 py-3 text-[14px] font-bold text-white backdrop-blur-sm transition-[transform,background-color,color] duration-150 hover:-translate-y-px hover:bg-white hover:text-[#0a0a0a] active:scale-[0.96]"
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
                    color: inList ? "#0a0a0a" : "white",
                  }}
                  onClick={onAddList}
                  aria-label={inList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}
                  type="button"
                >
                  <div className="relative h-5 w-5">
                    <span
                      className="absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-300 ease-in-out"
                      style={{
                        transform: inList ? "rotate(180deg) scale(0.3)" : "rotate(0deg) scale(1)",
                        opacity: inList ? 0 : 1,
                      }}
                    >
                      <GmaIcon name="plus" size={20} />
                    </span>
                    <span
                      className="absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-300 ease-in-out"
                      style={{
                        transform: inList ? "rotate(0deg) scale(1)" : "rotate(-180deg) scale(0.3)",
                        opacity: inList ? 1 : 0,
                      }}
                    >
                      <GmaIcon name="check" size={20} />
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Credits line */}
            <HeroCredits item={item} />
          </div>
        </div>
      </div>
    </section>
  );
}
