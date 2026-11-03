import { expect, test } from "@playwright/test";
import { normalizePopularity, popularityScore, REAL_POPULARITY_WEIGHT } from "../../lib/recommendation/popularity";
import { markShown, mergeShown, parseShownBody, pruneShown, SHOWN_BATCH_MAX, SHOWN_WINDOW_MS, shownFromRows } from "../../lib/recommendation/shown-memory";

const NOW = Date.parse("2026-11-03T12:00:00Z");

test.describe("popularidad real", () => {
  test("normaliza a 0–1 dividiendo por el título más visto y descarta filas no válidas", () => {
    const map = normalizePopularity([
      { pelicula_id: 1, viewers: 10 }, { pelicula_id: "2", viewers: "5" }, { pelicula_id: 3, viewers: 0 }, { pelicula_id: -4, viewers: 3 }, { pelicula_id: 5, viewers: Number.NaN },
    ]);
    expect([...map.entries()]).toEqual([[1, 1], [2, 0.5]]);
  });

  test("sin datos reales no cambia nada; con ellos, mezcla con más peso en lo real", () => {
    expect(normalizePopularity([]).size).toBe(0);
    expect(popularityScore(0.4, undefined)).toBe(0.4);
    expect(popularityScore(0.2, 1)).toBeCloseTo(REAL_POPULARITY_WEIGHT * 1 + (1 - REAL_POPULARITY_WEIGHT) * 0.2, 10);
    expect(popularityScore(0.9, 0)).toBeLessThan(popularityScore(0.9, undefined));
  });
});

test.describe("memoria de lo mostrado", () => {
  test("pruneShown quita lo anterior a 48 h y conserva lo reciente", () => {
    const pruned = pruneShown({ viejo: NOW - SHOWN_WINDOW_MS - 1, justo: NOW - SHOWN_WINDOW_MS, nuevo: NOW - 1000 }, NOW);
    expect(Object.keys(pruned).sort()).toEqual(["justo", "nuevo"]);
  });

  test("mergeShown se queda con la fecha más reciente de cada título", () => {
    const merged = mergeShown({ a: NOW - 5000, b: NOW - 9000 }, { a: NOW - 1000, c: NOW - 2000 }, NOW);
    expect(merged).toEqual({ a: NOW - 1000, b: NOW - 9000, c: NOW - 2000 });
  });

  test("markShown anota los nuevos con la hora de ahora y no modifica el original", () => {
    const original = { a: NOW - 5000 };
    const next = markShown(original, ["b", "a"], NOW);
    expect(next).toEqual({ a: NOW, b: NOW });
    expect(original).toEqual({ a: NOW - 5000 });
  });

  test("parseShownBody exige una lista no vacía, de ids de texto, sin repetidos y con tope", () => {
    expect(parseShownBody({ items: ["a", "b", "a"] })).toEqual(["a", "b"]);
    for (const bad of [null, [], { items: [] }, { items: [1] }, { items: [""] }, { items: "a" }, { items: Array.from({ length: SHOWN_BATCH_MAX + 1 }, (_, i) => `x${i}`) }]) {
      expect(parseShownBody(bad)).toBeNull();
    }
  });

  test("shownFromRows convierte las filas de la base y se queda con la fecha más reciente", () => {
    expect(shownFromRows([{ item_id: "a", shown_at: "2026-11-03T10:00:00Z" }, { item_id: "a", shown_at: "2026-11-03T11:00:00Z" }, { item_id: "b", shown_at: "no-es-fecha" }]))
      .toEqual({ a: Date.parse("2026-11-03T11:00:00Z") });
  });
});
