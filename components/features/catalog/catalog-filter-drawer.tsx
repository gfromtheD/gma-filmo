"use client";

import { useState, useRef, useEffect } from "react";
import { X, SlidersHorizontal, Check } from "lucide-react";
import type { MovieMedia } from "@/types/catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortKey = "recent" | "alpha" | "year-asc" | "year-desc";

export interface CatalogFilters {
  genres:      string[];
  yearFrom:    number;
  yearTo:      number;
  maxDuration: number | null;
  countries:   string[];
  languages:   string[];
  onlyInList:  boolean;
  sort:        SortKey;
}

interface CatalogFilterDrawerProps {
  readonly items:          readonly MovieMedia[];
  readonly allGenres:      readonly string[];
  readonly filters:        CatalogFilters;
  readonly onApply:        (f: CatalogFilters) => void;
  readonly onClear:        () => void;
  readonly getDraftCount:  (f: CatalogFilters) => number;
  readonly minYear:        number;
  readonly maxYear:        number;
}

const MONO: React.CSSProperties = {
  fontFamily: "ui-monospace, 'Cascadia Code', monospace",
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent",    label: "Más reciente" },
  { key: "alpha",     label: "A → Z"        },
  { key: "year-desc", label: "Año ↓"        },
  { key: "year-asc",  label: "Año ↑"        },
];

const COUNTRIES = [
  "España",
  "México",
  "Argentina",
  "Colombia",
  "Chile",
  "Perú",
  "Cuba",
  "Venezuela",
  "Uruguay",
  "Bolivia",
];

const LANGUAGES = ["Español", "VOSE", "VO subt. en", "Italiano", "Coreano"];

function parseRuntimeMinutes(runtime: string): number {
  const hours = runtime.match(/(\d+)\s*h/i);
  const mins  = runtime.match(/(\d+)\s*min/i);
  if (mins) return (hours ? parseInt(hours[1]!) * 60 : 0) + parseInt(mins[1]!);
  const colon = runtime.match(/^(\d+):(\d{2})$/);
  if (colon) return parseInt(colon[1]!) * 60 + parseInt(colon[2]!);
  return Infinity;
}

// ─── Trigger button ───────────────────────────────────────────────────────────

export function FilterTriggerButton({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick:     () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition-[border-color,background-color,color] ${
        activeCount > 0
          ? "border-[#22B16B]/40 bg-[#22B16B]/10 text-[#22B16B]"
          : "border-[#262626] bg-[#111111] text-[#8A9BB0] hover:border-[#303030] hover:text-white"
      }`}
    >
      <SlidersHorizontal size={14} strokeWidth={1.75} />
      Filtros
      {activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#22B16B] px-1 text-[10px] font-bold text-gma-accent-fg">
          {activeCount}
        </span>
      )}
    </button>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function CatalogFilterDrawer({
  items,
  allGenres,
  filters,
  onApply,
  onClear,
  getDraftCount,
  minYear,
  maxYear,
}: CatalogFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  const runtimes = items
    .map((x) => parseRuntimeMinutes(x.runtime))
    .filter((v): v is number => isFinite(v));
  const maxDurMinutes = runtimes.length ? Math.ceil(Math.max(...runtimes) / 5) * 5 : 200;

  const [draft, setDraft] = useState<CatalogFilters>(filters);

  useEffect(() => { setDraft(filters); }, [filters]);

  function openDrawer()  { setDraft(filters); setOpen(true); }
  function closeDrawer() { setOpen(false); }

  function toggleGenre(g: string) {
    setDraft((d) => ({
      ...d,
      genres: d.genres.includes(g) ? d.genres.filter((x) => x !== g) : [...d.genres, g],
    }));
  }

  function toggleCountry(c: string) {
    setDraft((d) => ({
      ...d,
      countries: d.countries.includes(c) ? d.countries.filter((x) => x !== c) : [...d.countries, c],
    }));
  }

  function toggleLanguage(l: string) {
    setDraft((d) => ({
      ...d,
      languages: d.languages.includes(l) ? d.languages.filter((x) => x !== l) : [...d.languages, l],
    }));
  }

  function apply() {
    onApply(draft);
    closeDrawer();
  }

  function clearAll() {
    const empty: CatalogFilters = {
      genres: [], yearFrom: minYear, yearTo: maxYear,
      maxDuration: null, countries: [], languages: [], onlyInList: false,
      sort: "recent",
    };
    setDraft(empty);
    onClear();
    closeDrawer();
  }

  const activeCount =
    filters.genres.length +
    (filters.yearFrom !== minYear || filters.yearTo !== maxYear ? 1 : 0) +
    (filters.maxDuration !== null ? 1 : 0) +
    (filters.countries.length > 0 ? 1 : 0) +
    (filters.languages.length > 0 ? 1 : 0) +
    (filters.onlyInList ? 1 : 0) +
    (filters.sort !== "recent" ? 1 : 0);

  const draftResultCount = getDraftCount(draft);

  const draftActiveCount =
    draft.genres.length +
    (draft.yearFrom !== minYear || draft.yearTo !== maxYear ? 1 : 0) +
    (draft.maxDuration !== null ? 1 : 0) +
    (draft.countries.length > 0 ? 1 : 0) +
    (draft.languages.length > 0 ? 1 : 0) +
    (draft.onlyInList ? 1 : 0) +
    (draft.sort !== "recent" ? 1 : 0);

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) closeDrawer();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeDrawer(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <FilterTriggerButton activeCount={activeCount} onClick={openDrawer} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onBackdrop}
        >
          <div
            className="relative flex h-full w-110 flex-col overflow-hidden border-l border-[#1E1E1E]"
            style={{ background: "#0D0D0D" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-[#1E1E1E] px-6 py-4">
              <SlidersHorizontal size={18} strokeWidth={1.75} className="text-white" />
              <h2 className="flex-1 text-[17px] font-bold text-white">Filtros</h2>
              {draftActiveCount > 0 && (
                <span
                  className="text-[10.5px] font-bold uppercase tracking-widest text-[#22B16B]"
                  style={MONO}
                >
                  {draftActiveCount} {draftActiveCount === 1 ? "activo" : "activos"}
                </span>
              )}
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5A6A7E] transition-colors hover:bg-[#1A1A1A] hover:text-white"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#2A2A2A transparent" }}
            >
              {/* Géneros */}
              <Section title="Géneros">
                <div className="flex flex-wrap gap-2">
                  {allGenres.map((g) => (
                    <DrawerChip
                      key={g}
                      label={g}
                      active={draft.genres.includes(g)}
                      onClick={() => toggleGenre(g)}
                    />
                  ))}
                </div>
              </Section>

              {/* Año */}
              <Section title="Año">
                <YearRangeSlider
                  min={minYear}
                  max={maxYear}
                  from={draft.yearFrom}
                  to={draft.yearTo}
                  onChange={(from, to) => setDraft((d) => ({ ...d, yearFrom: from, yearTo: to }))}
                />
              </Section>

              {/* Duración */}
              <Section title="Duración">
                <DurationSlider
                  value={draft.maxDuration}
                  onChange={(v) => setDraft((d) => ({ ...d, maxDuration: v }))}
                  max={maxDurMinutes}
                />
              </Section>

              {/* País */}
              <Section title="País">
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((c) => (
                    <DrawerChip
                      key={c}
                      label={c}
                      active={draft.countries.includes(c)}
                      onClick={() => toggleCountry(c)}
                    />
                  ))}
                  <DrawerChip label="+32 más" active={false} onClick={() => {}} muted />
                </div>
              </Section>

              {/* Idioma */}
              <Section title="Idioma">
                <div className="flex flex-col">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLanguage(l)}
                      className="flex items-center gap-3 rounded-lg px-1 py-2.5 text-[13px] transition-colors hover:bg-[#1A1A1A]"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          draft.languages.includes(l)
                            ? "border-[#22B16B] bg-[#22B16B]"
                            : "border-[#3A3A3A] bg-transparent"
                        }`}
                      >
                        {draft.languages.includes(l) && (
                          <Check size={10} strokeWidth={3} className="text-gma-accent-fg" />
                        )}
                      </span>
                      <span
                        className={
                          draft.languages.includes(l)
                            ? "font-semibold text-white"
                            : "text-[#8A9BB0]"
                        }
                      >
                        {l}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              {/* Otras */}
              <Section title="Otras">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, onlyInList: !d.onlyInList }))}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-2.5 transition-colors hover:bg-[#1A1A1A]"
                >
                  <span
                    className={`text-[13px] ${
                      draft.onlyInList ? "font-semibold text-white" : "text-[#B8C5D4]"
                    }`}
                  >
                    Solo en mi lista
                  </span>
                  <ToggleSwitch on={draft.onlyInList} />
                </button>
              </Section>

              {/* Ordenar por */}
              <Section title="Ordenar por">
                <div className="flex flex-col gap-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, sort: opt.key }))}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors hover:bg-[#1A1A1A] ${
                        draft.sort === opt.key ? "text-[#22B16B]" : "text-[#8A9BB0] hover:text-white"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full border transition-colors ${
                          draft.sort === opt.key
                            ? "border-[#22B16B] bg-[#22B16B]"
                            : "border-[#3A3A3A] bg-transparent"
                        }`}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#1E1E1E] px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex-1 rounded-full border border-[#262626] py-2.5 text-[13px] font-semibold text-[#8A9BB0] transition-colors hover:border-[#3A3A3A] hover:text-white"
                >
                  Limpiar todo
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#22B16B] py-2.5 text-[13px] font-bold text-gma-accent-fg transition-colors hover:bg-[#2AC57A]"
                >
                  Ver {draftResultCount} {draftResultCount === 1 ? "resultado" : "resultados"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#1A1A1A] px-6 py-5">
      <h3 className="mb-3.5 text-[13.5px] font-bold text-white">{title}</h3>
      {children}
    </div>
  );
}

// ─── Drawer chip ──────────────────────────────────────────────────────────────

function DrawerChip({
  label,
  active,
  onClick,
  muted = false,
}: {
  label:   string;
  active:  boolean;
  onClick: () => void;
  muted?:  boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={muted}
      className={`inline-flex items-center rounded-full border px-3.5 py-1.75 text-[12.5px] font-semibold transition-[color,border-color,background-color] duration-150 ${
        muted
          ? "cursor-default border-[#232323] bg-transparent text-[#5A6A7E]"
          : active
            ? "border-[#22B16B] bg-[#22B16B]/10 text-[#22B16B]"
            : "border-[#232323] bg-[#141414] text-[#8A9BB0] hover:border-[#2E2E2E] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div
      className={`relative h-5.5 w-9.5 rounded-full transition-colors duration-200 ${
        on ? "bg-[#22B16B]" : "bg-[#2A2A2A]"
      }`}
    >
      <div
        className={`absolute top-0.75 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          on ? "translate-x-4.5" : "translate-x-0.75"
        }`}
      />
    </div>
  );
}

// ─── Duration slider (single handle) ─────────────────────────────────────────

function DurationSlider({
  value,
  onChange,
  max,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
  max:      number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const current  = value ?? max;
  const pct      = (current / max) * 100;

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const rect = trackRef.current!.getBoundingClientRect();
    function move(ev: PointerEvent) {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const v = Math.round(p * max);
      onChange(v >= max ? null : Math.max(1, v));
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-[#5A6A7E]">Máximo</span>
        <span className="text-[13px] font-semibold text-white" style={MONO}>
          {value === null ? "Sin límite" : `< ${value} min`}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative mx-1 my-3 h-1 rounded-full bg-[#2A2A2A]"
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-[#22B16B]"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[#22B16B] bg-[#0D0D0D] shadow-lg transition-transform hover:scale-110 active:cursor-grabbing active:scale-110"
          style={{ left: `${pct}%` }}
          onPointerDown={startDrag}
        />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-[11px] text-[#5A6A7E]" style={MONO}>0 min</span>
        <span className="text-[11px] text-[#5A6A7E]" style={MONO}>{max} min</span>
      </div>
    </div>
  );
}

// ─── Year range slider ────────────────────────────────────────────────────────

function YearRangeSlider({
  min, max, from, to,
  onChange,
}: {
  min: number; max: number;
  from: number; to: number;
  onChange: (from: number, to: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const range    = max - min || 1;
  const fromPct  = ((from - min) / range) * 100;
  const toPct    = ((to   - min) / range) * 100;

  function clampYear(v: number) { return Math.max(min, Math.min(max, v)); }

  function startDrag(handle: "from" | "to") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      const rect = trackRef.current!.getBoundingClientRect();
      function move(ev: PointerEvent) {
        const pct  = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const year = Math.round(min + pct * range);
        if (handle === "from") onChange(clampYear(Math.min(year, to - 1)), to);
        else                   onChange(from, clampYear(Math.max(year, from + 1)));
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    };
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="relative mx-1 my-3 h-1 rounded-full bg-[#2A2A2A]"
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute top-0 h-full rounded-full bg-[#22B16B]"
          style={{ left: `${fromPct}%`, width: `${toPct - fromPct}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[#22B16B] bg-[#0D0D0D] shadow-lg transition-transform hover:scale-110 active:cursor-grabbing active:scale-110"
          style={{ left: `${fromPct}%` }}
          onPointerDown={startDrag("from")}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[#22B16B] bg-[#0D0D0D] shadow-lg transition-transform hover:scale-110 active:cursor-grabbing active:scale-110"
          style={{ left: `${toPct}%` }}
          onPointerDown={startDrag("to")}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <YearBox value={from} min={min}      max={to - 1} onChange={(v) => onChange(v, to)}   />
        <div className="h-px flex-1 bg-[#2A2A2A]" />
        <YearBox value={to}   min={from + 1} max={max}    onChange={(v) => onChange(from, v)} />
      </div>

      <div className="mt-1 flex justify-between">
        <span className="text-[11px] text-[#5A6A7E]" style={MONO}>{min}</span>
        <span className="text-[11px] text-[#5A6A7E]" style={MONO}>{max}</span>
      </div>
    </div>
  );
}

function YearBox({
  value, min, max, onChange,
}: {
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = parseInt(e.target.value);
        if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      className="w-19 rounded-lg border border-[#2A2A2A] bg-[#141414] py-2 text-center text-[14px] font-semibold text-white focus:border-[#22B16B]/50 focus:outline-none"
      style={MONO}
    />
  );
}
