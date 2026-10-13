import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Guardar en la lista: invitado (aviso, sin falso "guardado") y sesión simulada
 * (guardado correcto y deshacer si falla). Las APIs se interceptan: no se escribe nada real.
 */
test.use({ viewport: { width: 1440, height: 900 } });

function supabaseProjectRef(): string | null {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const raw = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
    const url = raw.replace(/^["']|["']$/g, "");
    return url ? (new URL(url).hostname.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}
const PROJECT_REF = supabaseProjectRef();

async function asGuest(page: Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
}

async function asFakeUser(page: Page) {
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: {
      id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", role: "authenticated",
      email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
    },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await page.context().addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value, url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
    { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
  ]);
}

async function openFicha(page: Page) {
  await page.goto("/inicio", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
  );
  await page.goto(href as string, { waitUntil: "load" });
}

async function trackWatchlistPosts(page: Page, status: number) {
  const calls: string[] = [];
  await page.route("**/api/watchlist", (route) => {
    const method = route.request().method();
    if (method === "POST" || method === "DELETE") {
      calls.push(method);
      return route.fulfill({ status, json: { ok: status === 200 } });
    }
    return route.continue();
  });
  await page.route("**/api/watchlist?**", (route) => route.fulfill({ json: { ids: [] } }));
  return calls;
}

test.describe("invitado", () => {
  test("en la ficha, Guardar avisa de que hace falta iniciar sesión y no marca nada como guardado", async ({ page }) => {
    await asGuest(page);
    const calls = await trackWatchlistPosts(page, 200);
    await openFicha(page);

    await page.getByRole("button", { name: "Guardar" }).first().click();
    const notice = page.getByRole("status").filter({ hasText: "Inicia sesión para guardar" });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/?login=1");
    await expect(page.getByRole("button", { name: "Guardar" }).first()).toHaveAttribute("aria-pressed", "false");
    expect(calls).toHaveLength(0); // ni siquiera se llama a la API

    await notice.getByRole("button", { name: "Cerrar aviso" }).click();
    await expect(notice).toBeHidden();
  });

  test("en el panel de la portada, guardar avisa y el aviso sobrevive al cierre del panel", async ({ page }) => {
    await asGuest(page);
    const calls = await trackWatchlistPosts(page, 200);
    await page.goto("/inicio", { waitUntil: "load" });
    await page.evaluate(() => window.scrollTo(0, 560));
    const card = page.locator("div.snap-x > div").first();
    const box = await card.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + (box?.height ?? 0) + 120);
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2, { steps: 5 });
    const preview = page.locator("[data-hover-preview]");
    await expect(preview).toBeVisible({ timeout: 3_000 });

    await preview.getByRole("button", { name: /mi lista/i }).click();
    const notice = page.getByRole("status").filter({ hasText: "Inicia sesión para guardar" });
    await expect(notice).toBeVisible();

    await page.mouse.move(5, 5, { steps: 4 }); // el panel se cierra...
    await expect(preview).toBeHidden();
    await expect(notice).toBeVisible(); // ...pero el aviso sigue
    expect(calls).toHaveLength(0);
  });
});

test.describe("con sesión simulada", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("guardar con éxito marca la ficha como guardada", async ({ page }) => {
    await asFakeUser(page);
    const calls = await trackWatchlistPosts(page, 200);
    await openFicha(page);

    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByRole("button", { name: "Guardada" }).first()).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => calls).toEqual(["POST"]);
    await expect(page.getByRole("status").filter({ hasText: "Inicia sesión" })).toHaveCount(0);
  });

  test("si el servidor falla, se deshace y se avisa (no queda un falso 'guardada')", async ({ page }) => {
    await asFakeUser(page);
    const calls = await trackWatchlistPosts(page, 500);
    await openFicha(page);

    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "No se pudo actualizar tu lista" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar" }).first()).toHaveAttribute("aria-pressed", "false");
    expect(calls).toEqual(["POST"]);
  });
});
