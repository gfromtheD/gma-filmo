import { expect, test } from "@playwright/test";
import {
  DEFAULT_FILTERS,
  DURATION_OPTIONS_MIN,
  activeFilterCount,
  deriveFilterOptions,
  filterItems,
  parseCatalogFilters,
  pickRandomItem,
  mergeFiltersIntoSearch,
  sortItems,
  toSearchParams,
  type CatalogFilters,
} from "../../lib/catalog/filters";
import type { MovieMedia } from "../../types/catalog";

function item(partial: Partial<MovieMedia> & { id: string }): MovieMedia {
  return {
    numericId: 1, kind: "movie", title: partial.id, year: 2024, rating: "TODOS", categories: ["Cortometraje"],
    synopsis: "", runtime: "2m 00s", style: { tone: ["#000", "#111"], accent: "#fff", motif: "ring" },
    ...partial,
  } as MovieMedia;
}

const CATALOG: MovieMedia[] = [
  item({ id: "a", numericId: 1, title: "Zeta", year: 2022, categories: ["Cortometraje", "Drama"], runtime: "1m 36s" }),
  item({ id: "b", numericId: 2, title: "Alfa", year: 2024, categories: ["Cortometraje", "Comedia", "Drama"], runtime: "2m 01s" }),
  item({ id: "c", numericId: 3, title: "Media", year: 2023, categories: ["Cortometraje", "Terror"], runtime: "9m 30s" }),
  item({ id: "d", numericId: 4, title: "Sin duración", year: 2024, categories: ["Cortometraje", "TOP"], runtime: "Corto" }),
];

const params = (query: string) => new URLSearchParams(query);

test.describe("parseCatalogFilters", () => {
  test("sin parámetros devuelve los valores por defecto", () => {
    expect(parseCatalogFilters(params(""))).toEqual(DEFAULT_FILTERS);
  });

  test("lee géneros repetidos, sin duplicados ni espacios", () => {
    const f = parseCatalogFilters(params("genre=Drama&genre=%20Terror%20&genre=Drama&genre="));
    expect(f.genres).toEqual(["Drama", "Terror"]);
  });

  test("lee año, duración máxima, orden y «en mi lista»", () => {
    const f = parseCatalogFilters(params("year=2023&maxDuration=5&sort=alpha&onlyInList=1"));
    expect(f).toEqual({ genres: [], year: 2023, maxDurationMin: 5, sort: "alpha", onlyInList: true });
  });

  test("ignora valores inválidos en vez de romper", () => {
    const f = parseCatalogFilters(params("year=abc&maxDuration=-3&sort=hacker&onlyInList=yes"));
    expect(f).toEqual(DEFAULT_FILTERS);
    expect(parseCatalogFilters(params("year=1500")).year).toBeNull();
    expect(parseCatalogFilters(params("year=2023.5")).year).toBeNull();
    expect(parseCatalogFilters(params("maxDuration=99999")).maxDurationMin).toBeNull();
  });

  test("acepta el formato antiguo de enlaces (?genre=X) sin cambios", () => {
    expect(parseCatalogFilters(params("genre=Drama")).genres).toEqual(["Drama"]);
  });
});

test.describe("toSearchParams", () => {
  test("los valores por defecto no ensucian la URL", () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  test("ida y vuelta: lo que se escribe se vuelve a leer igual", () => {
    const f: CatalogFilters = { genres: ["Drama", "Comedia"], year: 2024, maxDurationMin: 10, sort: "year-desc", onlyInList: true };
    expect(parseCatalogFilters(toSearchParams(f))).toEqual(f);
  });
});

test.describe("filterItems", () => {
  const always = () => false;

  test("sin filtros devuelve todo", () => {
    expect(filterItems(CATALOG, DEFAULT_FILTERS, always)).toHaveLength(4);
  });

  test("varios géneros se suman (cualquiera de ellos)", () => {
    const f = { ...DEFAULT_FILTERS, genres: ["Comedia", "Terror"] };
    expect(filterItems(CATALOG, f, always).map((x) => x.id)).toEqual(["b", "c"]);
  });

  test("por año exacto", () => {
    expect(filterItems(CATALOG, { ...DEFAULT_FILTERS, year: 2024 }, always).map((x) => x.id)).toEqual(["b", "d"]);
  });

  test("por duración máxima: «1m 36s» y «2m 01s» se entienden bien (antes nunca coincidían)", () => {
    const upTo2 = filterItems(CATALOG, { ...DEFAULT_FILTERS, maxDurationMin: 2 }, always).map((x) => x.id);
    expect(upTo2).toEqual(["a"]); // 1m 36s sí; 2m 01s se pasa de 2 min
    const upTo5 = filterItems(CATALOG, { ...DEFAULT_FILTERS, maxDurationMin: 5 }, always).map((x) => x.id);
    expect(upTo5).toEqual(["a", "b"]);
  });

  test("con duración máxima, los títulos sin duración conocida quedan fuera (no se adivina)", () => {
    expect(filterItems(CATALOG, { ...DEFAULT_FILTERS, maxDurationMin: 60 }, always).map((x) => x.id)).not.toContain("d");
  });

  test("solo los de mi lista", () => {
    const f = { ...DEFAULT_FILTERS, onlyInList: true };
    expect(filterItems(CATALOG, f, (id) => id === 3).map((x) => x.id)).toEqual(["c"]);
  });

  test("los filtros se combinan (todos a la vez)", () => {
    const f = { ...DEFAULT_FILTERS, genres: ["Drama"], year: 2024 };
    expect(filterItems(CATALOG, f, always).map((x) => x.id)).toEqual(["b"]);
  });

  test("no modifica la lista original", () => {
    const copy = JSON.stringify(CATALOG);
    filterItems(CATALOG, { ...DEFAULT_FILTERS, genres: ["Drama"] }, always);
    expect(JSON.stringify(CATALOG)).toBe(copy);
  });
});

test.describe("sortItems", () => {
  test("«recent» respeta el orden de llegada del catálogo", () => {
    expect(sortItems(CATALOG, "recent").map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
  test("alfabético, año ascendente y descendente", () => {
    expect(sortItems(CATALOG, "alpha").map((x) => x.id)).toEqual(["b", "c", "d", "a"]);
    expect(sortItems(CATALOG, "year-asc").map((x) => x.year)).toEqual([2022, 2023, 2024, 2024]);
    expect(sortItems(CATALOG, "year-desc").map((x) => x.year)).toEqual([2024, 2024, 2023, 2022]);
  });
  test("no modifica la lista original", () => {
    const before = CATALOG.map((x) => x.id).join();
    sortItems(CATALOG, "alpha");
    expect(CATALOG.map((x) => x.id).join()).toBe(before);
  });
});

test.describe("deriveFilterOptions", () => {
  test("géneros únicos y ordenados, sin «Cortometraje» (lo tienen todos)", () => {
    expect(deriveFilterOptions(CATALOG).genres).toEqual(["Comedia", "Drama", "Terror", "TOP"]);
  });
  test("años únicos de más reciente a más antiguo", () => {
    expect(deriveFilterOptions(CATALOG).years).toEqual([2024, 2023, 2022]);
  });
  test("ignora años desconocidos (0)", () => {
    expect(deriveFilterOptions([item({ id: "x", year: 0 })]).years).toEqual([]);
  });
  test("sirve igual para películas: mismas opciones calculadas del catálogo que se le pase", () => {
    const films = [item({ id: "p", genre: "Película", year: 2019, categories: ["Película", "Drama"] })];
    expect(deriveFilterOptions(films).genres).toEqual(["Drama", "Película"]);
  });
});

test.describe("activeFilterCount y duraciones", () => {
  test("cuenta cada filtro activo una vez (géneros juntos, orden por defecto no cuenta)", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, genres: ["A", "B"], year: 2024, maxDurationMin: 5, onlyInList: true, sort: "alpha" })).toBe(5);
  });
  test("las duraciones ofrecidas son de menor a mayor", () => {
    expect([...DURATION_OPTIONS_MIN]).toEqual([...DURATION_OPTIONS_MIN].sort((a, b) => a - b));
  });
});

test.describe("pickRandomItem", () => {
  test("elige según el número aleatorio dado", () => {
    expect(pickRandomItem(CATALOG, () => 0)?.id).toBe("a");
    expect(pickRandomItem(CATALOG, () => 0.99)?.id).toBe("d");
  });
  test("sin títulos devuelve null", () => {
    expect(pickRandomItem([], () => 0.5)).toBeNull();
  });
});

test.describe("mergeFiltersIntoSearch (conserva el resto de la URL)", () => {
  test("mantiene los parámetros que no son de filtros", () => {
    const merged = mergeFiltersIntoSearch(params("view=catalog&utm=abc"), { ...DEFAULT_FILTERS, year: 2024 });
    expect(merged.get("view")).toBe("catalog");
    expect(merged.get("utm")).toBe("abc");
    expect(merged.get("year")).toBe("2024");
  });

  test("sustituye los filtros anteriores por los nuevos", () => {
    const merged = mergeFiltersIntoSearch(params("genre=Drama&year=2020&maxDuration=5&sort=alpha&onlyInList=1&view=x"), {
      ...DEFAULT_FILTERS,
      genres: ["Terror"],
    });
    expect(merged.getAll("genre")).toEqual(["Terror"]);
    expect(merged.has("year")).toBe(false);
    expect(merged.has("maxDuration")).toBe(false);
    expect(merged.has("sort")).toBe(false);
    expect(merged.has("onlyInList")).toBe(false);
    expect(merged.get("view")).toBe("x");
  });

  test("con los filtros por defecto quita todos los de filtros y deja lo demás", () => {
    const merged = mergeFiltersIntoSearch(params("genre=Drama&year=2020&view=catalog"), DEFAULT_FILTERS);
    expect(merged.toString()).toBe("view=catalog");
  });

  test("no modifica los parámetros originales", () => {
    const original = params("genre=Drama&view=catalog");
    mergeFiltersIntoSearch(original, DEFAULT_FILTERS);
    expect(original.toString()).toBe("genre=Drama&view=catalog");
  });

  test("ida y vuelta: lo que se escribe se vuelve a leer igual", () => {
    const f: CatalogFilters = { genres: ["A", "B"], year: 2022, maxDurationMin: 10, sort: "year-asc", onlyInList: true };
    expect(parseCatalogFilters(mergeFiltersIntoSearch(params("view=catalog"), f))).toEqual(f);
  });
});
