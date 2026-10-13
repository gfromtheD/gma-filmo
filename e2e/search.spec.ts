import { expect, test, type Page } from "@playwright/test";

/** Buscador: sin teclado en pantalla, resultados en vivo tolerantes a tildes/erratas, historial y estados vacíos. */
test.use({ viewport: { width: 1440, height: 900 } });

async function openSearch(page: Page) {
  await page.context().addCookies([
    { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
  ]);
  await page.goto("/buscador", { waitUntil: "load" });
  await expect(page.getByRole("textbox", { name: /Buscar/ })).toBeVisible();
}

const box = (page: Page) => page.getByRole("textbox", { name: /Buscar/ });
const summary = (page: Page) => page.locator("[aria-live=polite]");

/** Reintenta hasta que React haya hidratado y el texto llegue al campo (el primer intento puede perderse). */
async function typeQuery(page: Page, text: string) {
  await expect(async () => {
    await box(page).fill(text);
    await expect(box(page)).toHaveValue(text, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test("ya no hay teclado en pantalla y el campo está listo para escribir", async ({ page }) => {
  await openSearch(page);
  await expect(page.getByRole("button", { name: "Espacio", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Q", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Listo para una aventura?");
  await expect(page.getByRole("heading", { name: "Destacados hoy" })).toBeVisible();
});

test("el campo es una píldora centrada de unos 576 px", async ({ page }) => {
  await openSearch(page);
  const b = await page.getByRole("search").boundingBox();
  expect(Math.round(b?.width ?? 0)).toBeGreaterThanOrEqual(560);
  expect(Math.round(b?.width ?? 0)).toBeLessThanOrEqual(625);
  const center = (b?.x ?? 0) + (b?.width ?? 0) / 2;
  expect(Math.abs(center - 720)).toBeLessThanOrEqual(2);
});

test("escribir filtra al instante y cambia el título; sin tildes ni mayúsculas", async ({ page }) => {
  await openSearch(page);
  await typeQuery(page, "CONTROL");
  await expect(summary(page)).toContainText(/\d+ resultados? para «CONTROL»/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Encuentra tu próxima historia");
  await expect(page.getByRole("link", { name: /Control Mental/ }).first()).toBeVisible();
});

test("tolera una errata y, sin resultados, ofrece alternativas", async ({ page }) => {
  await openSearch(page);
  await typeQuery(page, "contrl mentl");
  await expect(summary(page)).toContainText(/1 resultado para/);

  await typeQuery(page, "zzzzqq");
  await expect(summary(page)).toContainText("Sin resultados para «zzzzqq»");
  await expect(page.getByText("No hemos encontrado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop Motion" }).first()).toBeVisible();
});

test("Escape borra lo escrito, '/' enfoca el campo y el botón de borrar vacía la búsqueda", async ({ page }) => {
  await openSearch(page);
  await typeQuery(page, "mano");
  await box(page).press("Escape");
  await expect(box(page)).toHaveValue("");

  await typeQuery(page, "mano");
  await page.getByRole("button", { name: "Borrar búsqueda" }).click();
  await expect(box(page)).toHaveValue("");

  await page.locator("body").click({ position: { x: 5, y: 400 } });
  await page.keyboard.press("/");
  await expect(box(page)).toBeFocused();
});

test("Enter guarda la búsqueda en el historial y se puede reutilizar, quitar y borrar", async ({ page }) => {
  await openSearch(page);
  await typeQuery(page, "stop motion");
  await box(page).press("Enter");
  await box(page).press("Escape");

  const recent = page.getByRole("region", { name: "Búsquedas recientes" });
  await expect(recent.getByRole("button", { name: "stop motion", exact: true })).toBeVisible();

  await recent.getByRole("button", { name: "stop motion", exact: true }).click();
  await expect(box(page)).toHaveValue("stop motion");
  await box(page).press("Escape");

  await recent.getByRole("button", { name: /Quitar «stop motion»/ }).click();
  await expect(recent).toHaveCount(0);
});

test("la tarjeta de un resultado lleva a su ficha", async ({ page }) => {
  await openSearch(page);
  await typeQuery(page, "control mental");
  await expect(summary(page)).toContainText(/1 resultado/);
  await page.getByRole("link", { name: /Control Mental/ }).first().click();
  await expect(page).toHaveURL(/\/cortos\/[^/]+$/);
});

test.describe("móvil", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("no hay desbordamiento horizontal ni teclado en pantalla", async ({ page }) => {
    await openSearch(page);
    await typeQuery(page, "control");
    await expect(summary(page)).toContainText(/resultado/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.getByRole("button", { name: "Espacio", exact: true })).toHaveCount(0);
  });
});
