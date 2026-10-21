"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { workPath } from "@/lib/catalog/work-path";
import Link from "next/link";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { searchCreators, searchItems, suggestCorrection, tokenize } from "@/lib/search/search-engine";
import type { MovieMedia } from "@/types/catalog";

const GRID_CLASS =
  "grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 xl:grid-cols-4 2xl:grid-cols-5";
const CHIP_CLASS =
  "inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 text-[14px] font-medium text-[#EEF1F6] backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B]";

interface SearchScreenProps {
  readonly items: readonly MovieMedia[];
}

/** ¿El foco está en un campo donde el usuario escribe? (para no robar la tecla "/"). */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

export function SearchScreen({ items }: SearchScreenProps) {
  const { filters, updateFilters } = useCatalogFilters();
  const query = filters.query;
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const { recent, remember, forget, clear } = useRecentSearches();

  const hasQuery = tokenize(deferredQuery).length > 0;
  const results = useMemo(() => searchItems(items, deferredQuery), [items, deferredQuery]);
  const creators = useMemo(() => searchCreators(items, deferredQuery), [items, deferredQuery]);
  const correction = useMemo(
    () => (hasQuery && results.length === 0 ? suggestCorrection(items, deferredQuery) : null),
    [items, deferredQuery, hasQuery, results.length],
  );
  const collections = useMemo(
    () => [...new Set(items.flatMap((x) => x.categories))].filter((c) => c !== "Cortometraje").sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );

  // En escritorio el campo ya está listo para escribir; en móvil no se abre el teclado sin que el usuario lo pida.
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  // "/" lleva al buscador desde cualquier punto de la página (atajo habitual).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function setQuery(value: string) {
    updateFilters({ query: value });
  }

  function clearQuery() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className="relative min-h-[calc(100dvh-56px)] lg:min-h-[calc(100dvh-64px)]">
      <div className="relative z-[1] px-4 pb-24 pt-8 lg:px-12 lg:pt-14">
        <header className="mx-auto flex max-w-[640px] flex-col items-center text-center">
          <h1 className="text-[28px] font-bold leading-tight text-white lg:text-[36px]">
            {hasQuery ? "Encuentra tu próxima historia" : "¿Listo para una aventura?"}
          </h1>

          <form
            role="search"
            onSubmit={(event) => { event.preventDefault(); remember(query); }}
            className="mt-6 w-full max-w-[576px] transition-[max-width] duration-300 focus-within:max-w-[620px] motion-reduce:transition-none"
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/60" aria-hidden="true">
                <GmaIcon name="search" size={20} />
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                aria-label="Buscar cortos, películas y autores"
                placeholder="Buscar cortos, películas y autores…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && query) {
                    event.preventDefault();
                    setQuery("");
                  }
                }}
                className="h-12 w-full rounded-full border border-white/10 bg-white/5 pl-12 pr-12 text-[16px] font-medium text-white backdrop-blur-[24px] outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-white/50 focus:border-white/30 focus:bg-white/10 focus:shadow-[0_0_0_4px_rgba(34,177,107,0.18)] motion-reduce:transition-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  aria-label="Borrar búsqueda"
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#22B16B]"
                >
                  <GmaIcon name="close" size={16} />
                </button>
              )}
            </div>
          </form>
        </header>

        <div
          className="mx-auto mt-10 max-w-[1560px]"
          onClickCapture={(event) => {
            // Cualquier resultado abierto cuenta como búsqueda útil: se recuerda en el historial.
            if (hasQuery && (event.target as HTMLElement).closest("a")) remember(query);
          }}
        >
          {hasQuery ? (
            <>
              <p aria-live="polite" className="mb-6 text-center text-[14px] text-white/70">
                {results.length === 0
                  ? `Sin resultados para «${deferredQuery.trim()}»`
                  : `${results.length} ${results.length === 1 ? "resultado" : "resultados"} para «${deferredQuery.trim()}»`}
              </p>

              {creators.length > 0 && (
                <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[13px] text-white/60">Creadores</span>
                  {creators.map((creator) => (
                    <Link key={creator.slug} href={`/creadores/${creator.slug}`} className={CHIP_CLASS}>
                      {creator.name}
                    </Link>
                  ))}
                </div>
              )}

              {results.length > 0 ? (
                <div className={GRID_CLASS}>
                  {results.map(({ item }) => (
                    <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview caption href={workPath(item)} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  query={deferredQuery.trim()}
                  correction={correction}
                  collections={collections}
                  onPick={(value) => setQuery(value)}
                />
              )}
            </>
          ) : (
            <Idle
              items={items}
              collections={collections}
              recent={recent}
              onPick={(value) => { setQuery(value); inputRef.current?.focus(); }}
              onForget={forget}
              onClearRecent={clear}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sin consulta: historial, colecciones y destacados ─────────────────────────

interface IdleProps {
  readonly items: readonly MovieMedia[];
  readonly collections: readonly string[];
  readonly recent: readonly string[];
  readonly onPick: (query: string) => void;
  readonly onForget: (query: string) => void;
  readonly onClearRecent: () => void;
}

function Idle({ items, collections, recent, onPick, onForget, onClearRecent }: IdleProps) {
  const featured = items.slice(0, 10);
  return (
    <div className="flex flex-col gap-10">
      {recent.length > 0 && (
        <section aria-label="Búsquedas recientes" className="mx-auto flex max-w-[760px] flex-col items-center gap-3">
          <div className="flex items-center gap-3 text-[13px] text-white/60">
            <span>Búsquedas recientes</span>
            <button type="button" onClick={onClearRecent} className="underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-[#22B16B]">
              Borrar historial
            </button>
          </div>
          <ul className="flex flex-wrap justify-center gap-2">
            {recent.map((term) => (
              <li key={term} className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => onPick(term)}
                  className="min-h-11 pl-4 pr-2 text-[14px] font-medium text-[#EEF1F6] transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-[#22B16B]"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => onForget(term)}
                  aria-label={`Quitar «${term}» del historial`}
                  className="flex h-11 w-9 items-center justify-center text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#22B16B]"
                >
                  <GmaIcon name="close" size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {collections.length > 0 && (
        <section aria-label="Explorar por colección" className="mx-auto flex max-w-[900px] flex-col items-center gap-3">
          <p className="text-[13px] text-white/60">Explorar por colección</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {collections.map((name) => (
              <li key={name}>
                <Link href={`/cortos?genre=${encodeURIComponent(name)}`} className={CHIP_CLASS}>
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section aria-label="Destacados hoy">
          <h2 className="mb-6 text-center text-[20px] font-semibold text-[#EEF1F6]">Destacados hoy</h2>
          <div className={GRID_CLASS}>
            {featured.map((item) => (
              <PosterCard key={item.id} item={item} ratio="landscape" fluid hoverPreview caption href={workPath(item)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Sin resultados ───────────────────────────────────────────────────────────

interface EmptyStateProps {
  readonly query: string;
  readonly correction: string | null;
  readonly collections: readonly string[];
  readonly onPick: (query: string) => void;
}

function EmptyState({ query, correction, collections, onPick }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-5 py-12 text-center">
      <p className="max-w-full text-[18px] font-semibold text-white [overflow-wrap:anywhere]">
        No hemos encontrado &ldquo;{query}&rdquo;
      </p>
      {correction && (
        <p className="text-[15px] text-white/80">
          ¿Quisiste decir{" "}
          <button
            type="button"
            onClick={() => onPick(correction)}
            className="font-semibold text-[#22B16B] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#22B16B]"
          >
            {correction}
          </button>
          ?
        </p>
      )}
      <p className="text-[14px] text-white/60">Prueba con otro título, con el nombre de un autor o con una colección.</p>
      {collections.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2">
          {collections.slice(0, 8).map((name) => (
            <li key={name}>
              <button type="button" onClick={() => onPick(name)} className={CHIP_CLASS}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
