import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Valoraciones con SESIÓN SIMULADA: se guarda un token falso donde lo lee el cliente
 * de Supabase y se interceptan las APIs de valoraciones. No se lee ni escribe nada real.
 * Se omite si no hay URL de Supabase en .env.local.
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
const USER_ID = "11111111-1111-4111-8111-111111111111";

async function signInFake(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: "fake.fake.fake",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: "fake-refresh",
    user: {
      id: USER_ID, aud: "authenticated", role: "authenticated", email: "qa@example.test",
      app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
    },
  };
  // @supabase/ssr guarda la sesión en una cookie con prefijo "base64-" (JSON en base64url).
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await page.context().addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value, url: "http://localhost:3000" },
    { name: "gma_guest", value: "1", url: "http://localhost:3000" },
  ]);
}

interface ApiState {
  numericId: number | null;
  entries: { pelicula_id: number; score: number; comment: string; rated_at: string }[];
  posts: unknown[];
  deletes: unknown[];
  postStatus: number;
  deleteStatus: number;
}

async function mockApis(page: Page, state: ApiState) {
  await page.route("**/api/ratings/community?**", (route) => {
    const id = Number(new URL(route.request().url()).searchParams.get("peliculaId"));
    if (!Number.isNaN(id)) state.numericId = id;
    return route.fulfill({ json: { reviews: [], avgScore: null, voteCount: 0, total: 0, hasMore: false } });
  });
  await page.route("**/api/ratings?**", async (route) => {
    // La valoración propia solo puede coincidir con la película una vez conocida.
    const started = Date.now();
    while (state.numericId === null && Date.now() - started < 5_000) await new Promise((r) => setTimeout(r, 50));
    const entries = state.entries.map((e) => ({ ...e, pelicula_id: state.numericId ?? e.pelicula_id }));
    return route.fulfill({ json: { entries } });
  });
  await page.route("**/api/ratings", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      state.posts.push(request.postDataJSON());
      return route.fulfill({ status: state.postStatus, json: { ok: state.postStatus === 200 } });
    }
    if (request.method() === "DELETE") {
      state.deletes.push(request.postDataJSON());
      return route.fulfill({ status: state.deleteStatus, json: { ok: state.deleteStatus === 200 } });
    }
    return route.continue();
  });
}

async function openFicha(page: Page) {
  await page.goto("/inicio", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
  );
  await page.goto(`${href as string}#valoraciones`, { waitUntil: "load" });
}

const newState = (over: Partial<ApiState> = {}): ApiState => ({
  numericId: null, entries: [], posts: [], deletes: [], postStatus: 200, deleteStatus: 200, ...over,
});

test.describe("valoraciones con sesión simulada", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("elegir nota con teclado y publicar envía nota/2 y el comentario", async ({ page }) => {
    const state = newState();
    await signInFake(page);
    await mockApis(page, state);
    await openFicha(page);

    const scale = page.getByRole("radiogroup", { name: /Tu puntuación/ });
    await expect(scale).toBeVisible();
    await scale.getByRole("radio", { name: /^1,/ }).focus();
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight"); // 1 → 8
    await expect(scale.locator("[aria-checked=true]")).toHaveAttribute("aria-label", "8, Muy buena");
    await page.getByLabel(/Tu comentario/).fill("Me ha encantado");
    await page.getByRole("button", { name: "Publicar valoración" }).click();

    await expect.poll(() => state.posts.length).toBe(1);
    expect(state.posts[0]).toMatchObject({ score: 4, comment: "Me ha encantado", profileId: "" });
    // Éxito: el formulario se retira y aparece "Tu valoración" fijada.
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    const own = page.locator("article", { hasText: "Tu valoración" });
    await expect(own).toContainText("Me ha encantado");
    await expect(own).toContainText("Muy buena");
  });

  test("si el servidor rechaza el guardado NO se pierde lo escrito y se avisa", async ({ page }) => {
    const state = newState({ postStatus: 429 });
    await signInFake(page);
    await mockApis(page, state);
    await openFicha(page);

    const scale = page.getByRole("radiogroup", { name: /Tu puntuación/ });
    await scale.getByRole("radio", { name: /^9,/ }).click();
    await page.getByLabel(/Tu comentario/).fill("Texto largo que no quiero perder");
    await page.getByRole("button", { name: "Publicar valoración" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "No se pudo guardar tu valoración" })).toBeVisible();
    await expect(page.getByLabel(/Tu comentario/)).toHaveValue("Texto largo que no quiero perder");
    await expect(scale.locator("[aria-checked=true]")).toHaveAttribute("aria-label", "9, Excelente");
    await expect(page.locator("article", { hasText: "Tu valoración" })).toHaveCount(0);

    // Y reintentar con el servidor ya disponible funciona sin volver a escribir.
    state.postStatus = 200;
    await page.getByRole("button", { name: "Publicar valoración" }).click();
    await expect(page.locator("article", { hasText: "Tu valoración" })).toContainText("Texto largo que no quiero perder");
  });

  test("quitar la valoración pide confirmación y, si falla, la conserva", async ({ page }) => {
    const state = newState({
      entries: [{ pelicula_id: 0, score: 4, comment: "La vi dos veces", rated_at: "2026-10-01T10:00:00Z" }],
      deleteStatus: 500,
    });
    await signInFake(page);
    await mockApis(page, state);
    await openFicha(page);

    const own = page.locator("article", { hasText: "Tu valoración" });
    await expect(own).toContainText("La vi dos veces");
    await own.getByRole("button", { name: "Quitar" }).click();
    await expect(own.getByText("¿Quitar tu valoración?")).toBeVisible();
    await own.getByRole("button", { name: "Sí, quitar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "No se pudo quitar tu valoración" })).toBeVisible();
    await expect(own).toContainText("La vi dos veces"); // sigue ahí
    await expect(page.getByRole("radiogroup")).toHaveCount(0); // y no asoma el formulario nuevo

    state.deleteStatus = 200;
    await own.getByRole("button", { name: "Quitar" }).click();
    await own.getByRole("button", { name: "Sí, quitar" }).click();
    await expect(page.getByRole("radiogroup", { name: /Tu puntuación/ })).toBeVisible();
    expect(state.deletes.length).toBe(2);
  });

  test("editar abre el formulario con la nota y el comentario previos y permite cancelar", async ({ page }) => {
    const state = newState({
      entries: [{ pelicula_id: 0, score: 3, comment: "Correcta", rated_at: "2026-10-01T10:00:00Z" }],
    });
    await signInFake(page);
    await mockApis(page, state);
    await openFicha(page);

    await page.locator("article", { hasText: "Tu valoración" }).getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("radiogroup").locator("[aria-checked=true]")).toHaveAttribute("aria-label", "6, Pasable");
    await expect(page.getByLabel(/Tu comentario/)).toHaveValue("Correcta");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.locator("article", { hasText: "Tu valoración" })).toBeVisible();
    expect(state.posts).toHaveLength(0);
  });
});
