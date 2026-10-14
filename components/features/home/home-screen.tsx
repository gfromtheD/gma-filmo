"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { HomeHero } from "@/components/features/home/home-hero";
import { AmbientBackdrop } from "@/components/features/home/ambient-backdrop";
import { Carousel } from "@/components/ui/carousel";
import { PosterCard } from "@/components/ui/poster-card";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useProgress } from "@/hooks/use-progress";
import { useRecommendedHero } from "@/hooks/use-recommended-hero";
import { useRecommendations } from "@/hooks/use-recommendations";
import { parseDuration } from "@/lib/utils";
import { ColeccionCard } from "@/components/features/catalog/coleccion-card";
import { collectionsWithContent, pickRecommendedCollections } from "@/lib/recommendation/collection-picks";
import type { Coleccion } from "@/lib/supabase/queries";
import type { MovieMedia } from "@/types/catalog";

const SLIDE_INTERVAL = 6000;

interface HomeScreenProps {
  readonly items: readonly MovieMedia[];
  readonly colecciones?: readonly Coleccion[];
}

/** Cuántas colecciones se recomiendan en la fila de portada. */
const RECOMMENDED_COLLECTIONS = 6;

function hrefFor(item: MovieMedia) {
  return `/cortos/${item.id}`;
}

export function HomeScreen({ items, colecciones = [] }: HomeScreenProps) {
  const router = useRouter();
  const { mediaIds } = useWatchlist();
  const { entries: progressEntries } = useProgress();

  // ── Hero carousel state ──────────────────────────────────────────────────────
  const featuredItems = useRecommendedHero(items, progressEntries);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const hoveredRef    = useRef(false);
  const safetyRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion  = useReducedMotion();
  const [isTrailerActive, setIsTrailerActive] = useState(false);

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
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
  }, []);

  // Auto-advance: interval ticks every SLIDE_INTERVAL but skips while hovered.
  // featuredIdx in deps resets the timer after every slide change (manual or auto).
  useEffect(() => {
    if (featuredItems.length <= 1 || reduceMotion || isTrailerActive) return;
    const id = setInterval(() => {
      if (hoveredRef.current) return;
      setFeaturedIdx((i) => (i + 1) % featuredItems.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [featuredItems.length, featuredIdx, reduceMotion, isTrailerActive]);

  const featured = featuredItems[featuredIdx] ?? featuredItems[0];

  // ── Recommendation rows (replaces static trending + newReleases) ─────────────
  const { homeRows, categoryWeights, sessionSeed } = useRecommendations(items);
  const recommendedCollections = useMemo(
    () =>
      pickRecommendedCollections(
        collectionsWithContent(colecciones, items),
        categoryWeights,
        sessionSeed,
        RECOMMENDED_COLLECTIONS,
      ),
    [colecciones, items, categoryWeights, sessionSeed],
  );
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <AmbientBackdrop imageUrl={featured.imageUrl} style={featured.style} />

      {/* ── Hero a pantalla completa bajo la cabecera transparente ─────────── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <HomeHero
          key={featured.id}
          item={featured}
          detailHref={hrefFor(featured)}
          canNavigate={featuredItems.length > 1}
          onPlay={() => router.push(`/ver/${featured.id}`)}
          onPrev={() => setFeaturedIdx((i) => (i - 1 + featuredItems.length) % featuredItems.length)}
          onNext={() => setFeaturedIdx((i) => (i + 1) % featuredItems.length)}
          onTrailerActiveChange={setIsTrailerActive}
          onTrailerEnded={() => setFeaturedIdx((i) => (i + 1) % featuredItems.length)}
        />
      </div>

      <motion.div
        className="relative z-[1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.7, ease: "easeOut" }}
      >
        {continueItems.length > 0 && (
          <Carousel title="Continuar viendo">
            {continueItems.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview showProgress href={`/ver/${item.id}`} />
            ))}
          </Carousel>
        )}

        <Carousel title="Recién llegados" mobileSize="wide">
          {items.slice(0, 15).map((item) => (
            <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview href={hrefFor(item)} />
          ))}
        </Carousel>

        {recommendedCollections.length > 0 && (
          <Carousel
            title="Colecciones para ti"
            action={
              <Link
                href="/cortos"
                className="text-[14px] font-medium text-[#B8C5D4] transition-colors hover:text-white"
              >
                Ver todas
              </Link>
            }
          >
            {recommendedCollections.map(({ col, filmCount }) => (
              <ColeccionCard key={col.slug} col={col} filmCount={filmCount} />
            ))}
          </Carousel>
        )}

        {homeRows.map((row) => (
          <Carousel key={row.title} title={row.title}>
            {row.items.map((item) => (
              <PosterCard
                key={item.id}
                item={item as MovieMedia}
                ratio="landscape" fluid hoverPreview
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
                className="inline-flex min-h-11 items-center rounded-full bg-[#1A1A1A] px-[14px] py-[6px] text-[12px] font-semibold text-white hover:bg-[#262626]"
              >
                Ver todo
              </Link>
            }
          >
            {watchlistItems.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview href={hrefFor(item)} />
            ))}
          </Carousel>
        )}

        <div className="h-20" />
      </motion.div>
    </motion.div>
  );
}
