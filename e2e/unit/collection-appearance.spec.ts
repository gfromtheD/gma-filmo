import { expect, test } from "@playwright/test";
import { ACCENT_PALETTE, assignAccents, collectionAppearance } from "../../lib/collections/appearance";

const col = (id: number, slug: string, name = slug, cover: string | null = null) => ({ id, slug, name, description: null, r2_cover_url: cover });
const work = (numericId: number, categories: string[], imageUrl = `/img/${numericId}.jpg`) => ({ numericId, categories, imageUrl }) as never;

test("ninguna colección repite color mientras queden colores libres", () => {
  const cols = Array.from({ length: ACCENT_PALETTE.length }, (_, i) => col(i + 1, `coleccion-${i}`));
  const colors = [...assignAccents(cols).values()];
  expect(new Set(colors).size).toBe(ACCENT_PALETTE.length);
});

test("pasada la paleta, el reparto es parejo: ningún color se usa más de dos veces", () => {
  const cols = Array.from({ length: ACCENT_PALETTE.length + 5 }, (_, i) => col(i + 1, `c-${i}`));
  const count = new Map<string, number>();
  for (const color of assignAccents(cols).values()) count.set(color, (count.get(color) ?? 0) + 1);
  expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
});

test("una colección nueva no cambia los colores de las que ya existían", () => {
  const before = col(1, "animacion");
  const other = col(2, "terror");
  const first = assignAccents([before, other]);
  const second = assignAccents([before, other, col(3, "ciencia-ficcion")]);
  expect(second.get("animacion")).toBe(first.get("animacion"));
  expect(second.get("terror")).toBe(first.get("terror"));
  expect(second.get("ciencia-ficcion")).not.toBe(first.get("animacion"));
  expect(second.get("ciencia-ficcion")).not.toBe(first.get("terror"));
});

test("una colección sin portada usa la de una de sus obras, y la propia si la tiene", () => {
  const items = [work(1, ["Ciencia ficción"]), work(2, ["Terror"])];
  const result = collectionAppearance([col(1, "ciencia-ficcion", "Ciencia ficción"), col(2, "terror", "Terror", "/propia.jpg")], items);
  expect(result.get("ciencia-ficcion")?.coverUrl).toBe("/img/1.jpg");
  expect(result.get("terror")?.coverUrl).toBe("/propia.jpg");
});

test("sin ninguna obra con imagen no hay portada (se queda el color)", () => {
  expect(collectionAppearance([col(1, "vacia")], []).get("vacia")?.coverUrl).toBeNull();
});
