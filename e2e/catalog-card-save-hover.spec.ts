import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Tras pulsar el botón de guardar con el ratón, la capa de descripción debe desvanecerse en cuanto el cursor sale
 * de la portada (antes se quedaba congelada porque el botón conservaba el foco). Con el teclado sigue apareciendo.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const ME = "22222222-2222-4222-8222-222222222222";

function projectRef(): string | null {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const raw = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
    const url = raw.replace(/^["']|["']$/g, "");
    return url ? (new URL(url).hostname.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}
const REF = projectRef();
test.skip(!REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

async function openCatalogAsUser(page: Page) {
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: ME, aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  await page.context().addCookies([
    { name: `sb-${REF}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url },
    { name: "gma_guest", value: "1", url },
  ]);
  await page.route("**/api/watchlist", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/watchlist?**", (route) => route.fulfill({ json: { ids: [] } }));
  const sessionReady = page.waitForRequest((r) => r.url().includes("/api/watchlist") && r.method() === "GET");
  await page.goto("/cortos", { waitUntil: "load" });
  await sessionReady;
}

const firstCard = (page: Page) => page.locator("div.grid:has(> [class*='group/card']:nth-child(10)) > [class*='group/card']").first();
const opacityOf = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => Number(getComputedStyle(el).opacity));

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "no-preference" }); });

test("tras guardar con el ratón, la capa se desvanece al sacar el cursor de la portada", async ({ page }) => {
  await openCatalogAsUser(page);
  const card = firstCard(page);
  await card.scrollIntoViewIfNeeded();
  const overlay = card.locator("[data-card-overlay]");
  await card.hover();
  await expect.poll(() => opacityOf(overlay), { timeout: 2000 }).toBe(1);

  await card.getByRole("button", { name: /Mi Lista/ }).click(); // guardar (el botón se queda con el foco)
  await expect(card.getByRole("button", { name: "Quitar de Mi Lista" })).toBeVisible();

  await page.mouse.move(2, 2); // el cursor sale de la portada
  await expect.poll(() => opacityOf(overlay), { timeout: 2000 }).toBe(0);
});

test("lo mismo al quitar el guardado: la capa no se queda congelada", async ({ page }) => {
  await openCatalogAsUser(page);
  const card = firstCard(page);
  await card.scrollIntoViewIfNeeded();
  const overlay = card.locator("[data-card-overlay]");
  await card.hover();
  await card.getByRole("button", { name: "Añadir a Mi Lista" }).click();
  await card.getByRole("button", { name: "Quitar de Mi Lista" }).click(); // y se quita
  await expect(card.getByRole("button", { name: "Añadir a Mi Lista" })).toBeVisible();
  await page.mouse.move(2, 2);
  await expect.poll(() => opacityOf(overlay), { timeout: 2000 }).toBe(0);
});

test("el título que estaba desenfocado vuelve a verse nítido al salir", async ({ page }) => {
  await openCatalogAsUser(page);
  const card = firstCard(page);
  await card.scrollIntoViewIfNeeded();
  const title = card.locator("[data-poster-title]");
  await card.hover();
  await card.getByRole("button", { name: /Mi Lista/ }).click();
  await page.mouse.move(2, 2);
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).filter), { timeout: 2000 }).toBe("none");
});

test("con el teclado la capa sigue apareciendo al enfocar la tarjeta y se va al desenfocar", async ({ page }) => {
  await openCatalogAsUser(page);
  const card = firstCard(page);
  await card.scrollIntoViewIfNeeded();
  const overlay = card.locator("[data-card-overlay]");
  await card.locator("a").first().focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab"); // vuelve a la tarjeta por teclado (foco visible)
  await expect.poll(() => opacityOf(overlay), { timeout: 2000 }).toBe(1);
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await expect.poll(() => opacityOf(overlay), { timeout: 2000 }).toBe(0);
});

test("el botón de guardar sigue visible mientras el cursor está encima y desaparece al salir", async ({ page }) => {
  await openCatalogAsUser(page);
  const card = firstCard(page);
  await card.scrollIntoViewIfNeeded();
  const save = card.getByRole("button", { name: /Mi Lista/ });
  await card.hover();
  await expect.poll(() => opacityOf(save), { timeout: 2000 }).toBe(1);
  await save.click();
  await page.mouse.move(2, 2);
  await expect.poll(() => opacityOf(save), { timeout: 2000 }).toBe(0);
});

test("en las tarjetas de «Películas» (/peliculas) el «+» tampoco se queda visible tras pulsarlo y salir", async ({ page }) => {
  await openCatalogAsUser(page);
  await page.goto("/peliculas", { waitUntil: "load" });
  const card = page.locator("[class*='group/card']").first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await card.getByRole("button", { name: "Añadir a Mi Lista" }).click(); // guarda
  await card.getByRole("button", { name: "Quitar de Mi Lista" }).click(); // y lo quita: vuelve el «+»
  const plus = card.getByRole("button", { name: "Añadir a Mi Lista" });
  await expect(plus).toBeAttached();
  await page.mouse.move(2, 2);
  await expect.poll(() => opacityOf(plus), { timeout: 2000 }).toBe(0);
});
