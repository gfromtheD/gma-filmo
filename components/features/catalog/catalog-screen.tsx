"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { ColeccionCard } from "./coleccion-card";
import { collectionsWithContent } from "@/lib/recommendation/collection-picks";
import { CatalogFilterDrawer, type CatalogFilters, type SortKey } from "./catalog-filter-drawer";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useNoticeToast } from "@/components/ui/notice-toast";
import type { MovieMedia } from "@/types/catalog";
import type { Coleccion } from "@/lib/supabase/queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortItems(items: readonly MovieMedia[], key: SortKey): readonly MovieMedia[] {
  const copy = [...items];
  if (key === "alpha")     return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (key === "year-asc")  return copy.sort((a, b) => a.year - b.year);
  if (key === "year-desc") return copy.sort((a, b) => b.year - a.year);
  return copy;
}

function parseRuntimeMinutes(runtime: string): number {
  const hours = runtime.match(/(\d+)\s*h/i);
  const mins  = runtime.match(/(\d+)\s*min/i);
  if (mins) return (hours ? parseInt(hours[1]!) * 60 : 0) + parseInt(mins[1]!);
  const colon = runtime.match(/^(\d+):(\d{2})$/);
  if (colon) return parseInt(colon[1]!) * 60 + parseInt(colon[2]!);
  return Infinity;
}

function applyFiltersToItems(
  items: readonly MovieMedia[],
  f: CatalogFilters,
  isInList: (id: number) => boolean,
): MovieMedia[] {
  let result = [...items];
  if (f.genres.length > 0) {
    result = result.filter((x) => f.genres.some((g) => x.categories.includes(g)));
  }
  result = result.filter((x) => x.year >= f.yearFrom && x.year <= f.yearTo);
  if (f.maxDuration !== null) {
    result = result.filter((x) => parseRuntimeMinutes(x.runtime) <= f.maxDuration!);
  }
  if (f.onlyInList) result = result.filter((x) => isInList(x.numericId));
  return result;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CatalogScreenProps {
  readonly items:        readonly MovieMedia[];
  readonly heading?:     string;
  readonly colecciones?: readonly Coleccion[];
  readonly backHref?:    string;
}

export function CatalogScreen({ items, heading = "Cortometrajes", colecciones, backHref }: CatalogScreenProps) {
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
    if (!saved) notice.showError("No se pudo actualizar tu lista. Inténtalo de nuevo.");
  }

  const cortosItems    = items.filter((x) => x.genre !== "Película");
  const peliculasItems = items.filter((x) => x.genre === "Película");

  const years   = items.map((x) => x.year).filter(Boolean);
  const minYear = years.length ? Math.min(...years) : 2000;
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();

  const urlGenres      = searchParams.getAll("genre");
  const urlSort        = (searchParams.get("sort") ?? "recent") as SortKey;
  const urlYearFrom    = parseInt(searchParams.get("yearFrom")    ?? "") || minYear;
  const urlYearTo      = parseInt(searchParams.get("yearTo")      ?? "") || maxYear;
  const urlMaxDuration = parseInt(searchParams.get("maxDuration") ?? "") || null;
  const urlCountries   = searchParams.getAll("country");
  const urlLanguages   = searchParams.getAll("language");
  const urlOnlyInList  = searchParams.get("onlyInList") === "1";

  const [filters, setFilters] = useState<CatalogFilters>({
    genres:      urlGenres,
    yearFrom:    urlYearFrom,
    yearTo:      urlYearTo,
    maxDuration: urlMaxDuration,
    countries:   urlCountries,
    languages:   urlLanguages,
    onlyInList:  urlOnlyInList,
    sort:        urlSort,
  });

  const allGenres = useMemo(
    () => [...new Set(cortosItems.flatMap((x) => x.categories))].sort(),
    [cortosItems],
  );

  const filtered = useMemo(
    () => sortItems(applyFiltersToItems(cortosItems, filters, hasMedia), filters.sort),
    [cortosItems, filters, hasMedia],
  );

  const filteredPeliculas = useMemo(
    () => applyFiltersToItems(peliculasItems, filters, hasMedia),
    [peliculasItems, filters, hasMedia],
  );

  function getDraftCount(f: CatalogFilters): number {
    return (
      applyFiltersToItems(cortosItems, f, hasMedia).length +
      applyFiltersToItems(peliculasItems, f, hasMedia).length
    );
  }

  function applyFilters(f: CatalogFilters) {
    setFilters(f);
    const params = new URLSearchParams();
    f.genres.forEach((g) => params.append("genre", g));
    if (f.yearFrom > minYear)      params.set("yearFrom",    String(f.yearFrom));
    if (f.yearTo   < maxYear)      params.set("yearTo",      String(f.yearTo));
    if (f.maxDuration !== null)    params.set("maxDuration", String(f.maxDuration));
    f.countries.forEach((c) => params.append("country",  c));
    f.languages.forEach((l) => params.append("language", l));
    if (f.onlyInList)              params.set("onlyInList", "1");
    if (f.sort !== "recent")       params.set("sort",        f.sort);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clearFilters() {
    const empty: CatalogFilters = {
      genres: [], yearFrom: minYear, yearTo: maxYear,
      maxDuration: null, countries: [], languages: [], onlyInList: false,
      sort: "recent",
    };
    setFilters(empty);
    router.push(pathname, { scroll: false });
  }

  const activeCount =
    filters.genres.length +
    (filters.yearFrom > minYear || filters.yearTo < maxYear ? 1 : 0) +
    (filters.maxDuration !== null ? 1 : 0) +
    (filters.countries.length > 0 ? 1 : 0) +
    (filters.languages.length > 0 ? 1 : 0) +
    (filters.onlyInList ? 1 : 0) +
    (filters.sort !== "recent" ? 1 : 0);

  return (
    <motion.div
      className="px-4 pb-20 pt-6 lg:px-16 lg:pt-8"
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#262626] bg-[#0D0D0D] text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            aria-label="Volver"
          >
            <GmaIcon name="chevronLeft" size={16} />
          </Link>
        )}
        <h1 className="min-w-0 break-words text-2xl sm:text-[28px] font-extrabold tracking-[-0.02em] text-white">
          {heading}
        </h1>
        <div className="flex-1" />
        <CatalogFilterDrawer
          items={items}
          allGenres={allGenres}
          filters={filters}
          onApply={applyFilters}
          onClear={clearFilters}
          getDraftCount={getDraftCount}
          minYear={minYear}
          maxYear={maxYear}
        />
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 text-[12.5px] font-semibold text-[#6D7D94] transition-colors hover:text-white"
          >
            Limpiar
          </button>
        )}
        <span className="text-[12.5px] text-[#6D7D94]">
          <span className="font-semibold text-white">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {filters.genres.map((g) => (
            <ActiveChip
              key={g}
              label={g}
              onRemove={() =>
                applyFilters({ ...filters, genres: filters.genres.filter((x) => x !== g) })
              }
            />
          ))}
          {(filters.yearFrom > minYear || filters.yearTo < maxYear) && (
            <ActiveChip
              label={`${filters.yearFrom}–${filters.yearTo}`}
              onRemove={() => applyFilters({ ...filters, yearFrom: minYear, yearTo: maxYear })}
            />
          )}
          {filters.maxDuration !== null && (
            <ActiveChip
              label={`< ${filters.maxDuration} min`}
              onRemove={() => applyFilters({ ...filters, maxDuration: null })}
            />
          )}
          {filters.countries.length > 0 && (
            <ActiveChip
              label={
                filters.countries.length === 1
                  ? (filters.countries[0] ?? "")
                  : `${filters.countries.length} países`
              }
              onRemove={() => applyFilters({ ...filters, countries: [] })}
            />
          )}
          {filters.languages.length > 0 && (
            <ActiveChip
              label={
                filters.languages.length === 1
                  ? (filters.languages[0] ?? "")
                  : `${filters.languages.length} idiomas`
              }
              onRemove={() => applyFilters({ ...filters, languages: [] })}
            />
          )}
          {filters.onlyInList && (
            <ActiveChip
              label="Solo en mi lista"
              onRemove={() => applyFilters({ ...filters, onlyInList: false })}
            />
          )}
          {filters.sort !== "recent" && (
            <ActiveChip
              label={{ alpha: "A → Z", "year-asc": "Año ↑", "year-desc": "Año ↓" }[filters.sort] ?? filters.sort}
              onRemove={() => applyFilters({ ...filters, sort: "recent" })}
            />
          )}
        </div>
      )}

      {/* Grid — cortos */}
      {filtered.length > 0 && (
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5"
        >
          {filtered.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              ratio="landscape"
              fluid
              hoverOverlay
              href={`/cortos/${item.id}`}
              onAddList={() => void toggleInList(item.numericId)}
              inList={hasMedia(item.numericId)}
            />
          ))}
        </div>
      )}
      {filtered.length === 0 && filteredPeliculas.length === 0 && (
        <EmptyState onReset={clearFilters} />
      )}

      {/* Películas section */}
      {filteredPeliculas.length > 0 && (
        <section className="mt-16">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h2 className="min-w-0 break-words text-2xl sm:text-[28px] font-extrabold tracking-[-0.02em] text-white">
              Películas
            </h2>
            <div className="flex-1" />
            <span className="text-[12.5px] text-[#6D7D94]">
              <span className="font-semibold text-white">{filteredPeliculas.length}</span>{" "}
              {filteredPeliculas.length === 1 ? "película" : "películas"}
            </span>
          </div>
          <div
            className="grid gap-2 sm:gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}
          >
            {filteredPeliculas.map((item) => (
              <PosterCard
                key={item.id}
                item={item}
                ratio="landscape"
                fluid
                href={`/cortos/${item.id}`}
                onAddList={() => void toggleInList(item.numericId)}
                inList={hasMedia(item.numericId)}
              />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}

// ─── Active filter chip ───────────────────────────────────────────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/8 pl-3 pr-1 text-[12px] font-semibold text-[#22B16B]">
      <span className="min-w-0 break-words">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#22B16B]/60 transition-colors hover:text-[#22B16B]"
        aria-label={`Quitar filtro ${label}`}
      >
        <GmaIcon name="close" size={9} strokeWidth={2.5} />
      </button>
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A] text-[#6D7D94]">
        <GmaIcon name="film" size={28} />
      </div>
      <p className="mb-2 text-[16px] font-bold text-white">Sin resultados</p>
      <p className="mb-6 text-[13px] text-[#6D7D94]">
        Prueba con otros filtros o explora todo el catálogo.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="min-h-11 rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-gma-accent-fg transition-colors hover:bg-[#2AC57A]"
      >
        Ver todo
      </button>
    </div>
  );
}
