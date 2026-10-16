import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Micro-animación del icono de guardar: un saltito suave y el marcador pasa de vacío a coloreado, como una cinta
 * que se deja sobre la página de un libro. Solo al guardar con un clic: no al cargar, no al quitar.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const ME = "22222222-2222-4222-8222-222222222222";
const GREEN = "rgb(34, 177, 107)";
const FICHA = "/cortos/el-cine-cobra-vida";

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

async function asFakeUser(page: Page) {
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
}

interface WatchlistMock { readonly saved?: boolean; readonly postOk?: boolean; readonly deleteOk?: boolean }

async function mockWatchlist(page: Page, { saved = false, postOk = true, deleteOk = true }: WatchlistMock = {}) {
  await page.route("**/api/watchlist**", (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: { ids: saved ? Array.from({ length: 300 }, (_, i) => i + 1) : [] } });
    if (method === "POST") return route.fulfill({ status: postOk ? 200 : 500, json: { ok: postOk } });
    return route.fulfill({ status: deleteOk ? 200 : 500, json: { ok: deleteOk } });
  });
}

const icon = (page: Page) => page.locator("[data-save-icon]").first();
const fillOf = (page: Page) => icon(page).locator("svg").evaluate((svg) => getComputedStyle(svg).fill);
const hopping = (page: Page) =>
  icon(page).evaluate((el) => el.getAnimations({ subtree: true }).some((a) => (a as CSSAnimation).animationName === "saveHop"));

async function openFicha(page: Page) {
  await asFakeUser(page);
  await page.goto(FICHA, { waitUntil: "load" });
  await expect(page.getByRole("button", { name: /^Guardar/ })).toBeVisible({ timeout: 20_000 });
}

test.describe("con movimiento normal", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "no-preference" }); });

  test("al guardar, el icono da un saltito y queda coloreado", async ({ page }) => {
    await mockWatchlist(page);
    await openFicha(page);
    await expect(icon(page)).toHaveAttribute("data-saved", "false");
    expect(await fillOf(page)).not.toBe(GREEN);

    await page.getByRole("button", { name: /^Guardar/ }).click();
    await expect.poll(() => hopping(page), { timeout: 1500 }).toBe(true); // hay saltito
    await expect(icon(page)).toHaveAttribute("data-saved", "true");
    await expect.poll(() => fillOf(page), { timeout: 2000 }).toBe(GREEN); // y queda coloreado
    await expect.poll(() => hopping(page), { timeout: 2000 }).toBe(false); // el salto termina (dura menos de medio segundo)
  });

  test("el saltito es corto y suave (menos de 0,5 s, solo transform)", async ({ page }) => {
    await mockWatchlist(page);
    await openFicha(page);
    await page.getByRole("button", { name: /^Guardar/ }).click();
    await expect.poll(() => hopping(page), { timeout: 1500 }).toBe(true);
    const info = await icon(page).evaluate((el) => {
      const animation = el.getAnimations({ subtree: true }).find((a) => (a as CSSAnimation).animationName === "saveHop") as CSSAnimation;
      const timing = animation.effect!.getComputedTiming();
      const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
      return { duration: Number(timing.duration), props: [...new Set(keyframes.flatMap((k) => Object.keys(k)))] };
    });
    expect(info.duration).toBeGreaterThanOrEqual(200);
    expect(info.duration).toBeLessThanOrEqual(500);
    const animated = info.props.filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p));
    expect(animated).toEqual(["transform"]); // solo transform: sin tirones ni layout
  });

  test("si ya estaba guardado al cargar, no se anima", async ({ page }) => {
    await mockWatchlist(page, { saved: true });
    await asFakeUser(page);
    await page.goto(FICHA, { waitUntil: "load" });
    await expect(page.getByRole("button", { name: /^Guardada/ })).toBeVisible({ timeout: 20_000 });
    await expect(icon(page)).toHaveAttribute("data-saved", "true");
    expect(await hopping(page)).toBe(false); // sin saltito: solo se rellena con suavidad al llegar el dato
    await expect.poll(() => fillOf(page), { timeout: 2000 }).toBe(GREEN);
  });

  test("al quitarlo no hay saltito y el icono vuelve a vacío", async ({ page }) => {
    await mockWatchlist(page, { saved: true });
    await asFakeUser(page);
    await page.goto(FICHA, { waitUntil: "load" });
    await page.getByRole("button", { name: /^Guardada/ }).click();
    await expect(icon(page)).toHaveAttribute("data-saved", "false");
    expect(await hopping(page)).toBe(false);
    await expect.poll(() => fillOf(page), { timeout: 2000 }).not.toBe(GREEN);
  });

  test("si el servidor rechaza guardar, el icono vuelve a vacío", async ({ page }) => {
    await mockWatchlist(page, { postOk: false });
    await openFicha(page);
    await page.getByRole("button", { name: /^Guardar/ }).click();
    await expect(icon(page)).toHaveAttribute("data-saved", "false", { timeout: 4000 });
    await expect.poll(() => fillOf(page), { timeout: 2000 }).not.toBe(GREEN);
  });

  test("también anima en las tarjetas del catálogo (icono sobre la imagen)", async ({ page }) => {
    await mockWatchlist(page);
    await asFakeUser(page);
    const sessionReady = page.waitForRequest((r) => r.url().includes("/api/watchlist") && r.method() === "GET");
    await page.goto("/cortos", { waitUntil: "load" });
    await sessionReady; // la sesión ya está cargada: guardar no pide iniciar sesión
    const card = page.locator("[class*='group/card']").first(); // la primera tarjeta de Cortos (se fija antes de pulsar)
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    const button = card.getByRole("button", { name: /Mi Lista/ });
    await button.click();
    const cardIcon = card.locator("[data-save-icon]");
    await expect(cardIcon).toHaveAttribute("data-saved", "true");
    await expect.poll(() => cardIcon.evaluate((el) => el.getAnimations({ subtree: true }).some((a) => (a as CSSAnimation).animationName === "saveHop")), { timeout: 1500 }).toBe(true);
  });
});

test.describe("con movimiento reducido", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

  test("el icono cambia de estado al instante, sin saltito", async ({ page }) => {
    await mockWatchlist(page);
    await openFicha(page);
    await page.getByRole("button", { name: /^Guardar/ }).click();
    await expect(icon(page)).toHaveAttribute("data-saved", "true");
    expect(await hopping(page)).toBe(false);
    await expect.poll(() => fillOf(page), { timeout: 1000 }).toBe(GREEN);
  });
});
