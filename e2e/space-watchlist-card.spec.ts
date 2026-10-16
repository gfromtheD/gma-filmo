import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Mi Espacio → Mis Listas: al pasar el cursor por un título solo aparece una papelera pequeña (sin «Valorar»),
 * con una animación breve de borrado en la línea del botón de guardar.
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

async function openSpace(page: Page) {
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
  const deletes: number[] = [];
  await page.route("**/api/watchlist", (route) => {
    const request = route.request();
    if (request.method() === "DELETE") deletes.push((request.postDataJSON() as { peliculaId: number }).peliculaId);
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/watchlist?**", (route) => route.fulfill({ json: { ids: [1, 2, 3] } }));
  await page.goto("/mi-espacio", { waitUntil: "load" });
  await expect(page.getByText("Ver más tarde")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Quitar de Mi Lista" }).first()).toBeAttached({ timeout: 20_000 });
  return deletes;
}

const cardOf = (page: Page) => page.locator("div.group.relative").filter({ has: page.getByRole("button", { name: "Quitar de Mi Lista" }) });

test("en Mis Listas ya no existe el botón «Valorar»", async ({ page }) => {
  await openSpace(page);
  const card = cardOf(page).first();
  await card.hover();
  await expect(card.getByRole("button", { name: /Valorar|Editar valoración/ })).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(2); // el cartel (ir a la ficha) y la papelera
});

test("al pasar el cursor aparece una papelera pequeña en la esquina, no una X grande", async ({ page }) => {
  await openSpace(page);
  const card = cardOf(page).first();
  await card.hover();
  const button = card.getByRole("button", { name: "Quitar de Mi Lista" });
  await expect(button).toBeVisible();
  const visual = button.locator("[data-trash-visual]");
  const box = (await visual.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(30);
  expect(box.height).toBeLessThanOrEqual(30);
  // La zona pulsable sigue siendo cómoda (≥ 44 px) aunque lo que se ve es pequeño.
  const hit = (await button.boundingBox())!;
  expect(hit.width).toBeGreaterThanOrEqual(44);
  // Está en la esquina superior derecha del cartel y no tapa el centro.
  const cardBox = (await card.boundingBox())!;
  expect(box.x + box.width).toBeGreaterThan(cardBox.x + cardBox.width - 20);
  expect(box.y).toBeLessThan(cardBox.y + 20);
  await expect(button.locator("[data-trash-lid]")).toHaveCount(1); // es una papelera con tapa, no una X
});

test.describe("con movimiento normal", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "no-preference" }); });

  test("al pulsarla la papelera abre la tapa con un saltito y luego se quita el título", async ({ page }) => {
    const deletes = await openSpace(page);
    const before = await page.getByRole("button", { name: "Quitar de Mi Lista" }).count();
    const card = cardOf(page).first();
    await card.hover();
    const button = card.getByRole("button", { name: "Quitar de Mi Lista" });
    await button.click();
    // Justo después del clic hay animación (saltito + tapa) y el título aún está.
    const animating = await button.evaluate((el) => el.getAnimations({ subtree: true }).some((a) => ["saveHop", "trashLid"].includes((a as CSSAnimation).animationName)));
    expect(animating).toBe(true);
    // Termina quitándose de la lista, con una sola petición.
    await expect.poll(() => page.getByRole("button", { name: "Quitar de Mi Lista" }).count(), { timeout: 3000 }).toBe(before - 1);
    expect(deletes).toHaveLength(1);
  });

  test("pulsarla dos veces seguidas no envía dos peticiones", async ({ page }) => {
    const deletes = await openSpace(page);
    const card = cardOf(page).first();
    await card.hover();
    const button = card.getByRole("button", { name: "Quitar de Mi Lista" });
    await button.dblclick();
    await page.waitForTimeout(800);
    expect(deletes).toHaveLength(1);
  });
});

test.describe("con movimiento reducido", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

  test("se quita al instante, sin animación", async ({ page }) => {
    const deletes = await openSpace(page);
    const before = await page.getByRole("button", { name: "Quitar de Mi Lista" }).count();
    const card = cardOf(page).first();
    await card.hover();
    await card.getByRole("button", { name: "Quitar de Mi Lista" }).click();
    await expect.poll(() => page.getByRole("button", { name: "Quitar de Mi Lista" }).count(), { timeout: 1500 }).toBe(before - 1);
    // La tarjeta desaparece al instante; la petición sale un momento después.
    await expect.poll(() => deletes.length).toBe(1);
  });
});
