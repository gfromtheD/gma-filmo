"use client";

import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { Check, NavArrowDown, Shuffle } from "@/components/ui/icons";
import {
  DURATION_OPTIONS_MIN,
  SORT_OPTIONS,
  activeFilterCount,
  type CatalogFilters,
  type SortKey,
} from "@/lib/catalog/filters";

interface FilterPillsProps {
  readonly filters: CatalogFilters;
  readonly options: { readonly genres: readonly string[]; readonly years: readonly number[] };
  /** «En mi lista» solo tiene sentido con sesión iniciada. */
  readonly showListFilter: boolean;
  readonly onChange: (next: CatalogFilters) => void;
  readonly onClear: () => void;
  /** «Sorpréndeme»: abre un título al azar entre los que cumplen los filtros. */
  readonly onRandom: () => void;
}

const SHORT_SORT_LABEL: Record<SortKey, string> = { recent: "Orden", alpha: "A → Z", "year-desc": "Año ↓", "year-asc": "Año ↑" };

const PILL_BASE =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[4px] border px-4 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B] sm:min-h-10";
const PILL_IDLE = "border-white/10 bg-white/5 text-white hover:bg-white/10 data-[state=open]:bg-white/10";
const PILL_ACTIVE = "border-[#22B16B]/50 bg-[#22B16B]/10 text-[#22B16B] hover:bg-[#22B16B]/15";
const MENU =
  "z-50 max-h-[min(60vh,340px)] w-[min(92vw,240px)] overflow-y-auto rounded-xl border border-white/10 bg-gma-surface p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)]";
const ITEM =
  "relative flex min-h-10 cursor-pointer items-center rounded-lg py-2 pl-9 pr-3 text-[14px] font-medium text-white/90 outline-none transition-colors data-[highlighted]:bg-white/10 data-[state=checked]:text-white";

function Tick() {
  return (
    <DropdownMenu.ItemIndicator className="absolute left-3 text-[#22B16B]">
      <Check size={16} strokeWidth={2.5} aria-hidden="true" />
    </DropdownMenu.ItemIndicator>
  );
}

/** Una píldora con su desplegable. */
function Pill({ label, active, dot = false, children }: { label: string; active: boolean; dot?: boolean; children: ReactNode }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={`group ${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}>
        {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
        <span className="whitespace-nowrap">{label}</span>
        <NavArrowDown size={16} strokeWidth={2} aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} collisionPadding={12} className={MENU}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function genreLabel(genres: readonly string[]): string {
  if (genres.length === 0) return "Categoría";
  return genres.length === 1 ? (genres[0] ?? "Categoría") : `${genres[0]} +${genres.length - 1}`;
}

/**
 * Filtros del catálogo como píldoras con desplegable: Género (varios a la vez), Año, Duración, Orden y
 * «En mi lista». Sirve igual para cortos y para películas: las opciones salen del propio catálogo.
 */
export function FilterPills({ filters, options, showListFilter, onChange, onClear, onRandom }: FilterPillsProps) {
  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch });
  const toggleGenre = (genre: string, on: boolean) =>
    set({ genres: on ? [...filters.genres, genre] : filters.genres.filter((g) => g !== genre) });
  const active = activeFilterCount(filters);

  return (
    <div role="group" aria-label="Filtros del catálogo" className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={onRandom}
        aria-label="Sorpréndeme"
        title="Sorpréndeme"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B] sm:h-10 sm:w-10"
      >
        <Shuffle size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <Pill label={genreLabel(filters.genres)} active={filters.genres.length > 0}>
        <DropdownMenu.Item className={ITEM} onSelect={() => set({ genres: [] })}>
          {filters.genres.length === 0 && <span className="absolute left-3 text-[#22B16B]"><Check size={16} strokeWidth={2.5} aria-hidden="true" /></span>}
          Todas las categorías
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
        {options.genres.map((genre) => (
          <DropdownMenu.CheckboxItem
            key={genre}
            className={ITEM}
            checked={filters.genres.includes(genre)}
            onCheckedChange={(on) => toggleGenre(genre, on === true)}
            onSelect={(event) => event.preventDefault()} // sigue abierto para elegir otro género
          >
            <Tick />
            {genre}
          </DropdownMenu.CheckboxItem>
        ))}
      </Pill>

      <Pill label={filters.year === null ? "Año" : String(filters.year)} active={filters.year !== null}>
        <DropdownMenu.RadioGroup value={filters.year === null ? "" : String(filters.year)} onValueChange={(v) => set({ year: v === "" ? null : Number(v) })}>
          <DropdownMenu.RadioItem value="" className={ITEM}><Tick />Todos los años</DropdownMenu.RadioItem>
          {options.years.map((year) => (
            <DropdownMenu.RadioItem key={year} value={String(year)} className={ITEM}><Tick />{year}</DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </Pill>

      <Pill label={filters.maxDurationMin === null ? "Duración" : `≤ ${filters.maxDurationMin} min`} active={filters.maxDurationMin !== null}>
        <DropdownMenu.RadioGroup value={filters.maxDurationMin === null ? "" : String(filters.maxDurationMin)} onValueChange={(v) => set({ maxDurationMin: v === "" ? null : Number(v) })}>
          <DropdownMenu.RadioItem value="" className={ITEM}><Tick />Cualquier duración</DropdownMenu.RadioItem>
          {DURATION_OPTIONS_MIN.map((minutes) => (
            <DropdownMenu.RadioItem key={minutes} value={String(minutes)} className={ITEM}><Tick />Menos de {minutes} min</DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </Pill>

      <Pill label={SHORT_SORT_LABEL[filters.sort]} active={filters.sort !== "recent"} dot={filters.sort !== "recent"}>
        <DropdownMenu.RadioGroup value={filters.sort} onValueChange={(v) => set({ sort: v as SortKey })}>
          {SORT_OPTIONS.map((option) => (
            <DropdownMenu.RadioItem key={option.key} value={option.key} className={ITEM}><Tick />{option.label}</DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </Pill>

      {showListFilter && (
        <button
          type="button"
          aria-pressed={filters.onlyInList}
          onClick={() => set({ onlyInList: !filters.onlyInList })}
          className={`${PILL_BASE} ${filters.onlyInList ? PILL_ACTIVE : PILL_IDLE}`}
        >
          {filters.onlyInList && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
          En mi lista
        </button>
      )}

      {active > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 shrink-0 rounded-[4px] px-3 text-[13px] font-semibold text-[#999999] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B]"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
