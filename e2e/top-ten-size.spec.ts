import { expect, test, type Page } from "@playwright/test";

/**
 * El Top 10 se mantiene más grande que el resto de filas en la misma proporción de siempre: antes las portadas
 * medían 316×178 y el Top 10 200×300 (tarjeta recogida) y 616×300 (la activa). Al agrandarse las portadas, el Top 10
 * crece exactamente lo mismo.
 */
const REFERENCE_IMAGE_WIDTH = 316;

async function measure(page: Page, width: number) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/inicio", { waitUntil: "load" });
  const topTen = page.locator("section[aria-label='Top 10 en GMA']");
  await topTen.scrollIntoViewIfNeeded();
  await expect(topTen.locator("article").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(700); // la animación de ancho dura 500 ms
  return page.evaluate(() => {
    const art = (section: Element) => section.querySelector("a > div") as HTMLElement | null; // la portada de una tarjeta normal
    const topTenEl = document.querySelector("section[aria-label='Top 10 en GMA']")!;
    const articles = [...topTenEl.querySelectorAll("article")] as HTMLElement[];
    const imageBox = (a: HTMLElement) => (a.querySelector("div.relative") as HTMLElement).getBoundingClientRect();
    const row = [...document.querySelectorAll("section.group\\/row")].find((s) => s.querySelector("h2")?.textContent === "Recién llegados")!;
    const rowArt = art(row)!.getBoundingClientRect();
    return {
      activeW: imageBox(articles[0]!).width,
      activeH: imageBox(articles[0]!).height,
      collapsedW: imageBox(articles[1]!).width,
      collapsedH: imageBox(articles[1]!).height,
      rowImageW: rowArt.width,
      rowImageH: rowArt.height,
    };
  });
}

for (const width of [1280, 1440, 1600, 1920, 2560]) {
  test(`a ${width}px el Top 10 ha crecido lo mismo que las portadas de las demás filas`, async ({ page }) => {
    const m = await measure(page, width);
    const scale = m.rowImageW / REFERENCE_IMAGE_WIDTH;
    expect(Math.abs(m.collapsedW - 200 * scale)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.collapsedH - 300 * scale)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.activeW - 616 * scale)).toBeLessThanOrEqual(3);
    expect(Math.abs(m.activeH - 300 * scale)).toBeLessThanOrEqual(2);
  });

  test(`a ${width}px la diferencia de altura con el resto de filas es la de siempre (300 frente a 178)`, async ({ page }) => {
    const m = await measure(page, width);
    expect(m.collapsedH / m.rowImageH).toBeGreaterThan(300 / 178 - 0.03);
    expect(m.collapsedH / m.rowImageH).toBeLessThan(300 / 178 + 0.03);
    expect(m.collapsedH).toBeGreaterThan(m.rowImageH); // sigue siendo el más grande
  });
}

test("por debajo de 1024 px el Top 10 mantiene su formato móvil (140×210)", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/inicio", { waitUntil: "load" });
  const first = page.locator("section[aria-label='Top 10 en GMA'] article").first();
  await first.scrollIntoViewIfNeeded();
  const box = (await first.locator("div.relative").first().boundingBox())!;
  expect(Math.round(box.width)).toBe(140);
  expect(Math.round(box.height)).toBe(210);
});

test("al pasar el cursor por otra tarjeta sigue expandiéndose y la anterior se recoge", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inicio", { waitUntil: "load" });
  const topTen = page.locator("section[aria-label='Top 10 en GMA']");
  await topTen.scrollIntoViewIfNeeded();
  const articles = topTen.locator("article");
  const width = async (i: number) => (await articles.nth(i).locator("div.relative").first().boundingBox())!.width;
  const collapsedBefore = await width(1);
  await articles.nth(1).hover();
  await expect.poll(() => width(1), { timeout: 3000 }).toBeGreaterThan(collapsedBefore * 2.5);
  await expect.poll(() => width(0), { timeout: 3000 }).toBeLessThan(collapsedBefore * 1.2);
});

test.describe("la marca verde «TOP N» de la esquina crece con la tarjeta", () => {
  const rankOf = (page: Page) => page.locator("section[aria-label='Top 10 en GMA'] article").first().locator("[data-top-rank]");

  for (const width of [1280, 1440, 1920, 2560]) {
    test(`a ${width}px mide 30×36 por el mismo factor que la tarjeta, y su texto también`, async ({ page }) => {
      const m = await measure(page, width);
      const scale = m.rowImageW / REFERENCE_IMAGE_WIDTH;
      const rank = rankOf(page);
      const box = (await rank.boundingBox())!;
      expect(Math.abs(box.width - 30 * scale)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(box.height - 36 * scale)).toBeLessThanOrEqual(1.5);
      const sizes = await rank.evaluate((el) => [...el.children].map((c) => parseFloat(getComputedStyle(c).fontSize)));
      expect(Math.abs(sizes[0]! - 8 * scale)).toBeLessThanOrEqual(0.3); // «TOP»
      expect(Math.abs(sizes[1]! - 13 * scale)).toBeLessThanOrEqual(0.3); // número
    });
  }

  test("conserva su proporción respecto a la tarjeta (≈15 % del ancho de una tarjeta recogida)", async ({ page }) => {
    const m = await measure(page, 1440);
    const box = (await rankOf(page).boundingBox())!;
    expect(box.width / m.collapsedW).toBeGreaterThan(0.14);
    expect(box.width / m.collapsedW).toBeLessThan(0.16);
  });

  test("por debajo de 1024 px (formato móvil) sigue midiendo 30×36", async ({ page }) => {
    await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto("/inicio", { waitUntil: "load" });
    const first = page.locator("section[aria-label='Top 10 en GMA'] article").first();
    await first.scrollIntoViewIfNeeded();
    const box = (await first.locator("[data-top-rank]").boundingBox())!;
    expect(Math.round(box.width)).toBe(30);
    expect(Math.round(box.height)).toBe(36);
  });
});
