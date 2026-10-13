import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Valoraciones y comentarios en la ficha, como invitado (sin sesión).
 * Las APIs se simulan con rutas interceptadas: no se lee ni escribe nada real.
 * El formulario de valorar requiere sesión; su lógica pura está en e2e/unit.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const TOTAL_REVIEWS = 23;

function reviewsFor(offset: number, limit: number, sort: string) {
  const all = Array.from({ length: TOTAL_REVIEWS }, (_, i) => ({
    userId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    displayName: `Usuario ${i + 1}`,
    avatarUrl: null,
    avatarColor: null,
    score: (i % 10) + 1,
    comment: `Comentario número ${i + 1}`,
    ratedAt: new Date(Date.UTC(2026, 9, 12) - i * 86_400_000).toISOString(),
    likeCount: sort === "recent" ? 0 : TOTAL_REVIEWS - i,
    likedByMe: false,
  }));
  const page = all.slice(offset, offset + limit);
  return { reviews: page, avgScore: 7.4, voteCount: 120, total: TOTAL_REVIEWS, hasMore: offset + page.length < TOTAL_REVIEWS };
}

async function mockCommunity(page: Page, state: { failing: boolean; urls: string[] }) {
  await page.route("**/api/ratings/community?**", async (route: Route) => {
    const url = new URL(route.request().url());
    state.urls.push(url.search);
    if (state.failing) return route.fulfill({ status: 500, body: "error" });
    const limit = Number(url.searchParams.get("limit") ?? 5);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const sort = url.searchParams.get("sort") ?? "top";
    return route.fulfill({ json: reviewsFor(offset, limit, sort) });
  });
}

async function openFicha(page: Page, hash: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
  );
  expect(href).toBeTruthy();
  await page.goto(`${href as string}#${hash}`, { waitUntil: "load" });
}

test.describe("valoraciones (invitado)", () => {
  test("invitado: pide iniciar sesión y no ve el formulario", async ({ page }) => {
    await mockCommunity(page, { failing: false, urls: [] });
    await openFicha(page, "valoraciones");
    await expect(page.getByRole("heading", { name: "Valoraciones", exact: true })).toBeVisible();
    await expect(page.getByText("Inicia sesión para comentar")).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
  });

  test("lista paginada: 10 + 10 + 3, sin repetir y sin botón al llegar al final", async ({ page }) => {
    await mockCommunity(page, { failing: false, urls: [] });
    await openFicha(page, "valoraciones");
    const cards = page.locator("article");
    await expect(cards).toHaveCount(10);
    await expect(page.getByRole("heading", { name: /Valoraciones de usuarios/ })).toContainText(`(${TOTAL_REVIEWS})`);

    await page.getByRole("button", { name: "Ver más valoraciones" }).click();
    await expect(cards).toHaveCount(20);
    await page.getByRole("button", { name: "Ver más valoraciones" }).click();
    await expect(cards).toHaveCount(TOTAL_REVIEWS);
    await expect(page.getByRole("button", { name: "Ver más valoraciones" })).toHaveCount(0);

    const names = await cards.locator("header p.truncate").allInnerTexts();
    expect(new Set(names).size).toBe(TOTAL_REVIEWS);
  });

  test("cambiar el orden pide sort=recent a la API", async ({ page }) => {
    const state = { failing: false, urls: [] as string[] };
    await mockCommunity(page, state);
    await openFicha(page, "valoraciones");
    await expect(page.locator("article")).toHaveCount(10);
    await page.getByRole("button", { name: "Más recientes" }).click();
    await expect(page.getByRole("button", { name: "Más recientes" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => state.urls.some((u) => u.includes("sort=recent"))).toBe(true);
  });

  test("si falla la carga se avisa y 'Reintentar' la recupera", async ({ page }) => {
    const state = { failing: true, urls: [] as string[] };
    await mockCommunity(page, state);
    await openFicha(page, "valoraciones");
    await expect(page.getByText("No se pudieron cargar las valoraciones.")).toBeVisible();
    state.failing = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator("article")).toHaveCount(10);
  });

  test("la tarjeta muestra nota con etiqueta, comentario y fecha en mayúsculas", async ({ page }) => {
    await mockCommunity(page, { failing: false, urls: [] });
    await openFicha(page, "valoraciones");
    const first = page.locator("article").first();
    await expect(first).toContainText("Comentario número 1");
    await expect(first.locator("time")).toHaveText("12 OCTUBRE 2026");
    await expect(first.locator("span.border-white")).toHaveText("1");
  });
});

test.describe("comentarios (invitado)", () => {
  const comment = (id: number) => ({
    id, pelicula_id: 1, user_id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`, display_name: `Persona ${id}`,
    avatar_color: null, parent_id: null, content: `Opinión ${id}`, timestamp_ref: null, like_count: 0, liked_by_me: false,
    created_at: new Date(Date.now() - id * 3_600_000).toISOString(), replies: [],
  });

  test("muestra 10 comentarios y 'Ver más' añade el resto; el invitado no ve eliminar", async ({ page }) => {
    await page.route("**/api/comments?**", (route) => route.fulfill({ json: Array.from({ length: 12 }, (_, i) => comment(i + 1)) }));
    await openFicha(page, "comentarios");
    await expect(page.getByRole("heading", { name: /Comentarios/ })).toContainText("(12)");
    await expect(page.getByText("Opinión 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Opinión 10", { exact: true })).toBeVisible();
    await expect(page.getByText("Opinión 11", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Ver más comentarios" }).click();
    await expect(page.getByText("Opinión 12", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  });

  test("si falla la carga se avisa y 'Reintentar' la recupera", async ({ page }) => {
    let failing = true;
    await page.route("**/api/comments?**", (route) =>
      failing ? route.fulfill({ status: 500, body: "error" }) : route.fulfill({ json: [comment(1)] }),
    );
    await openFicha(page, "comentarios");
    await expect(page.getByText("No se pudieron cargar los comentarios.")).toBeVisible();
    failing = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Opinión 1", { exact: true })).toBeVisible();
  });
});
