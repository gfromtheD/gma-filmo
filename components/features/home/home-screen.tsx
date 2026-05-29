"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Hero } from "@/components/features/media/hero";
import { Carousel } from "@/components/ui/carousel";
import { PosterCard } from "@/components/ui/poster-card";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useProgress } from "@/hooks/use-progress";
import { useRecommendedHero } from "@/hooks/use-recommended-hero";
import { useRecommendations } from "@/hooks/use-recommendations";
import { parseDuration } from "@/lib/utils";
import type { MovieMedia } from "@/types/catalog";

const SLIDE_INTERVAL = 6000;

interface HomeScreenProps {
  readonly items: readonly MovieMedia[];
}

function hrefFor(item: MovieMedia) {
  return `/peliculas/${item.id}`;
}

export function HomeScreen({ items }: HomeScreenProps) {
  const router = useRouter();
  const { addMedia, removeMedia, hasMedia, mediaIds } = useWatchlist();
  const { entries: progressEntries } = useProgress();

  // ── Hero carousel state ──────────────────────────────────────────────────────
  const featuredItems = useRecommendedHero(items, progressEntries);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const hoveredRef    = useRef(false);
  const safetyRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setHovered(val: boolean) {
    hoveredRef.current = val;
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
    // Safety valve: even if mouseLeave never fires, resume after 8s
    if (val) safetyRef.current = setTimeout(() => { hoveredRef.current = false; }, 8000);
  }

  // Reset hover on tab switch / window blur so the carousel never stays stuck
  useEffect(() => {
    function release() { setHovered(false); }
    document.addEventListener("visibilitychange", release);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("visibilitychange", release);
      window.removeEventListener("blur", release);
    };
  }, []);

  // Auto-advance: interval ticks every SLIDE_INTERVAL but skips while hovered.
  // featuredIdx in deps resets the timer after every slide change (manual or auto).
  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const id = setInterval(() => {
      if (hoveredRef.current) return;
      setFeaturedIdx((i) => (i + 1) % featuredItems.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [featuredItems.length, featuredIdx]);

  const featured = featuredItems[featuredIdx] ?? featuredItems[0];

  // ── Recommendation rows (replaces static trending + newReleases) ─────────────
  const { homeRows } = useRecommendations(items);
  const watchlistItems = items.filter((x) => mediaIds.includes(x.numericId));

  const continueItems = useMemo(() => {
    return items
      .flatMap((item) => {
        const e = progressEntries[item.numericId];
        if (!e || e.currentTime <= 10 || e.completed) return [];
        const dur = parseDuration(item.runtime);
        // Use 0.3 as fallback when duration is unknown (e.g. runtime = "Corto")
        const frac = dur > 0 ? Math.min(e.currentTime / dur, 0.94) : 0.3;
        return [{ ...item, progress: frac } as MovieMedia];
      })
      .sort((a, b) => {
        const ta = progressEntries[a.numericId]?.updatedAt ?? 0;
        const tb = progressEntries[b.numericId]?.updatedAt ?? 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [items, progressEntries]);

  if (!featured) return null;

  function toggleList(item: MovieMedia) {
    if (hasMedia(item.numericId)) removeMedia(item.numericId); else addMedia(item.numericId);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {/* ── Hero carousel ──────────────────────────────────────────────────── */}
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* key forces remount → re-triggers all fadeUp / fadeIn animations */}
        <Hero
          key={featured.id}
          item={featured}
          onPlay={() => router.push(`/ver/${featured.id}`)}
          onDetail={() => router.push(hrefFor(featured))}
          onAddList={() => toggleList(featured)}
          inList={hasMedia(featured.numericId)}
          fullSynopsis
        />

        {/* Dot indicators + prev/next arrows */}
        {featuredItems.length > 1 && (
          <div className="group absolute bottom-6 left-0 right-0 z-10 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setFeaturedIdx((i) => (i - 1 + featuredItems.length) % featuredItems.length)}
              className="flex items-center justify-center text-white/0 transition-colors duration-200 group-hover:text-white/50 hover:!text-white/90 active:scale-95"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="flex items-center gap-[6px]">
              {featuredItems.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setFeaturedIdx(i)}
                  className={`h-[5px] rounded-full transition-all duration-300 ${
                    i === featuredIdx
                      ? "w-8 bg-[#22B16B]"
                      : "w-[10px] bg-white/25 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => setFeaturedIdx((i) => (i + 1) % featuredItems.length)}
              className="flex items-center justify-center text-white/0 transition-colors duration-200 group-hover:text-white/50 hover:!text-white/90 active:scale-95"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

      </div>

      <motion.div
        className="mx-auto max-w-[1440px] px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.7, ease: "easeOut" }}
      >
        {continueItems.length > 0 && (
          <Carousel title="Continuar viendo">
            {continueItems.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" size="lg" showProgress href={`/ver/${item.id}`} />
            ))}
          </Carousel>
        )}

        {homeRows.map((row) => (
          <Carousel key={row.title} title={row.title}>
            {row.items.map((item) => (
              <PosterCard
                key={item.id}
                item={item as MovieMedia}
                ratio="landscape"
                size="lg"
                href={hrefFor(item as MovieMedia)}
              />
            ))}
          </Carousel>
        ))}

        {watchlistItems.length > 0 && (
          <Carousel
            title="Mi Lista"
            action={
              <Link
                href="/mi-espacio"
                className="inline-flex items-center rounded-full bg-[#1A1A1A] px-[14px] py-[6px] text-[12px] font-semibold text-white hover:bg-[#262626]"
              >
                Ver todo
              </Link>
            }
          >
            {watchlistItems.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" size="lg" href={hrefFor(item)} />
            ))}
          </Carousel>
        )}

        <div className="h-20" />
      </motion.div>
    </motion.div>
  );
}
