import { expect, test } from "@playwright/test";

/**
 * Con Satoshi (de ojo más pequeño que la anterior) los textos de Inicio se leían pequeños: títulos y datos bajo las
 * portadas, y descripción del Top 10, suben de tamaño.
 */
test.use({ viewport: { width: 1440, height: 900 } });

async function openHome(page: import("@playwright/test").Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
}

const size = (el: import("@playwright/test").Locator) => el.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));

test("título y datos bajo las portadas de las filas", async ({ page }) => {
  await openHome(page);
  const row = page.locator("section[class*='group/row']").filter({ has: page.locator("[class*='group/card']") }).first();
  await row.scrollIntoViewIfNeeded();
  const card = row.locator("[class*='group/card']").first();
  expect(await size(card.locator("h3"))).toBeGreaterThanOrEqual(15);
  expect(await size(card.locator("h3 + p"))).toBeGreaterThanOrEqual(13);
});

test("Top 10: título y datos de las tarjetas recogidas, y descripción de la activa", async ({ page }) => {
  await openHome(page);
  const top = page.locator("section[aria-label='Top 10 en GMA']");
  await top.scrollIntoViewIfNeeded();
  const articles = top.locator("article");
  await expect(articles.first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(700);
  const active = articles.first();
  expect(await size(active.locator("p.line-clamp-4"))).toBeGreaterThanOrEqual(15); // sinopsis
  const director = active.locator("h3 + p");
  if (await director.count()) expect(await size(director)).toBeGreaterThanOrEqual(14);
  expect(await size(active.getByRole("link", { name: /ver/i }).first())).toBeGreaterThanOrEqual(14);
  const collapsed = articles.nth(1);
  expect(await size(collapsed.locator("span.line-clamp-1.block"))).toBeGreaterThanOrEqual(15);
});

for (const width of [1024, 1280, 1440, 1920]) {
  test(`a ${width}px el texto agrandado del Top 10 cabe dentro de la tarjeta activa`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openHome(page);
    const top = page.locator("section[aria-label='Top 10 en GMA']");
    await top.scrollIntoViewIfNeeded();
    const active = top.locator("article").first();
    await expect(active).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(900);
    const box = (await active.boundingBox())!;
    const title = (await active.locator("h3").first().boundingBox())!;
    const button = (await active.getByRole("link", { name: /ver ahora/i }).boundingBox())!;
    expect(title.y).toBeGreaterThanOrEqual(box.y);
    expect(button.y + button.height).toBeLessThanOrEqual(box.y + box.height + 1);
  });
}
