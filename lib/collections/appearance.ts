import type { Coleccion } from "@/lib/supabase/queries";
import type { MediaItem } from "@/types/catalog";

/** Colores de acento (oscuros y saturados) para el velo de cada colección. Cuantos más, más tardan en repetirse. */
export const ACCENT_PALETTE = [
  "#1c4d5e", // petróleo
  "#8a2323", // rojo
  "#0f6b5c", // verde azulado
  "#4a2b78", // violeta
  "#8a3b12", // naranja
  "#1f4f8f", // azul
  "#7a1f5c", // magenta
  "#3d5a1f", // verde oliva
  "#8a6a12", // mostaza
  "#35309a", // índigo
  "#a03a55", // rosa
  "#3f4a5a", // pizarra
  "#5e3a22", // marrón
  "#0e7a8a", // cian
  "#14733a", // esmeralda
  "#6b2f2f", // granate
] as const;

export interface CollectionAppearance {
  /** Color del velo de la tarjeta. */
  readonly accent: string;
  /** Portada: la de la colección o, si no la tiene, la de una de sus obras; `null` si no hay ninguna imagen. */
  readonly coverUrl: string | null;
}

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Matiz (0–360) de un `#rrggbb`: sirve para que dos colores seguidos no sean parecidos aunque sean distintos. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}
const HUES = ACCENT_PALETTE.map(hueOf);
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * Un color por colección, sin repetirse mientras haya colores libres (y repitiendo lo mínimo después) y evitando también
 * los parecidos: entre los colores menos usados elige el de matiz más lejano a los ya repartidos (dos verdes o dos azules
 * seguidos no pasan). Se reparte en orden de creación (`id`), así una colección nueva coge un color libre sin cambiar los de
 * las que ya existían; en un empate gana el color «natural» que le da su slug.
 */
export function assignAccents(colecciones: readonly Pick<Coleccion, "id" | "slug">[]): ReadonlyMap<string, string> {
  const uses = new Array<number>(ACCENT_PALETTE.length).fill(0);
  const accents = new Map<string, string>();
  for (const { slug } of [...colecciones].sort((a, b) => a.id - b.id)) {
    const fewest = Math.min(...uses);
    const natural = hashOf(slug) % ACCENT_PALETTE.length;
    let best = -1;
    let bestGap = -1;
    for (let step = 0; step < ACCENT_PALETTE.length; step++) {
      const index = (natural + step) % ACCENT_PALETTE.length;
      if (uses[index] !== fewest) continue;
      // Distancia al color ya repartido más parecido (si no hay ninguno, cualquiera vale).
      let nearest = 360;
      uses.forEach((count, other) => { if (count > 0) nearest = Math.min(nearest, hueGap(HUES[index]!, HUES[other]!)); });
      if (nearest > bestGap) { best = index; bestGap = nearest; }
    }
    uses[best] = uses[best]! + 1;
    accents.set(slug, ACCENT_PALETTE[best]!);
  }
  return accents;
}

/** Obras de una colección (las que llevan su nombre como categoría) que tienen imagen. */
function worksWithImage(col: Pick<Coleccion, "slug" | "name">, items: readonly MediaItem[]): MediaItem[] {
  // «Estrenos» no es una categoría: son las últimas obras añadidas.
  if (col.slug === "estrenos") return items.filter((x) => x.imageUrl).sort((a, b) => b.numericId - a.numericId);
  return items.filter((x) => x.imageUrl && x.categories.includes(col.name)).sort((a, b) => a.numericId - b.numericId);
}

/**
 * Cómo se ve cada colección: su color único y su portada. Una colección sin portada propia (p. ej. una categoría nueva como
 * «Ciencia ficción») usa la de una de sus obras, siempre la misma para esa colección, y no se queda en un color plano.
 */
export function collectionAppearance(
  colecciones: readonly Coleccion[],
  items: readonly MediaItem[],
): ReadonlyMap<string, CollectionAppearance> {
  const accents = assignAccents(colecciones);
  const result = new Map<string, CollectionAppearance>();
  const usedCovers = new Set<string>();
  for (const col of [...colecciones].sort((a, b) => a.id - b.id)) {
    let coverUrl = col.r2_cover_url;
    if (!coverUrl) {
      const works = worksWithImage(col, items);
      // Una obra que no sea ya la portada de otra colección, para que no se repitan; si todas están cogidas, una fija.
      const pick = works.find((w) => w.imageUrl && !usedCovers.has(w.imageUrl)) ?? works[hashOf(col.slug) % Math.max(1, works.length)];
      coverUrl = pick?.imageUrl ?? null;
    }
    if (coverUrl) usedCovers.add(coverUrl);
    result.set(col.slug, { accent: accents.get(col.slug) ?? ACCENT_PALETTE[0], coverUrl });
  }
  return result;
}
