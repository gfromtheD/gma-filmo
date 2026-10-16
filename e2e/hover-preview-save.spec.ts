import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Guardar desde la tarjeta flotante de Inicio (sesión simulada, API interceptada): al pulsar el icono, la tarjeta
 * se queda abierta y marcada como guardada, tanto en «Recién llegados» como en las filas recomendadas (que antes se
 * recalculaban al guardar y hacían desaparecer la tarjeta).
 */
test.use({ viewport: { width: 1440, height: 900 } });

function projectRef(): string {
  const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const raw = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
  return new URL(raw.replace(/^["']|["']$/g, "")).hostname.split(".")[0]!;
}

async function asFakeUser(page: Page) {
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  await page.context().addCookies([
    { name: `sb-${projectRef()}-auth-token`, value, url },
    { name: "gma_guest", value: "1", url },
  ]);
}

async function mockWatchlist(page: Page) {
  const saved = new Set<number>();
  await page.route("**/api/watchlist**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: { ids: [...saved] } });
    const { peliculaId } = JSON.parse(req.postData() ?? "{}") as { peliculaId: number };
    await new Promise((r) => setTimeout(r, 200));
    if (req.method() === "POST") saved.add(peliculaId);
    else saved.delete(peliculaId);
    return route.fulfill({ json: { ok: true } });
  });
}

const ROWS = [0, 1];

for (const rowIndex of ROWS) {
  test(`fila ${rowIndex + 1} de Inicio: al guardar, la tarjeta flotante sigue abierta y marcada`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await asFakeUser(page);
    await mockWatchlist(page);
    await page.goto("/inicio", { waitUntil: "load" });

    // Solo filas con tarjetas normales (el Top 10 tiene otro formato).
    const row = page.locator("section[class*='group/row']").filter({ has: page.locator("[class*='group/card']") }).nth(rowIndex);
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800); // las filas recomendadas llegan tras cargar los datos del usuario
    await row.locator("[class*='group/card']").nth(1).hover();
    const preview = page.locator("[data-hover-preview]");
    await expect(preview).toBeVisible({ timeout: 4000 });
    await page.waitForTimeout(400);

    const save = preview.getByRole("button", { name: /mi lista/i });
    await save.click();
    for (const wait of [150, 300, 600]) {
      await page.waitForTimeout(wait);
      await expect(preview).toHaveCount(1);
    }
    await expect(preview.getByRole("button", { name: /quitar de mi lista/i })).toHaveAttribute("aria-pressed", "true");
    expect(Number(await preview.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  });
}

test("un scroll horizontal de OTRA fila no cierra la tarjeta; el de su propia fila sí", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await asFakeUser(page);
  await mockWatchlist(page);
  await page.goto("/inicio", { waitUntil: "load" });
  const rows = page.locator("section[class*='group/row']");
  await rows.nth(0).scrollIntoViewIfNeeded();
  await rows.nth(0).locator("[class*='group/card']").nth(1).hover();
  const preview = page.locator("[data-hover-preview]");
  await expect(preview).toBeVisible({ timeout: 4000 });
  await page.waitForTimeout(400);

  // Otra fila se desplaza sola (lo que ocurre al reordenarse): la tarjeta abierta no se mueve, así que se queda.
  await page.evaluate(() => {
    const other = document.querySelectorAll("section[class*='group/row'] .overflow-x-auto")[1] as HTMLElement | undefined;
    other?.scrollTo({ left: 40, behavior: "instant" });
  });
  await page.waitForTimeout(300);
  await expect(preview).toHaveCount(1);

  // Su propia fila se desplaza: la portada se mueve y la tarjeta se cierra.
  await page.evaluate(() => {
    const own = document.querySelectorAll("section[class*='group/row'] .overflow-x-auto")[0] as HTMLElement | undefined;
    own?.scrollTo({ left: 120, behavior: "instant" });
  });
  await expect(preview).toHaveCount(0, { timeout: 1500 });
});

test.describe("la fila «Mi Lista» no aparece de golpe al guardar el primer título", () => {
  const miLista = (page: Page) => page.getByRole("heading", { name: "Mi Lista", level: 2 });

  test("sin nada guardado al cargar: guardar desde la tarjeta flotante no crea la fila ni mueve la página", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await asFakeUser(page);
    await mockWatchlist(page);
    await page.goto("/inicio", { waitUntil: "load" });
    await expect(miLista(page)).toHaveCount(0);

    const row = page.locator("section[class*='group/row']").nth(0);
    await row.scrollIntoViewIfNeeded();
    await row.locator("[class*='group/card']").nth(1).hover();
    const preview = page.locator("[data-hover-preview]");
    await expect(preview).toBeVisible({ timeout: 4000 });
    await page.waitForTimeout(400);
    const heightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
    await preview.getByRole("button", { name: /mi lista/i }).click();
    await page.waitForTimeout(900);
    await expect(miLista(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(heightBefore);
  });

  test("con algo guardado al cargar, la fila aparece", async ({ page }) => {
    await asFakeUser(page);
    await page.route("**/api/watchlist**", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: { ids: [17, 39] } }) : route.fulfill({ json: { ok: true } }),
    );
    await page.goto("/inicio", { waitUntil: "load" });
    await expect(miLista(page)).toHaveCount(1, { timeout: 10_000 });
  });
});
