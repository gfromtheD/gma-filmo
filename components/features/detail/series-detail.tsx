"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hero } from "@/components/features/media/hero";
import { PosterArt } from "@/components/ui/poster-art";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useWatchlist, watchlistErrorMessage } from "@/hooks/use-watchlist";
import { useNoticeToast } from "@/components/ui/notice-toast";
import type { Episode, SeriesMedia } from "@/types/catalog";

interface SeriesDetailProps {
  readonly series: SeriesMedia;
  readonly episodes: readonly Episode[];
  readonly related: readonly SeriesMedia[];
}

export function SeriesDetail({ series, episodes, related }: SeriesDetailProps) {
  const router = useRouter();
  const { addMedia, removeMedia, hasMedia, canSave } = useWatchlist();
  const notice = useNoticeToast();
  const inList = hasMedia(series.numericId);

  async function toggleList() {
    if (!canSave) {
      notice.showLoginRequired();
      return;
    }
    const saved = inList ? await removeMedia(series.numericId) : await addMedia(series.numericId);
    if (!saved) notice.showError(watchlistErrorMessage());
  }

  return (
    <div>
      {notice.toast}
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Hero
        item={series}
        onPlay={() => router.push(`/ver/${series.id}`)}
        onAddList={() => void toggleList()}
        inList={inList}
      />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_304px] lg:gap-10">

          {/* Left: episodes */}
          <div className="min-w-0">
            <EpisodesPanel series={series} episodes={episodes} />
          </div>

          {/* Right: meta + related */}
          <aside className="flex min-w-0 flex-col gap-8">
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
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">Episodios</h2>

        {/* Season selector — only rendered when there's more than 1 season */}
        {series.seasons > 1 && (
          <div
            className="flex max-w-full flex-wrap gap-1 rounded-[6px] border border-gma-border bg-gma-surface-2 p-1"
          >
            {seasonNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setActiveSeason(n)}
                className={`min-h-11 min-w-11 rounded-[4px] px-3 py-1 text-[12px] font-bold transition-colors duration-150 ${
                  activeSeason === n
                    ? "bg-[#22B16B] text-[#03200F]"
                    : "text-[#C4C4C4] hover:text-white"
                }`}
              >
                T{n}
              </button>
            ))}
          </div>
        )}
      </div>

      {displayEpisodes.length > 0 ? (
        <ol className="flex flex-col divide-y divide-gma-border">
          {displayEpisodes.map((ep) => (
            <EpisodeRow key={ep.n} ep={ep} seriesStyle={series.style} />
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[12px] border border-gma-border bg-gma-surface-2 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gma-surface text-[#7C7C7C]">
            <GmaIcon name="series" size={22} />
          </div>
          <p className="text-[14px] font-semibold text-[#C4C4C4]">
            Temporada {activeSeason} — próximamente
          </p>
          <p className="mt-1 text-[12px] text-[#7C7C7C]">
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
    <li className="group flex min-w-0 items-start gap-3 py-4 sm:gap-4">
      {/* Thumbnail */}
      <div
        className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-[6px] min-[400px]:w-24 sm:w-32"
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
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[12px] font-bold text-[#22B16B]">E{ep.n}</span>
          <span className="min-w-0 break-words text-[14px] font-bold text-white">{ep.title}</span>
          <span className="ml-auto shrink-0 text-[12px] text-[#7C7C7C]">{ep.runtime}</span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-[1.5] text-[#7C7C7C]">
          {ep.synopsis}
        </p>
      </div>
    </li>
  );
}

// ─── Meta card ────────────────────────────────────────────────────────────────

function MetaCard({ series }: { series: SeriesMedia }) {
  return (
    <div className="rounded-[12px] border border-gma-border bg-gma-surface-2 p-5">
      <h3 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-[#7C7C7C]">
        Información
      </h3>

      <dl className="flex flex-col gap-3">
        <MetaRow label="Año" value={String(series.year)} />
        <MetaRow label="Clasificación" value={series.rating} />
        <MetaRow label="Temporadas" value={`${series.seasons} temporada${series.seasons > 1 ? "s" : ""}`} />

        {series.tag && <MetaRow label="Producción" value={series.tag} accent />}

        {/* Genres */}
        <div className="flex flex-col gap-1.5">
          <dt className="text-[12px] text-[#7C7C7C]">Géneros</dt>
          <dd className="flex flex-wrap gap-1.5">
            {series.categories.map((c) => (
              <span
                key={c}
                className="rounded-[4px] border border-gma-border px-3 py-1 text-[11px] font-semibold text-[#C4C4C4]"
              >
                {c}
              </span>
            ))}
          </dd>
        </div>

        {/* Format tags */}
        {series.tags && series.tags.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] text-[#7C7C7C]">Formato</dt>
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
      <dt className="shrink-0 text-[12px] text-[#7C7C7C]">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[13px] font-semibold ${accent ? "text-[#22B16B]" : "text-white"}`}>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
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
