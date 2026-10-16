import { expect, test, type Page } from "@playwright/test";

/** «También te puede gustar»: cuadrícula (no carrusel) con hasta 3 filas de 4 que se recoloca según el ancho. */

async function openSimilares(page: Page, width: number) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/cortos/yasha-gozen#similares", { waitUntil: "load" });
  const heading = page.getByRole("heading", { name: "También te puede gustar" });
  await expect(heading).toBeVisible({ timeout: 20_000 });
  return heading.locator("xpath=following-sibling::div[1]");
}

async function columnsOf(grid: ReturnType<Page["locator"]>): Promise<number> {
  return grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
}

test("en escritorio son 4 columnas y hasta 3 filas (12 títulos)", async ({ page }) => {
  const grid = await openSimilares(page, 1440);
  expect(await columnsOf(grid)).toBe(4);
  // Se piden 15, pero con 4 columnas solo se ven 12 (3 filas completas).
  const visible = await grid.locator("> *:visible").count();
  expect(visible).toBeGreaterThan(4);
  expect(visible).toBeLessThanOrEqual(12);
  expect(visible % 4).toBe(0);
});

test("se recoloca: 3 columnas en tableta y 2 en móvil, y 5 en pantalla grande con filas completas", async ({ page }) => {
  expect(await columnsOf(await openSimilares(page, 800))).toBe(3);
  expect(await columnsOf(await openSimilares(page, 390))).toBe(2);
  const wide = await openSimilares(page, 1920);
  expect(await columnsOf(wide)).toBe(5);
  expect((await wide.locator("> *:visible").count()) % 5).toBe(0);
});
