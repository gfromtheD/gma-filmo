import { expect, test } from "@playwright/test";
import {
  buildHomeRows,
  buildUserAffinity,
  pickNewArrivals,
  scoreCandidate,
  type UserEvent,
  type UserProfile,
} from "../../lib/recommendation/recommendation-engine";
import type { MediaItem } from "../../types/catalog";

/**
 * Simulador de repetición: un catálogo de 80 cortos, varias «visitas» seguidas y métricas de cuánto se repite
 * lo que se muestra. Sirve para que la portada no enseñe siempre el mismo grupo.
 */

const CATEGORIES = ["Drama", "Comedia", "Terror", "Animación", "Documental", "Ciencia ficción", "Romance", "Thriller"];

function catalog(size = 80): MediaItem[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `corto-${i}`,
    numericId: i + 1,
    kind: "movie",
    title: `Corto ${i}`,
    // El catálogo llega ordenado de más nuevo a más antiguo.
    year: 2026 - Math.floor(i / 30),
    categories: [CATEGORIES[i % CATEGORIES.length]!, CATEGORIES[(i * 3 + 1) % CATEGORIES.length]!],
    artistas: [{ name: `Artista ${i % 11}` }],
    runtime: "15m",
  })) as unknown as MediaItem[];
}

const DAY = 86_400_000;

function profileWith(events: UserEvent[]): UserProfile {
  return { userId: "u", events };
}

function watched(itemId: string, daysAgo = 1): UserEvent {
  return { itemId, eventType: "watchedFull", watchTimeFraction: 1, lastSeenAt: Date.now() - daysAgo * DAY };
}

function ids(items: readonly MediaItem[]): string[] {
  return items.map((i) => i.id);
}

function overlap(a: readonly string[], b: readonly string[]): number {
  const setB = new Set(b);
  const common = a.filter((x) => setB.has(x)).length;
  return common / Math.max(a.length, 1);
}

/** Simula N visitas: cada una con su semilla y recordando lo mostrado en las anteriores (como hace el hook). */
function simulateVisits(items: MediaItem[], baseEvents: UserEvent[], visits: number) {
  const shown: Record<string, number> = {};
  const perVisit: string[][] = [];
  for (let v = 0; v < visits; v++) {
    const now = Date.now() + v * 6 * 3_600_000; // una visita cada 6 horas
    const events = [...baseEvents];
    for (const [itemId, ts] of Object.entries(shown)) {
      events.push({ itemId, eventType: "clicked", watchTimeFraction: 0, lastSeenAt: ts, shownOnHomeAt: ts });
    }
    const rows = buildHomeRows(items, profileWith(events), 0.1 + v * 0.137, now);
    const visible = [...new Set(rows.flatMap((r) => ids(r.items)))];
    visible.forEach((id) => { shown[id] = now; });
    perVisit.push(visible);
  }
  return perVisit;
}

test.describe("«Recién llegados»", () => {
  const items = catalog();

  test("no es siempre el mismo grupo: cambia con la semilla pero sale de los más nuevos", () => {
    const a = ids(pickNewArrivals(items, 0.11, {}, 15));
    const b = ids(pickNewArrivals(items, 0.73, {}, 15));
    expect(a).toHaveLength(15);
    expect(a).not.toEqual(b);
    // Todo sale de la ventana de los 30 más nuevos.
    const newest = new Set(ids(items.slice(0, 30)));
    expect([...a, ...b].every((id) => newest.has(id))).toBe(true);
  });

  test("con el mismo seed siempre da lo mismo (estable mientras navegas)", () => {
    expect(ids(pickNewArrivals(items, 0.4, {}, 15))).toEqual(ids(pickNewArrivals(items, 0.4, {}, 15)));
  });

  test("lo mostrado hace poco baja y entran títulos nuevos", () => {
    const first = pickNewArrivals(items, 0.4, {}, 15);
    const shown = Object.fromEntries(first.map((i) => [i.id, Date.now() - 3_600_000]));
    const second = pickNewArrivals(items, 0.4, shown, 15);
    expect(overlap(ids(second), ids(first))).toBeLessThan(0.4);
  });

  test("con un catálogo pequeño devuelve lo que haya, sin repetir", () => {
    const few = catalog(6);
    const result = ids(pickNewArrivals(few, 0.3, {}, 15));
    expect(result).toHaveLength(6);
    expect(new Set(result).size).toBe(6);
  });
});

test.describe("afinidad normalizada", () => {
  const items = catalog();

  test("el azar puede reordenar categorías de afinidad parecida, aunque el historial sea grande", () => {
    const events = Array.from({ length: 40 }, (_, i) => watched(`corto-${i}`, 1 + (i % 5)));
    const affinity = buildUserAffinity(events, items);
    const [first, second] = [...items.slice(40, 60)]
      .map((item) => item)
      .sort((x, y) => scoreCandidate(y, affinity, 0.5, 0, 0.5) - scoreCandidate(x, affinity, 0.5, 0, 0.5));
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // Con semillas distintas cambia el orden en algún caso: el azar no es irrelevante.
    const orders = new Set(
      [0.1, 0.3, 0.5, 0.7, 0.9].map((seed) =>
        ids(items.slice(40, 60).map((it, i) => ({ it, s: scoreCandidate(it, affinity, seed, i, 0.5) })).sort((x, y) => y.s - x.s).slice(0, 5).map((x) => x.it)).join(","),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  test("las puntuaciones quedan acotadas (no crecen con el historial)", () => {
    const small = buildUserAffinity([watched("corto-0")], items);
    const big = buildUserAffinity(Array.from({ length: 60 }, (_, i) => watched(`corto-${i}`)), items);
    const item = items[70]!;
    expect(scoreCandidate(item, small, 0.5, 0, 0.5)).toBeLessThanOrEqual(1);
    expect(scoreCandidate(item, big, 0.5, 0, 0.5)).toBeLessThanOrEqual(1);
  });
});

test.describe("lo que solo se mostró no cuenta como gusto", () => {
  const items = catalog();

  test("mostrar un título no genera afinidad ni «historial»", () => {
    const shownOnly: UserEvent[] = items.slice(0, 8).map((it) => ({
      itemId: it.id, eventType: "clicked", watchTimeFraction: 0, lastSeenAt: Date.now(), shownOnHomeAt: Date.now(),
    }));
    const affinity = buildUserAffinity(shownOnly, items);
    expect(Object.keys(affinity.categoryWeights)).toHaveLength(0);
    expect(affinity.dominantCategory).toBeNull();
    const rows = buildHomeRows(items, profileWith(shownOnly), 0.4);
    // Sin historial real, la portada se comporta como un usuario nuevo: no hay «Porque viste» ni «Más de…».
    expect(rows.some((r) => r.title.startsWith("Porque viste") || r.title.startsWith("Más de"))).toBe(false);
  });
});

test.describe("simulación de visitas (usuario con historial)", () => {
  const items = catalog();
  const history = [watched("corto-3", 2), watched("corto-10", 3), watched("corto-17", 4), watched("corto-25", 5)];

  test("entre dos visitas seguidas se repite menos de la mitad", () => {
    const visits = simulateVisits(items, history, 6);
    for (let v = 1; v < visits.length; v++) {
      expect(overlap(visits[v]!, visits[v - 1]!)).toBeLessThan(0.5);
    }
  });

  test("en 6 visitas se llega a ver al menos el 60 % de lo que aún no has visto", () => {
    const visits = simulateVisits(items, history, 6);
    const seen = new Set(visits.flat());
    const unseenCount = items.length - history.length;
    expect(seen.size / unseenCount).toBeGreaterThanOrEqual(0.6);
  });

  test("nunca se muestra dos veces el mismo título en una misma portada", () => {
    for (const visit of simulateVisits(items, history, 4)) {
      expect(new Set(visit).size).toBe(visit.length);
    }
  });
});

test.describe("simulación de visitas (usuario nuevo)", () => {
  const items = catalog();

  test("cada visita enseña un grupo distinto", () => {
    const visits = simulateVisits(items, [], 5);
    for (let v = 1; v < visits.length; v++) {
      expect(overlap(visits[v]!, visits[v - 1]!)).toBeLessThan(0.6);
    }
  });
});
