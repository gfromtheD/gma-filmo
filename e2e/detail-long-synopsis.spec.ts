import { expect, test } from "@playwright/test";

/**
 * Cabecera = frase corta que escribió el creador; tarjeta «Sinopsis» = texto largo documentado.
 * El texto largo llena la tarjeta hasta la altura de la columna derecha.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const FICHA = "/cortos/yasha-gozen#detalles";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(FICHA, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Sinopsis" })).toBeVisible({ timeout: 20_000 });
});

test("la cabecera conserva la frase corta original", async ({ page }) => {
  const header = page.locator("p.line-clamp-3").first();
  await expect(header).toContainText("Basado en el manga de");
  expect((await header.innerText()).length).toBeLessThanOrEqual(180);
});

test("la tarjeta de sinopsis amplía esa frase con contexto de la obra", async ({ page }) => {
  const card = page.locator("section[data-detail-card]", { has: page.getByRole("heading", { name: "Sinopsis", exact: true }) });
  await expect(card).toContainText("Petit Comic");
  await expect(card).toContainText("Grupo del 24");
  const text = await card.locator("p.whitespace-pre-line").innerText();
  expect(text.length).toBeGreaterThan(500);
});

test("un corto sin texto largo sigue mostrando su sinopsis normal", async ({ page }) => {
  await page.goto("/cortos/el-cine-cobra-vida#detalles", { waitUntil: "load" });
  const card = page.locator("section[data-detail-card]", { has: page.getByRole("heading", { name: "Sinopsis", exact: true }) });
  await expect(card).toContainText("Las películas abandonan la pantalla");
});

test.describe("sinopsis larga plegable («… Más»)", () => {
  const synopsisCard = (page: import("@playwright/test").Page) =>
    page.locator("section[data-detail-card]", { has: page.getByRole("heading", { name: "Sinopsis", exact: true }) });
  const infoCard = (page: import("@playwright/test").Page) =>
    page.locator("section[data-detail-card]", { has: page.getByRole("heading", { name: "Más información", exact: true }) });

  test("plegada, la tarjeta no pasa de la altura de la columna derecha y ofrece «Más»", async ({ page }) => {
    const card = (await synopsisCard(page).boundingBox())!;
    const info = (await infoCard(page).boundingBox())!;
    expect(Math.abs(card.y + card.height - (info.y + info.height))).toBeLessThanOrEqual(2);
    await expect(page.getByRole("button", { name: "Más", exact: true })).toBeVisible();
    // El texto está cortado (hay más contenido del que se ve).
    const clipped = await synopsisCard(page).locator("p.whitespace-pre-line").evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(clipped).toBe(true);
  });

  test("«Más» expande la tarjeta y la columna derecha la acompaña; «Menos» la vuelve a plegar", async ({ page }) => {
    const collapsed = (await synopsisCard(page).boundingBox())!;
    const toggle = page.getByRole("button", { name: "Más", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();

    const less = page.getByRole("button", { name: "Menos", exact: true });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    const expanded = (await synopsisCard(page).boundingBox())!;
    expect(expanded.height).toBeGreaterThan(collapsed.height + 20);
    const full = await synopsisCard(page).locator("p.whitespace-pre-line").evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    expect(full).toBe(true); // ya no está cortado

    const info = (await infoCard(page).boundingBox())!;
    expect(Math.abs(expanded.y + expanded.height - (info.y + info.height))).toBeLessThanOrEqual(2);

    await less.click();
    const back = (await synopsisCard(page).boundingBox())!;
    expect(Math.abs(back.height - collapsed.height)).toBeLessThanOrEqual(2);
  });

  test("una sinopsis que cabe no muestra «Más»", async ({ page }) => {
    await page.goto("/cortos/el-cine-cobra-vida#detalles", { waitUntil: "load" });
    await expect(synopsisCard(page)).toContainText("Las películas abandonan la pantalla");
    await expect(page.getByRole("button", { name: "Más", exact: true })).toHaveCount(0);
  });

  test("en móvil el texto se muestra entero, sin «Más»", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(FICHA, { waitUntil: "load" });
    await expect(synopsisCard(page).getByText("apenas un minuto y medio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Más", exact: true })).toHaveCount(0);
  });
});
