import { expect, test, type Page } from "@playwright/test";

/** Pestaña «Detalles» en tarjetas, a dos columnas en escritorio (como Filmin) y apiladas en móvil. */
const FICHA = "/cortos/el-cine-cobra-vida#detalles";

async function open(page: Page, width: number) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(FICHA, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Sinopsis" })).toBeVisible({ timeout: 20_000 });
}

const card = (page: Page, title: string) => page.locator("section[data-detail-card]", { has: page.getByRole("heading", { name: title, exact: true }) });

test("la sinopsis, la dirección y la información van cada una en su tarjeta", async ({ page }) => {
  await open(page, 1440);
  await expect(card(page, "Sinopsis")).toBeVisible();
  await expect(card(page, "Dirección y reparto")).toBeVisible();
  await expect(card(page, "Más información")).toBeVisible();
});

test("en escritorio la sinopsis queda a la izquierda y la información a la derecha", async ({ page }) => {
  await open(page, 1440);
  const left = (await card(page, "Sinopsis").boundingBox())!;
  const right = (await card(page, "Más información").boundingBox())!;
  expect(right.x).toBeGreaterThan(left.x + left.width - 1);
});

test("en móvil las tarjetas se apilan sin desbordar", async ({ page }) => {
  await open(page, 390);
  const a = (await card(page, "Sinopsis").boundingBox())!;
  const b = (await card(page, "Más información").boundingBox())!;
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("«Más información» lista año, duración y géneros con su etiqueta", async ({ page }) => {
  await open(page, 1440);
  const info = card(page, "Más información");
  await expect(info.getByText("Año:")).toBeVisible();
  await expect(info.getByText("Duración:")).toBeVisible();
  await expect(info.getByText("Géneros:")).toBeVisible();
});

test("no se muestran tarjetas ni filas vacías (sin idioma cargado no hay «Audio y subtítulos»)", async ({ page }) => {
  await open(page, 1440);
  await expect(page.getByRole("heading", { name: "Audio y subtítulos" })).toHaveCount(0);
});

test("en «Dirección y reparto» la dirección va siempre la primera", async ({ page }) => {
  await open(page, 1440);
  const first = card(page, "Dirección y reparto").locator("p").first();
  await expect(first).toContainText(/Direc|Creador/i);
});

test("en escritorio la tarjeta de sinopsis llega hasta abajo de «Más información»", async ({ page }) => {
  await open(page, 1440);
  const synopsis = (await card(page, "Sinopsis").boundingBox())!;
  const info = (await card(page, "Más información").boundingBox())!;
  const top = (await card(page, "Dirección y reparto").boundingBox())!;
  expect(Math.abs(synopsis.y - top.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(synopsis.y + synopsis.height - (info.y + info.height))).toBeLessThanOrEqual(2);
});
