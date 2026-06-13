"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { PosterCard } from "@/components/ui/poster-card";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import type { MovieMedia } from "@/types/catalog";

// ─── Keyboard layout ──────────────────────────────────────────────────────────

const KB_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <>
      <span>{text.slice(0, idx)}</span>
      <span className="font-bold text-[#22B16B]">
        {text.slice(idx, idx + query.length)}
      </span>
      <span>{text.slice(idx + query.length)}</span>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SearchScreenProps {
  readonly items: readonly MovieMedia[];
}

export function SearchScreen({ items }: SearchScreenProps) {
  const router = useRouter();
  const { filters, updateFilters } = useCatalogFilters();
  const query = filters.query;
  const inputRef = useRef<HTMLInputElement>(null);

  function filterItems(q: string): readonly MovieMedia[] {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return items.filter(
      (x) =>
        x.title.toLowerCase().includes(lower) ||
        x.categories.some((c) => c.toLowerCase().includes(lower)) ||
        (x.author?.toLowerCase().includes(lower) ?? false),
    );
  }

  const results     = filterItems(query);
  const predictions = results.slice(0, 6);

  function setQuery(q: string) { updateFilters({ query: q }); }

  function handleKeyPress(char: string) {
    setQuery(query + char.toLowerCase());
    inputRef.current?.focus();
  }

  function handleBackspace() {
    setQuery(query.slice(0, -1));
    inputRef.current?.focus();
  }

  function handleSpace() {
    setQuery(query + " ");
    inputRef.current?.focus();
  }

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "380px 1fr",
        height: "calc(100vh - 72px)",
      }}
    >
      {/* ── Left: input + keyboard ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 overflow-y-auto border-r border-[#262626] p-6">
        {/* Search input */}
        <div className="relative">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6D7D94]">
            <GmaIcon name="search" size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Título, colección, autor…"
            autoFocus
            className="w-full rounded-[10px] border border-[#262626] bg-[#1A1A1A] py-3 pl-11 pr-10 text-[15px] font-medium text-white placeholder-[#6D7D94] outline-none transition-[border-color] duration-150 focus:border-[#22B16B]"
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6D7D94] transition-colors hover:text-white"
              onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
              type="button"
              aria-label="Borrar búsqueda"
            >
              <GmaIcon name="close" size={16} />
            </button>
          )}
        </div>

        {/* On-screen keyboard */}
        <div className="flex flex-col gap-1.75">
          {KB_ROWS.map((row, ri) => (
            <div
              key={ri}
              className="flex gap-1.75"
              style={{ justifyContent: ri === 0 ? "flex-start" : "center" }}
            >
              {row.map((char) => (
                <button
                  key={char}
                  type="button"
                  aria-label={char}
                  onMouseDown={(e) => { e.preventDefault(); handleKeyPress(char); }}
                  className="flex h-11 w-8 items-center justify-center rounded-[8px] bg-[#1A1A1A] text-[14px] font-bold text-white transition-[background-color,transform] duration-100 hover:bg-[#262626] active:scale-95 active:bg-[#22B16B]/20"
                >
                  {char}
                </button>
              ))}
            </div>
          ))}

          {/* Bottom action row */}
          <div className="flex gap-1.75">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleBackspace(); }}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#1A1A1A] text-[13px] font-semibold text-[#B8C5D4] transition-[background-color] duration-100 hover:bg-[#262626] active:bg-[#22B16B]/20"
              aria-label="Borrar"
            >
              <GmaIcon name="delete" size={16} />
              <span>Borrar</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSpace(); }}
              className="flex h-11 flex-2 items-center justify-center rounded-[8px] bg-[#1A1A1A] text-[13px] font-semibold text-[#B8C5D4] transition-[background-color] duration-100 hover:bg-[#262626] active:bg-[#22B16B]/20"
              aria-label="Espacio"
            >
              Espacio
            </button>
          </div>
        </div>

        {/* Predictions — text only, below keyboard */}
        {query && (
          <div className="mt-4 border-t border-[#1E1E1E] pt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#6D7D94]">
              Sugerencias
            </p>
            {predictions.length > 0 ? (
              <ul className="flex flex-col">
                {predictions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); router.push(`/cortos/${item.id}`); }}
                      className="flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-[#1A1A1A]"
                    >
                      <span className="truncate text-[13px] font-semibold text-white">
                        <HighlightedText text={item.title} query={query} />
                      </span>
                      <GmaIcon name="chevronRight" size={13} className="ml-2 shrink-0 text-[#6D7D94]" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#6D7D94]">Sin sugerencias</p>
            )}
          </div>
        )}
      </div>

      {/* ── Right: results grid ────────────────────────────────────────────── */}
      <div className="overflow-y-auto p-6">
        {query ? (
          <>
            <p className="mb-5 text-[13px] font-semibold text-[#B8C5D4]">
              Resultados{" "}
              <span className="ml-1 rounded-full bg-[#1A1A1A] px-2 py-0.5 text-[12px] font-bold text-white">
                {results.length}
              </span>
            </p>

            {results.length > 0 ? (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
              >
                {results.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    ratio="portrait"
                    fluid
                    href={`/cortos/${item.id}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState query={query} />
            )}
          </>
        ) : (
          <BrowseByGenre items={items} />
        )}
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A] text-[#6D7D94]">
        <GmaIcon name="search" size={28} />
      </div>
      <p className="mb-2 text-[16px] font-bold text-white">
        Sin resultados para &ldquo;{query}&rdquo;
      </p>
      <p className="text-[13px] text-[#6D7D94]">
        Intenta con otro título, colección o autor.
      </p>
    </div>
  );
}

// ─── Browse by genre (idle state) ────────────────────────────────────────────

function BrowseByGenre({ items }: { items: readonly MovieMedia[] }) {
  const router  = useRouter();
  const genres  = [...new Set(items.flatMap((x) => x.categories))].sort();
  const suggested = items.slice(0, 9);

  return (
    <div className="flex flex-col gap-8">
      {genres.length > 0 && (
        <div>
          <p className="mb-5 text-[13px] font-semibold text-[#B8C5D4]">Explorar por colección</p>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => router.push(`/cortos?genre=${encodeURIComponent(g)}`)}
                className="rounded-full border border-[#262626] bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold text-[#B8C5D4] transition-colors hover:border-[#22B16B]/40 hover:text-white"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {suggested.length > 0 && (
        <div>
          <p className="mb-5 text-[13px] font-semibold text-[#B8C5D4]">Sugeridos para ti</p>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {suggested.map((item) => (
              <PosterCard
                key={item.id}
                item={item}
                ratio="portrait"
                fluid
                href={`/cortos/${item.id}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
