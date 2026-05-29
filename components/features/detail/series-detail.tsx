"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hero } from "@/components/features/media/hero";
import { PosterArt } from "@/components/ui/poster-art";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { Episode, SeriesMedia } from "@/types/catalog";

interface SeriesDetailProps {
  readonly series: SeriesMedia;
  readonly episodes: readonly Episode[];
  readonly related: readonly SeriesMedia[];
}

export function SeriesDetail({ series, episodes, related }: SeriesDetailProps) {
  const router = useRouter();
  const { addMedia, removeMedia, hasMedia } = useWatchlist();
  const inList = hasMedia(series.numericId);

  function toggleList() {
    if (inList) removeMedia(series.numericId);
    else addMedia(series.numericId);
  }

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Hero
        item={series}
        onPlay={() => router.push(`/ver/${series.id}`)}
        onAddList={toggleList}
        inList={inList}
      />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-10">
        <div className="grid gap-10" style={{ gridTemplateColumns: "1fr 304px" }}>

          {/* Left: episodes */}
          <div>
            <EpisodesPanel series={series} episodes={episodes} />
          </div>

          {/* Right: meta + related */}
          <aside className="flex flex-col gap-8">
            <MetaCard series={series} />
            {related.length > 0 && <RelatedPanel related={related} onNavigate={(id) => router.push(`/series/${id}`)} />}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Episodes panel ───────────────────────────────────────────────────────────

function EpisodesPanel({ series, episodes }: { series: SeriesMedia; episodes: readonly Episode[] }) {
  const [activeSeason, setActiveSeason] = useState(1);

  const seasonNumbers = Array.from({ length: series.seasons }, (_, i) => i + 1);

  // Only season 1 has real episode data; others get a placeholder
  const displayEpisodes = activeSeason === 1 ? episodes : [];

  return (
    <section>
      <div className="mb-5 flex items-center gap-4">
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">Episodios</h2>

        {/* Season selector — only rendered when there's more than 1 season */}
        {series.seasons > 1 && (
          <div
            className="flex gap-1 rounded-full border border-[#262626] bg-[#0D0D0D] p-1"
          >
            {seasonNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setActiveSeason(n)}
                className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors duration-150 ${
                  activeSeason === n
                    ? "bg-[#22B16B] text-[#03200F]"
                    : "text-[#B8C5D4] hover:text-white"
                }`}
              >
                T{n}
              </button>
            ))}
          </div>
        )}
      </div>

      {displayEpisodes.length > 0 ? (
        <ol className="flex flex-col divide-y divide-[#262626]">
          {displayEpisodes.map((ep) => (
            <EpisodeRow key={ep.n} ep={ep} seriesStyle={series.style} />
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#262626] bg-[#0D0D0D] py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A1A] text-[#6D7D94]">
            <GmaIcon name="series" size={22} />
          </div>
          <p className="text-[14px] font-semibold text-[#B8C5D4]">
            Temporada {activeSeason} — próximamente
          </p>
          <p className="mt-1 text-[12px] text-[#6D7D94]">
            Los episodios estarán disponibles en breve.
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Episode row ─────────────────────────────────────────────────────────────

function EpisodeRow({
  ep,
  seriesStyle,
}: {
  ep: Episode;
  seriesStyle: SeriesMedia["style"];
}) {
  return (
    <li className="group flex items-start gap-4 py-4">
      {/* Thumbnail */}
      <div
        className="relative shrink-0 overflow-hidden rounded-[6px]"
        style={{ width: 128, height: 72 }}
      >
        <PosterArt style={seriesStyle} title="" kind="series" ratio="landscape" />

        {/* Hover play overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#22B16B]">
            <GmaIcon name="play" size={16} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-[#22B16B]">E{ep.n}</span>
          <span className="truncate text-[14px] font-bold text-white">{ep.title}</span>
          <span className="ml-auto shrink-0 text-[12px] text-[#6D7D94]">{ep.runtime}</span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-[1.5] text-[#6D7D94]">
          {ep.synopsis}
        </p>
      </div>
    </li>
  );
}

// ─── Meta card ────────────────────────────────────────────────────────────────

function MetaCard({ series }: { series: SeriesMedia }) {
  return (
    <div className="rounded-[12px] border border-[#262626] bg-[#0D0D0D] p-5">
      <h3 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-[#6D7D94]">
        Información
      </h3>

      <dl className="flex flex-col gap-3">
        <MetaRow label="Año" value={String(series.year)} />
        <MetaRow label="Clasificación" value={series.rating} />
        <MetaRow label="Temporadas" value={`${series.seasons} temporada${series.seasons > 1 ? "s" : ""}`} />

        {series.tag && <MetaRow label="Producción" value={series.tag} accent />}

        {/* Genres */}
        <div className="flex flex-col gap-1.5">
          <dt className="text-[12px] text-[#6D7D94]">Géneros</dt>
          <dd className="flex flex-wrap gap-1.5">
            {series.categories.map((c) => (
              <span
                key={c}
                className="rounded-full border border-[#262626] px-3 py-1 text-[11px] font-semibold text-[#B8C5D4]"
              >
                {c}
              </span>
            ))}
          </dd>
        </div>

        {/* Format tags */}
        {series.tags && series.tags.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] text-[#6D7D94]">Formato</dt>
            <dd className="flex flex-wrap gap-1.5">
              {series.tags.map((t) => (
                <span
                  key={t}
                  className="rounded border border-[#22B16B]/40 px-2 py-0.5 text-[11px] font-bold text-[#22B16B]"
                >
                  {t}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[12px] text-[#6D7D94]">{label}</dt>
      <dd className={`text-right text-[13px] font-semibold ${accent ? "text-[#22B16B]" : "text-white"}`}>
        {value}
      </dd>
    </div>
  );
}

// ─── Related panel ────────────────────────────────────────────────────────────

function RelatedPanel({
  related,
  onNavigate,
}: {
  related: readonly SeriesMedia[];
  onNavigate: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-4 text-[16px] font-extrabold tracking-[-0.01em] text-white">
        También te puede gustar
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {related.map((s) => (
          <PosterCard
            key={s.id}
            item={s}
            ratio="portrait"
            fluid
            onClick={() => onNavigate(s.id)}
          />
        ))}
      </div>
    </section>
  );
}
