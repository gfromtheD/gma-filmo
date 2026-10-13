import { expect, test } from "@playwright/test";
import {
  collectionsWithContent,
  pickRecommendedCollections,
  type CollectionWithCount,
} from "../../lib/recommendation/collection-picks";

// Lógica pura: no necesita navegador ni servidor.
const col = (slug: string, name: string) =>
  ({ slug, name, r2_cover_url: null }) as unknown as CollectionWithCount["col"];
const item = (id: string, categories: string[]) => ({ id, categories }) as never;

const CANDIDATES: CollectionWithCount[] = ["Drama", "Comedia", "3D", "TOP", "Stop Motion", "Evolución", "+18"].map(
  (name, i) => ({ col: col(name.toLowerCase(), name), filmCount: i + 1 }),
);

test("solo se consideran colecciones con al menos un título", () => {
  const cols = [col("a", "A"), col("b", "B"), col("c", "C")];
  const items = [item("1", ["A"]), item("2", ["A", "C"])];
  const result = collectionsWithContent(cols, items);
  expect(result.map((r) => r.col.name)).toEqual(["A", "C"]);
  expect(result.map((r) => r.filmCount)).toEqual([2, 1]);
});

test("respeta el máximo y nunca repite colecciones", () => {
  const picks = pickRecommendedCollections(CANDIDATES, {}, 0.42, 4);
  expect(picks).toHaveLength(4);
  expect(new Set(picks.map((p) => p.col.slug)).size).toBe(4);
});

test("sin historial es aleatorio pero estable para la misma semilla", () => {
  const a = pickRecommendedCollections(CANDIDATES, {}, 0.11, 7).map((p) => p.col.slug);
  const b = pickRecommendedCollections(CANDIDATES, {}, 0.11, 7).map((p) => p.col.slug);
  const c = pickRecommendedCollections(CANDIDATES, {}, 0.87, 7).map((p) => p.col.slug);
  expect(a).toEqual(b);
  expect(a).not.toEqual(c);
});

test("con historial, la categoría preferida aparece entre las primeras para cualquier semilla", () => {
  const weights = { "Stop Motion": 10, Drama: 1 };
  for (const seed of [0.05, 0.3, 0.55, 0.8, 0.97]) {
    const picks = pickRecommendedCollections(CANDIDATES, weights, seed, 3).map((p) => p.col.name);
    expect(picks).toContain("Stop Motion");
  }
});

test("no falla con lista vacía ni con recuento 0", () => {
  expect(pickRecommendedCollections([], {}, 0.5, 6)).toEqual([]);
  expect(pickRecommendedCollections(CANDIDATES, {}, 0.5, 0)).toEqual([]);
});
