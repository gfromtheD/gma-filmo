/**
 * Filtros del catálogo (cortos hoy, películas mañana): lectura y escritura en la URL, aplicación y opciones.
 * Sin dependencias de React: la URL es la única fuente de verdad y todo se prueba sin navegador.
 */

import { parseRuntimeSeconds } from "@/lib/comments/timestamp";
import type { MovieMedia } from "@/types/catalog";

export type SortKey = "recent" | "alpha" | "year-asc" | "year-desc";

export interface CatalogFilters {
  /** Varios géneros se suman: sale lo que tenga cualquiera de ellos. */
  readonly genres: readonly string[];
  /** Año exacto, o `null` para todos. */
  readonly year: number | null;
  /** Duración máxima en minutos, o `null` para cualquiera. */
  readonly maxDurationMin: number | null;
  readonly onlyInList: boolean;
  readonly sort: SortKey;
}

export const DEFAULT_FILTERS: CatalogFilters = { genres: [], year: null, maxDurationMin: null, onlyInList: false, sort: "recent" };

export const SORT_OPTIONS: readonly { readonly key: SortKey; readonly label: string }[] = [
  { key: "recent", label: "Más reciente" },
  { key: "alpha", label: "A → Z" },
  { key: "year-desc", label: "Año: de más nuevo a más antiguo" },
  { key: "year-asc", label: "Año: de más antiguo a más nuevo" },
];

/** Duraciones máximas que se ofrecen (minutos). */
export const DURATION_OPTIONS_MIN = [1, 2, 5, 10, 20] as const;

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((o) => o.key));
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_DURATION_MIN = 600;
/** Todos los cortos llevan esta etiqueta: no sirve como género para filtrar. */
const NOT_A_GENRE = new Set(["Cortometraje"]);

function parseBoundedInteger(raw: string | null, min: number, max: number): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

/** Lee los filtros de la URL. Lo inválido se ignora en vez de romper la página. */
export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const genres = [...new Set(params.getAll("genre").map((g) => g.trim()).filter(Boolean))];
  const sort = params.get("sort") ?? "";
  return {
    genres,
    year: parseBoundedInteger(params.get("year"), MIN_YEAR, MAX_YEAR),
    maxDurationMin: parseBoundedInteger(params.get("maxDuration"), 1, MAX_DURATION_MIN),
    onlyInList: params.get("onlyInList") === "1",
    sort: SORT_KEYS.has(sort) ? (sort as SortKey) : "recent",
  };
}

/** Escribe solo lo que no es el valor por defecto, para URLs limpias y compartibles. */
export function toSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const genre of filters.genres) params.append("genre", genre);
  if (filters.year !== null) params.set("year", String(filters.year));
  if (filters.maxDurationMin !== null) params.set("maxDuration", String(filters.maxDurationMin));
  if (filters.onlyInList) params.set("onlyInList", "1");
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  return params;
}

/** Parámetros de la URL que pertenecen a los filtros (el resto de la URL no se toca). */
const FILTER_PARAM_KEYS = ["genre", "year", "maxDuration", "onlyInList", "sort"] as const;

/**
 * Pone los filtros en una URL conservando todo lo que no sea de filtros (otros parámetros, enlaces compartidos
 * con campañas, etc.). Devuelve una copia: no modifica la original.
 */
export function mergeFiltersIntoSearch(current: URLSearchParams, filters: CatalogFilters): URLSearchParams {
  const merged = new URLSearchParams(current);
  for (const key of FILTER_PARAM_KEYS) merged.delete(key);
  for (const [key, value] of toSearchParams(filters)) merged.append(key, value);
  return merged;
}

/** Número de filtros activos (los géneros cuentan como uno; el orden por defecto no cuenta). */
export function activeFilterCount(filters: CatalogFilters): number {
  return (
    (filters.genres.length > 0 ? 1 : 0) +
    (filters.year !== null ? 1 : 0) +
    (filters.maxDurationMin !== null ? 1 : 0) +
    (filters.onlyInList ? 1 : 0) +
    (filters.sort !== "recent" ? 1 : 0)
  );
}

/** Aplica los filtros (no ordena). Devuelve una lista nueva. */
export function filterItems(
  items: readonly MovieMedia[],
  filters: CatalogFilters,
  isInList: (numericId: number) => boolean,
): MovieMedia[] {
  return items.filter((item) => {
    if (filters.genres.length > 0 && !filters.genres.some((g) => item.categories.includes(g))) return false;
    if (filters.year !== null && item.year !== filters.year) return false;
    if (filters.maxDurationMin !== null) {
      const seconds = parseRuntimeSeconds(item.runtime);
      if (seconds === null || seconds > filters.maxDurationMin * 60) return false; // sin duración conocida no se adivina
    }
    if (filters.onlyInList && !isInList(item.numericId)) return false;
    return true;
  });
}

/** Ordena sin tocar la lista original. «recent» respeta el orden de llegada del catálogo. */
export function sortItems(items: readonly MovieMedia[], key: SortKey): MovieMedia[] {
  const copy = [...items];
  if (key === "alpha") return copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
  if (key === "year-asc") return copy.sort((a, b) => a.year - b.year);
  if (key === "year-desc") return copy.sort((a, b) => b.year - a.year);
  return copy;
}

/** Opciones de los desplegables, calculadas del propio catálogo (sirve igual para cortos y para películas). */
export function deriveFilterOptions(items: readonly MovieMedia[]): { genres: string[]; years: number[] } {
  const genres = [...new Set(items.flatMap((x) => x.categories).filter((c) => !NOT_A_GENRE.has(c)))].sort((a, b) => a.localeCompare(b, "es"));
  const years = [...new Set(items.map((x) => x.year).filter((y) => y > 0))].sort((a, b) => b - a);
  return { genres, years };
}

/** Un título al azar (para el botón «Sorpréndeme»). */
export function pickRandomItem<T>(items: readonly T[], random: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] ?? null;
}
