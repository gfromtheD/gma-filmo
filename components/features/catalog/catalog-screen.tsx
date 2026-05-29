"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { CatalogFilterDrawer, type CatalogFilters, type SortKey } from "./catalog-filter-drawer";
import { useWatchlist } from "@/hooks/use-watchlist";
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
  const searchParams = useSearchParams();
  const router       = useRouter();
  const pathname     = usePathname();
  const { addMedia, removeMedia, hasMedia } = useWatchlist();

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
    <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-8">

      {/* Collections row */}
      {colecciones && colecciones.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5A6A7E]">
            Colecciones
          </h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {colecciones.map((col) => (
              <ColeccionCard
                key={col.slug}
                col={col}
                filmCount={items.filter((x) => x.categories.includes(col.name)).length}
              />
            ))}
          </div>
        </section>
      )}

      {/* Header row */}
      <div className="mb-6 flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#262626] bg-[#0D0D0D] text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            aria-label="Volver"
          >
            <GmaIcon name="chevronLeft" size={16} />
          </Link>
        )}
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-white">
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
            className="text-[12.5px] font-semibold text-[#5A6A7E] transition-colors hover:text-white"
          >
            Limpiar
          </button>
        )}
        <span className="text-[12.5px] text-[#5A6A7E]">
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
      {filtered.length > 0 ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {filtered.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              ratio="landscape"
              fluid
              href={`/peliculas/${item.id}`}
              onAddList={() =>
                hasMedia(item.numericId)
                  ? removeMedia(item.numericId)
                  : addMedia(item.numericId)
              }
              inList={hasMedia(item.numericId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onReset={clearFilters} />
      )}

      {/* Películas section */}
      {filteredPeliculas.length > 0 && (
        <section className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-[28px] font-extrabold tracking-[-0.02em] text-white">
              Películas
            </h2>
            <div className="flex-1" />
            <span className="text-[12.5px] text-[#5A6A7E]">
              <span className="font-semibold text-white">{filteredPeliculas.length}</span>{" "}
              {filteredPeliculas.length === 1 ? "película" : "películas"}
            </span>
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
          >
            {filteredPeliculas.map((item) => (
              <PosterCard
                key={item.id}
                item={item}
                ratio="landscape"
                fluid
                href={`/peliculas/${item.id}`}
                onAddList={() =>
                  hasMedia(item.numericId)
                    ? removeMedia(item.numericId)
                    : addMedia(item.numericId)
                }
                inList={hasMedia(item.numericId)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Collection card ─────────────────────────────────────────────────────────

const COLECCION_NAME_OVERRIDES: Record<string, string> = {
  "la-pelicula": "Películas",
};

function ColeccionCard({ col, filmCount }: { col: Coleccion; filmCount: number }) {
  const displayName = COLECCION_NAME_OVERRIDES[col.slug] ?? col.name;
  return (
    <Link
      href={`/peliculas/coleccion/${col.slug}`}
      className="group relative block aspect-video overflow-hidden rounded-xl"
    >
      {/* Cover image or gradient fallback */}
      {col.r2_cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={col.r2_cover_url}
          alt={displayName}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0a1a10 0%, #1a3a28 50%, #0d2018 100%)",
          }}
        />
      )}

      {/* Permanent gradient overlay for legibility */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Hover tint */}
      <div className="pointer-events-none absolute inset-0 bg-[#22B16B]/0 transition-colors duration-300 group-hover:bg-[#22B16B]/10" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22B16B]">
              Colección
            </p>
            <h3 className="mt-0.5 text-[18px] font-extrabold leading-tight text-white">
              {displayName}
            </h3>
            {filmCount > 0 && (
              <p className="mt-1 text-[12px] text-[#8A9AAE]">
                {filmCount}{" "}
                {col.slug === "la-pelicula"
                  ? filmCount === 1 ? "film" : "films"
                  : filmCount === 1 ? "corto" : "cortos"}
              </p>
            )}
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 group-hover:bg-[#22B16B] group-hover:text-[#03200F]">
            <GmaIcon name="chevronRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Active filter chip ───────────────────────────────────────────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/8 px-3 py-1 text-[12px] font-semibold text-[#22B16B]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#22B16B]/60 transition-colors hover:text-[#22B16B]"
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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A] text-[#5A6A7E]">
        <GmaIcon name="film" size={28} />
      </div>
      <p className="mb-2 text-[16px] font-bold text-white">Sin resultados</p>
      <p className="mb-6 text-[13px] text-[#5A6A7E]">
        Prueba con otros filtros o explora todo el catálogo.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A]"
      >
        Ver todo
      </button>
    </div>
  );
}
