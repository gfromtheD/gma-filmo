import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Los carruseles de la portada siempre empiezan por el principio, aunque sus tarjetas se reordenen al cargar
 * los datos del usuario (antes «Colecciones para ti» podía arrancar por la cuarta tarjeta).
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

async function openHomeWithHistory(page: Page) {
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
  // Historial de visionado: el orden de las colecciones recomendadas cambia al cargarlo.
  const rows = Array.from({ length: 40 }, (_, i) => ({
    pelicula_id: i + 1, last_position: i % 2 === 0 ? 200 : 5, completed: i % 2 === 0, last_watched_at: new Date(Date.now() - i * 3_600_000).toISOString(),
  }));
  await page.route("**/rest/v1/view_history**", (route) => route.fulfill({ json: rows }));
  await page.route("**/api/watchlist**", (route) => route.fulfill({ json: { ids: [] } }));
  await page.goto("/inicio", { waitUntil: "load" });
}

test("«Colecciones para ti» arranca por la primera tarjeta, no a mitad de la fila", async ({ page }) => {
  await openHomeWithHistory(page);
  const row = page.getByRole("region", { name: "Colecciones para ti" });
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator("a").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500); // da tiempo a que lleguen los datos y se reordene la fila
  const state = await row.evaluate((el) => {
    const first = el.firstElementChild!.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { scrollLeft: Math.round(el.scrollLeft), firstLeft: Math.round(first.left - box.left) };
  });
  expect(state.scrollLeft).toBe(0);
  expect(state.firstLeft).toBeGreaterThanOrEqual(0);
});

test("la flecha «Anterior» está desactivada al empezar (no se puede ir hacia atrás)", async ({ page }) => {
  await openHomeWithHistory(page);
  const section = page.locator("section", { has: page.getByRole("region", { name: "Colecciones para ti" }) });
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(section.getByRole("button", { name: "Anterior" })).toBeDisabled();
});

test("todos los carruseles de la portada empiezan en el extremo izquierdo", async ({ page }) => {
  await openHomeWithHistory(page);
  await page.waitForTimeout(2000);
  const offsets = await page.locator("section.group\\/row [role=region]").evaluateAll((els) => els.map((el) => Math.round(el.scrollLeft)));
  expect(offsets.length).toBeGreaterThan(2);
  expect(offsets.every((x) => x === 0)).toBe(true);
});
