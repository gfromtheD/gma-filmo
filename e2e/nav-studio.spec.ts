import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Cabecera de escritorio: «Mi Espacio» ya no está en el menú de texto (se abre desde el icono de guardados, junto a
 * la foto de perfil) y «Mi Estudio» es un enlace normal solo para creadores, sin el doble clic que cambiaba la palabra.
 */
test.use({ viewport: { width: 1280, height: 900 } });

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

const nav = (page: Page) => page.getByRole("navigation", { name: "Principal" });

test("un visitante no ve ni «Mi Espacio» ni «Mi Estudio» en el menú", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  await expect(nav(page).getByRole("link", { name: "Home" })).toBeVisible({ timeout: 20_000 });
  await expect(nav(page).getByRole("link", { name: "Mi Espacio" })).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "Mi Estudio" })).toHaveCount(0);
  await expect(nav(page).getByRole("button")).toHaveCount(0);
});

test("Mi Espacio se abre desde el icono de guardados, al lado de la foto de perfil", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  const bookmark = page.locator("header").getByRole("link", { name: "Mi lista" });
  await expect(bookmark).toHaveAttribute("href", "/mi-espacio");
  const account = (await page.locator("header").getByRole("button", { name: "Cuenta" }).boundingBox())!;
  const icon = (await bookmark.boundingBox())!;
  expect(icon.x + icon.width).toBeLessThanOrEqual(account.x + 4); // justo a su izquierda
  expect(account.x - (icon.x + icon.width)).toBeLessThanOrEqual(24);
});

test.describe("creador (sesión simulada)", () => {
  test.beforeEach(async ({ page }) => {
    await asFakeUser(page);
    await page.route("**/rest/v1/creator_profiles**", (route) => route.fulfill({ json: { user_id: "22222222-2222-4222-8222-222222222222" } }));
    await page.route("**/api/watchlist**", (route) => route.fulfill({ json: { ids: [] } }));
  });

  test("ve «Mi Estudio» como enlace normal a /mi-estudio y sin «Mi Espacio»", async ({ page }) => {
    await page.goto("/inicio", { waitUntil: "load" });
    const studio = nav(page).getByRole("link", { name: "Mi Estudio" });
    await expect(studio).toBeVisible({ timeout: 20_000 });
    await expect(studio).toHaveAttribute("href", "/mi-estudio");
    await expect(nav(page).getByRole("link", { name: "Mi Espacio" })).toHaveCount(0);
    await expect(nav(page).getByRole("button")).toHaveCount(0); // ya no es el botón de la ruleta
  });

  test("ya no hay ruleta: la palabra siempre es «Mi Estudio» y un doble clic no la cambia", async ({ page }) => {
    await page.goto("/inicio", { waitUntil: "load" });
    const studio = nav(page).getByRole("link", { name: "Mi Estudio" });
    await expect(studio).toBeVisible({ timeout: 20_000 });
    await studio.dblclick({ noWaitAfter: true }).catch(() => undefined);
    await page.waitForTimeout(700);
    // Sea cual sea la página a la que llegue, el menú nunca ofrece «Mi Espacio» como palabra.
    await expect(nav(page).getByText("Mi Espacio")).toHaveCount(0);
    expect(await page.locator("header [aria-label='Mi Espacio']").count()).toBe(0);
  });

  test("el icono de guardados sigue llevando a Mi Espacio también para creadores", async ({ page }) => {
    await page.goto("/inicio", { waitUntil: "load" });
    await expect(page.locator("header").getByRole("link", { name: "Mi lista" })).toHaveAttribute("href", "/mi-espacio");
  });
});
