import { expect, test, type Page } from "@playwright/test";

/**
 * En la ficha, las pestañas de cuadrícula (Similares y Extras) ocupan todo el ancho como el catálogo, con los mismos
 * márgenes (16/32/64 px) y columnas, en vez de quedarse en una caja centrada de 1240 px en pantallas grandes.
 */
const PAGE_PADDING = (width: number) => (width >= 1024 ? 64 : width >= 640 ? 32 : 16);

async function openSimilares(page: Page, width: number) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/inicio", { waitUntil: "load" });
  const hrefs = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    [...new Set(links.map((a) => a.getAttribute("href")).filter((h): h is string => !!h && h.split("/").length === 3))].slice(0, 6),
  );
  for (const href of hrefs) {
    await page.goto(`${href}#similares`, { waitUntil: "load" });
    const tab = page.getByRole("tab", { name: "Similares" });
    if (await tab.count()) {
      await tab.click();
      const grid = page.locator("[data-related-grid]");
      await expect(grid).toBeVisible({ timeout: 10_000 });
      return grid;
    }
  }
  throw new Error("Ninguna ficha de prueba tiene pestaña Similares");
}

for (const width of [1280, 1440, 1920, 2560]) {
  test(`a ${width}px la cuadrícula de similares llega de margen a margen`, async ({ page }) => {
    const grid = await openSimilares(page, width);
    const box = (await grid.boundingBox())!;
    const pad = PAGE_PADDING(width);
    expect(Math.abs(box.x - pad)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.x + box.width - (width - pad))).toBeLessThanOrEqual(1);
  });
}

test("las columnas bajan al estrechar la ventana (2 · 3 · 4 · 5 · 6)", async ({ page }) => {
  const columnsAt: Record<number, number> = { 600: 2, 800: 3, 1100: 4, 1280: 4, 1920: 5, 2560: 6 };
  for (const [w, cols] of Object.entries(columnsAt)) {
    const grid = await openSimilares(page, Number(w));
    const count = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(count, `a ${w}px`).toBe(cols);
  }
});

test("las demás pestañas (texto) conservan su ancho de lectura", async ({ page }) => {
  await openSimilares(page, 1920);
  await page.getByRole("tab", { name: "Detalles" }).click();
  const panel = page.getByRole("tabpanel");
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(1240);
});
