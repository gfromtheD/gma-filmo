import { expect, test, type Page } from "@playwright/test";

/**
 * Cuadrícula de portadas del catálogo (horizontales 16:9) con los mismos cambios de columnas que el catálogo de
 * Filmin (medido: 1 columna hasta ~700 px, 2 hasta ~1000, 3 hasta ~1150, 4 hasta ~1500 y 5 a partir de ahí).
 */

const CASES: readonly { width: number; columns: number }[] = [
  { width: 390, columns: 1 },
  { width: 600, columns: 1 },
  { width: 719, columns: 1 },
  { width: 720, columns: 2 },
  { width: 900, columns: 2 },
  { width: 999, columns: 2 },
  { width: 1000, columns: 3 },
  { width: 1024, columns: 3 },
  { width: 1100, columns: 3 },
  { width: 1149, columns: 3 },
  { width: 1150, columns: 4 },
  { width: 1280, columns: 4 },
  { width: 1440, columns: 4 },
  { width: 1499, columns: 4 },
  { width: 1500, columns: 5 },
  { width: 1600, columns: 5 },
  { width: 1920, columns: 5 },
  { width: 2299, columns: 5 },
  { width: 2300, columns: 6 },
  { width: 2560, columns: 6 },
];

async function measure(page: Page, width: number) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/cortos", { waitUntil: "load" });
  const grid = page.locator("div.grid:has(> [class*='group/card']:nth-child(10))").first(); // la cuadrícula de cortos (la de las colecciones no lleva tarjetas de título)
  await expect(grid).toBeVisible({ timeout: 20_000 });
  return grid.evaluate((el) => {
    const cards = [...el.children] as HTMLElement[];
    const rects = cards.slice(0, 40).map((c) => c.getBoundingClientRect());
    const first = rects[0]!;
    const columns = new Set(rects.map((r) => Math.round(r.left))).size;
    const art = cards[0]!.querySelector("div.aspect-video, img, [class*='aspect']")?.getBoundingClientRect() ?? first;
    const gaps = rects.slice(1).filter((r) => Math.abs(r.top - first.top) < 2).map((r, i) => Math.round(r.left - rects[i]!.right));
    return {
      columns,
      cardWidth: Math.round(first.width),
      ratio: Number((art.width / art.height).toFixed(2)),
      columnGap: gaps[0] ?? null,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      cardCount: cards.length,
    };
  });
}

for (const { width, columns } of CASES) {
  test(`a ${width}px la cuadrícula tiene ${columns} columna${columns > 1 ? "s" : ""} y portadas con buen tamaño`, async ({ page }) => {
    const m = await measure(page, width);
    expect(m.columns).toBe(columns);
    expect(m.overflow).toBe(false);
    // Nunca pequeñas ni gigantes: banda de movy.sx (282–357) con margen para el cambio de columnas y el móvil.
    expect(m.cardWidth).toBeGreaterThanOrEqual(width < 720 ? 280 : 240);
    expect(m.cardWidth).toBeLessThanOrEqual(width < 720 ? 700 : 470);
    // Se mantienen horizontales (16:9), nunca cuadradas ni verticales.
    expect(m.ratio).toBeGreaterThan(1.7);
    expect(m.ratio).toBeLessThan(1.85);
    if (columns > 1) expect(m.columnGap).toBe(16); // espaciado constante
  });
}

test("de 1200 a 2200 px las portadas no bajan de 255 px ni pasan de 440 px (Filmin: 252–415)", async ({ page }) => {
  for (const width of [1200, 1280, 1366, 1440, 1536, 1600, 1920, 2200]) {
    const m = await measure(page, width);
    expect(m.cardWidth, `a ${width}px`).toBeGreaterThanOrEqual(255);
    expect(m.cardWidth, `a ${width}px`).toBeLessThanOrEqual(440);
  }
});

test("la sección «Películas» usa la misma cuadrícula (cuando haya más de una)", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/cortos", { waitUntil: "load" });
  const sections = page.locator("section").filter({ has: page.getByRole("heading", { name: "Películas" }) });
  await expect(sections.first()).toBeVisible({ timeout: 20_000 });
  const cols = await sections.first().locator("div.grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(cols).toBe(4);
});
