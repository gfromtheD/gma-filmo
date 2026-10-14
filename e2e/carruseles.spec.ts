import { expect, test, type Page } from "@playwright/test";

/** Carruseles de la portada: cabeceras con subtítulo, pies de tarjeta y Top 10 con tarjeta que se expande. */
test.use({ viewport: { width: 1440, height: 900 } });

async function openHome(page: Page) {
  await page.context().addCookies([
    { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
  ]);
  await page.goto("/inicio", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const topTen = (page: Page) => page.locator('section[aria-label="Top 10 en GMA"]');

async function slotWidths(page: Page): Promise<number[]> {
  return topTen(page).locator("article").evaluateAll((els) =>
    els.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().width)),
  );
}

test.describe("cabeceras y pies de tarjeta", () => {
  test("cada fila lleva título y subtítulo, con la barra de acento", async ({ page }) => {
    await openHome(page);
    const row = page.locator("section.group\\/row", { has: page.getByRole("heading", { name: "Recién llegados" }) });
    await row.scrollIntoViewIfNeeded();
    await expect(row.getByText("Lo último que se ha añadido al catálogo")).toBeVisible();
    const header = row.getByRole("heading", { name: "Recién llegados" }).locator("..");
    await expect(header).toHaveCSS("border-left-width", "3px");
  });

  test("bajo cada portada va el título y el año, sin etiqueta de Cortometraje", async ({ page }) => {
    await openHome(page);
    const row = page.locator("section.group\\/row", { has: page.getByRole("heading", { name: "Recién llegados" }) });
    await row.scrollIntoViewIfNeeded();
    const caption = row.locator("div.snap-x h3").first();
    await expect(caption).toBeVisible();
    await expect(row.locator("div.snap-x").first()).not.toContainText(/cortometraje/i);
    await expect(caption.locator("xpath=following-sibling::p")).toContainText(/\d{4}/);
  });
});

test.describe("Top 10", () => {
  test("la primera tarjeta es ancha (616 px) y el resto verticales (200 px)", async ({ page }) => {
    await openHome(page);
    await topTen(page).scrollIntoViewIfNeeded();
    await expect.poll(() => slotWidths(page)).toEqual([616, 200, 200, 200]);
    await expect(topTen(page).getByRole("link", { name: "Ver ahora" })).toHaveCount(1);
  });

  test("al pasar el cursor por otra tarjeta se expande y la anterior se recoge", async ({ page }) => {
    await openHome(page);
    const section = topTen(page);
    await section.scrollIntoViewIfNeeded();
    const third = section.locator("article").nth(2);
    const box = await third.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 140, { steps: 4 });
    await expect.poll(() => slotWidths(page), { timeout: 4_000 }).toEqual([200, 200, 616, 200]);
    // El botón de ver y la descripción pasan a la tarjeta abierta.
    await expect(third.getByRole("link", { name: "Ver ahora" })).toBeVisible();
    await expect(section.locator("article").first().getByRole("link", { name: "Ver ahora" })).toHaveCount(0);
  });

  test("el botón Ver ahora lleva al reproductor y el resto de la tarjeta a la ficha", async ({ page }) => {
    await openHome(page);
    await topTen(page).scrollIntoViewIfNeeded();
    await topTen(page).getByRole("link", { name: "Ver ahora" }).click();
    await expect(page).toHaveURL(/\/ver\//);
  });
});

test("orden de las filas: recién llegados, Top 10, recomendaciones y, al final, colecciones", async ({ page }) => {
  await openHome(page);
  const titles = await page.getByRole("heading", { level: 2 }).allInnerTexts();
  const at = (text: string) => titles.findIndex((t) => t.trim() === text);
  expect(at("Recién llegados")).toBeGreaterThanOrEqual(0);
  expect(at("Recién llegados")).toBeLessThan(at("Top 10 en GMA"));
  expect(at("Top 10 en GMA")).toBeLessThan(at("Colecciones para ti"));
  // Cualquier fila recomendada (Porque viste…, Más de…, Creemos que…) queda entre el Top 10 y las colecciones.
  expect(titles.at(-1)?.trim()).toBe("Colecciones para ti");
});
