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
  test("la primera tarjeta es ancha (616 px × 1,335 = 823 px a 1440 px) y el resto verticales (200 × 1,335 = 267 px)", async ({ page }) => {
    await openHome(page);
    await topTen(page).scrollIntoViewIfNeeded();
    await expect.poll(() => slotWidths(page)).toEqual([823, 267, 267, 267]);
    await expect(topTen(page).getByRole("link", { name: "Ver ahora" })).toHaveCount(1);
  });

  test("al pasar el cursor por otra tarjeta se expande y la anterior se recoge", async ({ page }) => {
    await openHome(page);
    const section = topTen(page);
    await section.scrollIntoViewIfNeeded();
    const third = section.locator("article").nth(2);
    const box = await third.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 140, { steps: 4 });
    await expect.poll(() => slotWidths(page), { timeout: 4_000 }).toEqual([267, 267, 823, 267]);
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
  // Solo el contenido de la página: los títulos del pie de página (Explorar, Proyecto, Legal) no son filas.
  const titles = await page.getByRole("main").getByRole("heading", { level: 2 }).allInnerTexts();
  const at = (text: string) => titles.findIndex((t) => t.trim() === text);
  expect(at("Recién llegados")).toBeGreaterThanOrEqual(0);
  expect(at("Recién llegados")).toBeLessThan(at("Top 10 en GMA"));
  expect(at("Top 10 en GMA")).toBeLessThan(at("Colecciones para ti"));
  // Cualquier fila recomendada (Porque viste…, Más de…, Creemos que…) queda entre el Top 10 y las colecciones.
  expect(titles.at(-1)?.trim()).toBe("Colecciones para ti");
});

/**
 * Tamaño de las tarjetas (medido en la fila de tarjetas grandes de Filmin): cada celda se calcula para que quepan
 * N tarjetas completas más un trozo (~0,16) de la siguiente, que invita a deslizar. N = 2 en tableta, 3 desde
 * 1000 px y 4 desde 1500 px. La imagen es siempre 16:9 y deja 8 px a cada lado de la celda. La primera portada
 * queda alineada con la barra del título de la sección (16 px en tableta, 64 px desde 1024).
 * Referencia de Filmin: 438 px de celda a 1440 px y 448 px a 1920 px.
 */
const PEEK = 0.16;
const SIZES: ReadonlyArray<readonly [number, number, number]> = [
  // ancho, margen izquierdo de la primera portada, tarjetas completas visibles (N)
  [768, 16, 2],
  [999, 16, 2],
  [1000, 16, 3],
  [1024, 64, 3],
  [1280, 64, 3],
  [1440, 64, 3],
  [1499, 64, 3],
  [1500, 64, 4],
  [1920, 64, 4],
  [2560, 64, 4],
];

for (const [width, gutter, visible] of SIZES) {
  test(`a ${width}px caben ${visible} tarjetas y un trozo de la siguiente, en 16:9, con margen de ${gutter}px`, async ({ browser }) => {
    const baseURL = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
    const context = await browser.newContext({ baseURL, viewport: { width, height: Math.round(width * 0.6) }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "gma_guest", value: "1", url: baseURL }]);
    const page = await context.newPage();
    await page.goto("/inicio", { waitUntil: "load" });
    const row = page.locator("section.group\\/row", { has: page.getByRole("heading", { name: "Recién llegados" }) });
    await row.scrollIntoViewIfNeeded();
    const metrics = await row.evaluate((section) => {
      const scroller = section.querySelector("div.overflow-x-auto") as HTMLElement;
      const slots = [...scroller.children] as HTMLElement[];
      const art = slots[0]!.querySelector("a > div") as HTMLElement;
      const box = art.getBoundingClientRect();
      const slot = slots[0]!.getBoundingClientRect();
      const titleBar = section.querySelector("h2")!.parentElement!;
      return {
        artX: Math.round(box.x),
        titleX: Math.round(titleBar.getBoundingClientRect().x),
        slotW: slot.width,
        artW: box.width,
        artH: box.height,
        inset: Math.round(box.x - slot.x),
        padL: parseFloat(getComputedStyle(scroller).paddingLeft),
        clientW: scroller.clientWidth,
        fully: slots.filter((s) => s.getBoundingClientRect().right <= window.innerWidth + 1).length,
      };
    });
    // La celda reparte lo que queda tras el margen izquierdo entre N tarjetas y el trozo de la siguiente.
    const expectedSlot = (metrics.clientW - metrics.padL) / (visible + PEEK);
    expect(Math.abs(metrics.slotW - expectedSlot)).toBeLessThanOrEqual(1.5);
    expect(metrics.inset).toBe(8);
    expect(Math.abs(metrics.artW - (metrics.slotW - 16))).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.artW / metrics.artH - 16 / 9)).toBeLessThan(0.02); // siempre 16:9
    expect(metrics.artX).toBe(gutter);
    expect(metrics.titleX).toBe(gutter); // la portada y la barra del título empiezan en la misma línea
    expect(metrics.fully).toBe(visible);
    await context.close();
  });
}

test("a 1440 px y a 1920 px las celdas miden lo mismo que en Filmin (438 y 448)", async ({ browser }) => {
  const baseURL = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  for (const [width, expected] of [[1440, 438], [1920, 448]] as const) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "gma_guest", value: "1", url: baseURL }]);
    const page = await context.newPage();
    await page.goto("/inicio", { waitUntil: "load" });
    const row = page.locator("section.group\\/row", { has: page.getByRole("heading", { name: "Recién llegados" }) });
    await row.scrollIntoViewIfNeeded();
    const slotW = await row.evaluate((s) => (s.querySelector("div.overflow-x-auto")!.children[0] as HTMLElement).getBoundingClientRect().width);
    expect(Math.abs(slotW - expected), `a ${width}px: ${slotW}`).toBeLessThanOrEqual(6); // margen por el ancho de la barra de desplazamiento
    await context.close();
  }
});
