"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { ColeccionCard } from "./coleccion-card";
import { collectionsWithContent } from "@/lib/recommendation/collection-picks";
import { FilterPills } from "./filter-pills";
import { isFeature, workPath } from "@/lib/catalog/work-path";
import { CATALOG_GRID_CLASS, CATALOG_PAGE_PADDING_CLASS } from "@/lib/catalog/grid";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  deriveFilterOptions,
  filterItems,
  mergeFiltersIntoSearch,
  parseCatalogFilters,
  pickRandomItem,
  sortItems,
  type CatalogFilters,
} from "@/lib/catalog/filters";
import { useWatchlist, watchlistErrorMessage } from "@/hooks/use-watchlist";
import { useNoticeToast } from "@/components/ui/notice-toast";
import type { MovieMedia } from "@/types/catalog";
import type { Coleccion } from "@/lib/supabase/queries";

// ─── Main component ───────────────────────────────────────────────────────────

/** Cada sección del catálogo enseña solo lo suyo: `/cortos` los cortos (40 min o menos) y `/peliculas` las películas. */
export type CatalogSection = "cortos" | "peliculas";

interface CatalogScreenProps {
  readonly items:        readonly MovieMedia[];
  readonly section?:     CatalogSection;
  readonly heading?:     string;
  readonly colecciones?: readonly Coleccion[];
  readonly backHref?:    string;
}

export function CatalogScreen({ items: allItems, section = "cortos", heading = section === "peliculas" ? "Películas" : "Cortometrajes", colecciones, backHref }: CatalogScreenProps) {
  const items = useMemo(() => allItems.filter((x) => isFeature(x) === (section === "peliculas")), [allItems, section]);
  // Las colecciones sin ningún corto no se muestran (evita tarjetas vacías).
  const withContent = collectionsWithContent(colecciones ?? [], items);

  const searchParams = useSearchParams();
  const router       = useRouter();
  const pathname     = usePathname();
  const { addMedia, removeMedia, hasMedia, canSave } = useWatchlist();
  const notice = useNoticeToast();

  async function toggleInList(numericId: number) {
    if (!canSave) {
      notice.showLoginRequired();
      return;
    }
    const saved = hasMedia(numericId) ? await removeMedia(numericId) : await addMedia(numericId);
    if (!saved) notice.showError(watchlistErrorMessage());
  }

  // La URL es la fuente de verdad (enlaces compartibles); el estado local solo evita el retardo al elegir.
  const urlQuery = searchParams.toString();
  const [filters, setFilters] = useState<CatalogFilters>(() => parseCatalogFilters(searchParams));
  useEffect(() => { setFilters(parseCatalogFilters(new URLSearchParams(urlQuery))); }, [urlQuery]);

  // Las opciones salen de las obras de esta sección, así que lo que se publique aparece solo.
  const filterOptions = useMemo(() => deriveFilterOptions(items), [items]);

  const filtered = useMemo(
    () => sortItems(filterItems(items, filters, hasMedia), filters.sort),
    [items, filters, hasMedia],
  );

  const totalResults = filtered.length;
  const hasActiveFilters = activeFilterCount(filters) > 0;

  function applyFilters(next: CatalogFilters) {
    setFilters(next);
    const qs = mergeFiltersIntoSearch(new URLSearchParams(searchParams.toString()), next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clearFilters() {
    applyFilters(DEFAULT_FILTERS);
  }

  function openRandom() {
    const pick = pickRandomItem(filtered);
    if (pick) router.push(workPath(pick));
  }

  return (
    <motion.div
      className={`${CATALOG_PAGE_PADDING_CLASS} pb-20 pt-6 lg:pt-8`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {notice.toast}

      {/* Collections row — solo colecciones con contenido */}
      {withContent.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-[24px] font-bold text-white">
            Colecciones
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {withContent.map(({ col, filmCount }) => (
              <ColeccionCard key={col.slug} col={col} filmCount={filmCount} />
            ))}
          </div>
        </section>
      )}

      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gma-border bg-gma-surface-2 text-[#C4C4C4] transition-colors hover:bg-gma-surface hover:text-white"
            aria-label="Volver"
          >
            <GmaIcon name="chevronLeft" size={16} />
          </Link>
        )}
        <h1 className="min-w-0 break-words text-2xl sm:text-[28px] font-extrabold tracking-[-0.02em] text-white">
          {heading}
        </h1>
      </div>

      <div className="mb-6">
        <FilterPills
          filters={filters}
          options={filterOptions}
          showListFilter={canSave}
          onChange={applyFilters}
          onClear={clearFilters}
          onRandom={openRandom}
        />
        {/* Respuesta a los filtros: solo aparece cuando hay alguno activo. El aviso para lectores de pantalla existe siempre. */}
        <p
          role="status"
          aria-live="polite"
          className={hasActiveFilters ? "mt-3 text-[13px] leading-5 text-[#999999]" : "sr-only"}
        >
          {hasActiveFilters && (
            <>
              <strong className="font-semibold text-white">{totalResults}</strong> {totalResults === 1 ? "resultado" : "resultados"}
            </>
          )}
        </p>
      </div>

      {/* Grid — las obras de esta sección */}
      {filtered.length > 0 && (
        <div className={CATALOG_GRID_CLASS}>
          {filtered.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              ratio="landscape"
              fluid
              hoverOverlay
              href={workPath(item)}
              onAddList={() => void toggleInList(item.numericId)}
              inList={hasMedia(item.numericId)}
            />
          ))}
        </div>
      )}
      {filtered.length === 0 && items.length === 0 && <NothingYet section={section} />}
      {filtered.length === 0 && items.length > 0 && <EmptyState onReset={clearFilters} />}
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

/** La sección aún no tiene ninguna obra publicada (no es lo mismo que «los filtros no encuentran nada»). */
function NothingYet({ section }: { section: CatalogSection }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gma-surface text-[#7C7C7C]">
        <GmaIcon name="film" size={28} />
      </div>
      <p className="mb-2 text-[16px] font-bold text-white">
        {section === "peliculas" ? "Todavía no hay películas publicadas" : "Todavía no hay cortos publicados"}
      </p>
      <p className="text-[13px] text-[#7C7C7C]">Vuelve pronto: se añaden títulos nuevos a menudo.</p>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gma-surface text-[#7C7C7C]">
        <GmaIcon name="film" size={28} />
      </div>
      <p className="mb-2 text-[16px] font-bold text-white">Sin resultados</p>
      <p className="mb-6 text-[13px] text-[#7C7C7C]">
        Prueba con otros filtros o explora todo el catálogo.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="min-h-11 rounded-[4px] bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-gma-accent-fg transition-colors hover:bg-[#2AC57A]"
      >
        Ver todo
      </button>
    </div>
  );
}
