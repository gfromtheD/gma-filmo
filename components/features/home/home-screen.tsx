"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { workPath } from "@/lib/catalog/work-path";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { HomeHero } from "@/components/features/home/home-hero";
import { AmbientBackdrop } from "@/components/features/home/ambient-backdrop";
import { HeroIndicator } from "@/components/features/home/hero-indicator";
import { Carousel } from "@/components/ui/carousel";
import { TopTenRow } from "@/components/features/home/top-ten-row";
import { PosterCard } from "@/components/ui/poster-card";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useProgress } from "@/hooks/use-progress";
import { prefetchPlaybackFor } from "@/hooks/use-media-playback";
import { useRecommendedHero } from "@/hooks/use-recommended-hero";
import { useRecommendations } from "@/hooks/use-recommendations";
import { parseDuration } from "@/lib/utils";
import { preloadImage, whenImageReady } from "@/lib/home/image-ready";
import { ColeccionCard } from "@/components/features/catalog/coleccion-card";
import { collectionsWithContent, pickRecommendedCollections } from "@/lib/recommendation/collection-picks";
import type { Coleccion } from "@/lib/supabase/queries";
import type { MovieMedia } from "@/types/catalog";


interface HomeScreenProps {
  readonly items: readonly MovieMedia[];
  readonly colecciones?: readonly Coleccion[];
}

/** Cuántas colecciones se recomiendan en la fila de portada. */
const RECOMMENDED_COLLECTIONS = 6;

const HERO_CROSSFADE_MS = 1000;

function hrefFor(item: MovieMedia) {
  return workPath(item);
}

export function HomeScreen({ items, colecciones = [] }: HomeScreenProps) {
  const router = useRouter();
  const { mediaIds, loadedMediaIds } = useWatchlist();
  const { entries: progressEntries } = useProgress();

  // ── Hero carousel state ──────────────────────────────────────────────────────
  const featuredItems = useRecommendedHero(items, progressEntries);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [isTrailerActive, setIsTrailerActive] = useState(false);
  /** Cuántas veces se ha cambiado de portada: la primera no lleva entrada de texto, las siguientes sí. */
  const [slideChanges, setSlideChanges] = useState(0);
  const latestChange = useRef(0);
  const [leaving, setLeaving] = useState<MovieMedia | null>(null);

  // Cambio de portada: antes de fundir se espera a que la nueva esté cargada (como mucho 1,5 s), para que no aparezca
  // de golpe a mitad del fundido. Si llega otro cambio mientras se espera, manda el último.
  const goTo = useCallback(
    (target: number) => {
      const count = featuredItems.length;
      if (count === 0) return;
      const index = ((target % count) + count) % count;
      if (index === featuredIdx) return;
      const token = ++latestChange.current;
      void whenImageReady(featuredItems[index]?.imageUrl).then(() => {
        if (token !== latestChange.current) return;
        // La portada que se va se monta en el MISMO instante que entra la nueva: si se montara un fotograma después,
        // habría un fotograma en blanco (la nueva empieza transparente) y se vería como un golpe.
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setLeaving(reduceMotion ? null : (featuredItems[featuredIdx] ?? null));
        setFeaturedIdx(index);
        setSlideChanges((n) => n + 1);
      });
    },
    [featuredItems, featuredIdx],
  );

  // El avance lo marca el llenado del punto activo (8 s, ver HeroIndicator); aquí solo se cambia de índice.
  const goNext = useCallback(() => goTo(featuredIdx + 1), [goTo, featuredIdx]);

  // Las portadas de alrededor se precargan para que el cambio sea inmediato.
  useEffect(() => {
    const count = featuredItems.length;
    if (count < 2) return;
    for (const offset of [1, 2, count - 1]) preloadImage(featuredItems[(featuredIdx + offset) % count]?.imageUrl);
  }, [featuredItems, featuredIdx]);

  const featured = featuredItems[featuredIdx] ?? featuredItems[0];

  // Copia saliente: durante 1 s la diapositiva anterior queda debajo, al 100 %, mientras la nueva se funde por encima
  // (así nunca se transparenta el fondo). Con movimiento reducido no hay copia: el cambio es directo.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), HERO_CROSSFADE_MS + 50);
    return () => clearTimeout(timer);
  }, [leaving]);

  // ── Recommendation rows (replaces static trending + newReleases) ─────────────
  const { homeRows, newArrivals, categoryWeights, sessionSeed } = useRecommendations(items);
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
  // «Mi Lista» solo aparece si ya tenías algo guardado al cargar la página. Si apareciera al guardar el primer título,
  // empujaría las filas de abajo justo bajo el cursor y la tarjeta parecería desaparecer; se verá en la próxima visita.
  const hasSavedBeforeThisVisit = items.some((x) => loadedMediaIds.includes(x.numericId));

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
      <div className="relative">
        {/* Portada que se va: va ANTES de la nueva en el DOM, así su imagen queda debajo (opaca) y la nueva se funde
            por encima. Solo su texto se desvanece (rápido), no toda la capa. */}
        {leaving && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <HomeHero
              key={`out-${leaving.id}`}
              isOverlay
              item={leaving}
              detailHref={hrefFor(leaving)}
              canNavigate={false}
              onPlay={() => undefined}
              onPrev={() => undefined}
              onNext={() => undefined}
            />
          </div>
        )}

        <HomeHero
          key={featured.id}
          item={featured}
          detailHref={hrefFor(featured)}
          canNavigate={featuredItems.length > 1}
          isTransition={slideChanges > 0}
          onPlay={() => { prefetchPlaybackFor(featured); router.push(`/ver/${featured.id}`); }}
          onPrev={() => goTo(featuredIdx - 1)}
          onNext={goNext}
          onTrailerActiveChange={setIsTrailerActive}
          onTrailerEnded={goNext}
        />

        <HeroIndicator
          count={featuredItems.length}
          activeIndex={featuredIdx}
          onSelect={goTo}
          isPaused={isTrailerActive}
          onComplete={goNext}
        />
      </div>

      <motion.div
        className="relative z-[1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.7, ease: "easeOut" }}
      >
        {continueItems.length > 0 && (
          <Carousel title="Continuar viendo" subtitle="Retoma donde lo dejaste">
            {continueItems.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview caption showProgress href={`/ver/${item.id}`} />
            ))}
          </Carousel>
        )}

        <Carousel key={newArrivals.map((item) => item.id).join(",")} title="Recién llegados" subtitle="Lo último que se ha añadido al catálogo" mobileSize="wide">
          {newArrivals.map((item) => (
            <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview caption href={hrefFor(item as MovieMedia)} />
          ))}
        </Carousel>

        {featuredItems.length >= 4 && (
          <TopTenRow
            title="Top 10 en GMA"
            subtitle="Los títulos más destacados ahora mismo"
            items={featuredItems.slice(0, 10)}
            hrefFor={hrefFor}
          />
        )}

        {homeRows.map((row) => (
          <Carousel key={row.title} title={row.title} subtitle={row.subtitle}>
            {row.items.map((item) => (
              <PosterCard
                key={item.id}
                item={item as MovieMedia}
                ratio="landscape" fluid hoverPreview caption
                href={hrefFor(item as MovieMedia)}
              />
            ))}
          </Carousel>
        ))}

        {hasSavedBeforeThisVisit && watchlistItems.length > 0 && (
          <Carousel
            title="Mi Lista"
            subtitle="Lo que has guardado para ver después"
            action={
              <Link
                href="/mi-espacio"
                className="inline-flex min-h-11 items-center text-[14px] font-medium text-[#C4C4C4] transition-colors hover:text-white"
              >
                Ver todas
              </Link>
            }
          >
            {watchlistItems.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview caption href={hrefFor(item)} />
            ))}
          </Carousel>
        )}

        {recommendedCollections.length > 0 && (
          <Carousel
            title="Colecciones para ti"
            subtitle="Selecciones de cortos para descubrir"
            action={
              <Link
                href="/cortos"
                className="inline-flex min-h-11 items-center text-[14px] font-medium text-[#C4C4C4] transition-colors hover:text-white"
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

        <div className="h-20" />
      </motion.div>
    </motion.div>
  );
}
