import { expect, test, type Page } from "@playwright/test";

/**
 * Tarjetas del catálogo (como Filmin): al pasar el cursor, la capa oscura con la descripción aparece con un
 * fundido (entra en 350 ms, sale en 250 ms) y el título que queda debajo se desenfoca. Si el título ya tiene
 * valoraciones, muestra su nota media (de 0 a 10) en una insignia abajo a la derecha.
 */
test.use({ viewport: { width: 1440, height: 900 } });

async function openCatalog(page: Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/cortos", { waitUntil: "load" });
  await expect(page.getByRole("group", { name: "Filtros del catálogo" })).toBeVisible({ timeout: 20_000 });
}

const firstCard = (page: Page) => page.locator("div.grid:has(> [class*='group/card']:nth-child(10)) > [class*='group/card']").first();
const overlayOf = (card: ReturnType<typeof firstCard>) => card.locator("[data-card-overlay]");
const titleOf = (card: ReturnType<typeof firstCard>) => card.locator("[data-poster-title]");
const css = (locator: ReturnType<typeof overlayOf>, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

test.describe("con movimiento normal", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "no-preference" }); });

  test("la capa de descripción aparece con un fundido al pasar el cursor", async ({ page }) => {
    await openCatalog(page);
    const card = firstCard(page);
    await card.scrollIntoViewIfNeeded();
    const overlay = overlayOf(card);
    expect(Number(await css(overlay, "opacity"))).toBe(0);
    expect(await css(overlay, "transition-duration")).toBe("0.25s"); // salida: 250 ms
    await card.hover();
    await expect.poll(async () => Number(await css(overlay, "opacity")), { timeout: 2000 }).toBe(1);
    expect(await css(overlay, "transition-duration")).toBe("0.35s"); // entrada: 350 ms
    expect(await css(overlay, "transition-property")).toContain("opacity");
  });

  test("la capa es negra al 80 % y la portada se intuye detrás", async ({ page }) => {
    await openCatalog(page);
    const card = firstCard(page);
    await card.scrollIntoViewIfNeeded();
    const background = await css(overlayOf(card), "background-color"); // el navegador lo devuelve como rgba() u oklab()
    expect(background.endsWith("0.8)")).toBe(true); // alfa 0,8 (negro al 80 %)
    expect(background.startsWith("rgba(0, 0, 0") || background.startsWith("oklab(0 0 0")).toBe(true);
  });

  test("el título que queda debajo se desenfoca al pasar el cursor y se enfoca al salir", async ({ page }) => {
    await openCatalog(page);
    const card = firstCard(page);
    await card.scrollIntoViewIfNeeded();
    const title = titleOf(card);
    expect(await css(title, "filter")).toBe("none");
    expect(await css(title, "transition-property")).toContain("filter");
    await card.hover();
    await expect.poll(() => css(title, "filter"), { timeout: 2000 }).toBe("blur(3px)");
    await page.mouse.move(2, 2);
    await expect.poll(() => css(title, "filter"), { timeout: 2000 }).toBe("none");
  });

  test("el texto de la capa muestra año, duración y la descripción", async ({ page }) => {
    await openCatalog(page);
    const card = firstCard(page);
    const text = (await overlayOf(card).innerText()).trim();
    expect(text).toMatch(/20\d\d|19\d\d/);
    expect(text.length).toBeGreaterThan(20);
  });
});

test.describe("con movimiento reducido", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

  test("la capa aparece al instante (sin fundido) y el título se desenfoca sin transición", async ({ page }) => {
    await openCatalog(page);
    const card = firstCard(page);
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expect.poll(async () => Number(await css(overlayOf(card), "opacity")), { timeout: 1000 }).toBe(1);
    expect(await css(overlayOf(card), "transition-property")).toBe("none"); // sin transición: el cambio es inmediato
    expect(await css(titleOf(card), "transition-property")).toBe("none");
    await expect.poll(() => css(titleOf(card), "filter")).toBe("blur(3px)"); // pero el desenfoque sí se aplica
  });
});

test.describe("nota media de la gente", () => {
  const overlayScores = (page: Page) => page.locator("[data-overlay-score]");

  test("fuera de la capa no hay ninguna insignia con la nota: solo aparece al pasar el cursor", async ({ page }) => {
    await openCatalog(page);
    await expect(page.locator("[data-community-score]")).toHaveCount(0);
    await expect(page.locator("[data-overlay-score]").first()).toBeAttached(); // la nota vive dentro de la capa
  });

  test("la nota de la capa tiene estrella, número (0–10 con un decimal) y nº de valoraciones", async ({ page }) => {
    await openCatalog(page);
    const count = await overlayScores(page).count();
    test.skip(count === 0, "Ningún título tiene valoraciones todavía");
    for (let i = 0; i < count; i++) {
      const text = ((await overlayScores(page).nth(i).textContent()) ?? "").replace(/\s+/g, " ").trim();
      expect(text).toMatch(/^★ (10\.0|\d\.\d) · \d+ valoraci(ón|ones)$/);
    }
  });

  test("solo los títulos con valoraciones llevan nota", async ({ page }) => {
    await openCatalog(page);
    const cards = page.locator("div.grid:has(> [class*='group/card']:nth-child(10)) > [class*='group/card']");
    const total = await cards.count();
    const rated = await overlayScores(page).count();
    expect(rated).toBeLessThan(total);
  });

  test("al pasar el cursor la nota se ve en la capa, abajo a la izquierda", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openCatalog(page);
    const score = overlayScores(page).first();
    test.skip((await score.count()) === 0, "Ningún título tiene valoraciones todavía");
    const card = page.locator("[class*='group/card']").filter({ has: score }).first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expect.poll(async () => Number(await card.locator("[data-card-overlay]").evaluate((el) => getComputedStyle(el).opacity)), { timeout: 2000 }).toBe(1);
    const s = (await score.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(s.x).toBeLessThan(c.x + c.width / 2); // a la izquierda: a la derecha va el botón de guardar
    expect(s.y + s.height).toBeGreaterThan(c.y + c.height - 28); // abajo
  });

  test("la nota de la capa es la misma que la de la ficha (media de las valoraciones)", async ({ page }) => {
    await openCatalog(page);
    const score = overlayScores(page).first();
    test.skip((await score.count()) === 0, "Ningún título tiene valoraciones todavía");
    const card = page.locator("[class*='group/card']").filter({ has: score }).first();
    const href = await card.locator("a[href^='/cortos/']").first().getAttribute("href");
    const text = ((await score.textContent()) ?? "").replace(/\s+/g, " ");
    const catalogScore = Number(text.match(/(\d+\.\d)/)![1]);
    const votes = Number(text.match(/· (\d+)/)![1]);

    await page.goto(`${href}#valoraciones`, { waitUntil: "load" });
    const votesLabel = page.getByText(`${votes} votos`, { exact: true }).first();
    await expect(votesLabel).toBeVisible({ timeout: 20_000 });
    const headerScore = (await votesLabel.locator("xpath=preceding-sibling::span[1]").innerText()).trim().replace(",", ".");
    expect(Number(headerScore)).toBeCloseTo(catalogScore, 1);
  });
});
