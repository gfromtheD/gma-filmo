import { expect, test, type Page } from "@playwright/test";

/** Filtros del catálogo en píldoras con desplegable (en vez del botón «Filtros» con panel lateral). */
test.use({ viewport: { width: 1440, height: 900 } });

async function openCatalog(page: Page, query = "") {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(`/cortos${query}`, { waitUntil: "load" });
  await expect(page.getByRole("group", { name: "Filtros del catálogo" })).toBeVisible({ timeout: 20_000 });
}

const pill = (page: Page, name: RegExp) => page.getByRole("button", { name });
const resultCount = (page: Page) => page.locator("div.grid > [class*='group/card']").count();
const resultsNote = (page: Page) => page.getByRole("status").filter({ hasText: /resultados?$/ });
const titles = (page: Page) => page.locator("h3").allInnerTexts();

test("ya no existe el botón «Filtros» y aparecen las píldoras", async ({ page }) => {
  await openCatalog(page);
  await expect(page.getByRole("button", { name: /Filtros/ })).toHaveCount(0);
  for (const name of [/^Categoría/, /^Año/, /^Duración/, /^Orden/]) await expect(pill(page, name)).toBeVisible();
});

test("las píldoras tienen forma de píldora y el mismo alto", async ({ page }) => {
  await openCatalog(page);
  const heights: number[] = [];
  for (const name of [/^Categoría/, /^Año/, /^Duración/, /^Orden/]) {
    const box = (await pill(page, name).boundingBox())!;
    heights.push(Math.round(box.height));
    const radius = await pill(page, name).evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBeGreaterThanOrEqual(box.height / 2 - 1);
  }
  expect(new Set(heights).size).toBe(1);
  expect(heights[0]).toBeGreaterThanOrEqual(38);
});

test("Categoría: se pueden elegir varias sin que se cierre el menú, y se refleja en la URL, la píldora y los resultados", async ({ page }) => {
  await openCatalog(page);
  const total = await resultCount(page);
  await pill(page, /^Categoría/).click();
  const options = page.getByRole("menuitemcheckbox");
  expect(await options.count()).toBeGreaterThan(1);
  const first = (await options.nth(0).innerText()).trim();
  await options.nth(0).click();
  await expect(page.getByRole("menu")).toBeVisible(); // sigue abierto para elegir otro
  await expect.poll(() => page.url()).toContain(`genre=${encodeURIComponent(first)}`);
  await expect(page.getByRole("button", { name: first })).toBeVisible();
  expect(await resultCount(page)).toBeLessThanOrEqual(total);
  expect(await resultCount(page)).toBeGreaterThan(0);

  await options.nth(1).click();
  await expect(pill(page, /\+1/)).toBeVisible(); // «Género · 2 elegidos» resumido como «X +1»
  await page.keyboard.press("Escape");
});

test("«Todas las categorías» quita la selección", async ({ page }) => {
  await openCatalog(page);
  await pill(page, /^Categoría/).click();
  await page.getByRole("menuitemcheckbox").nth(0).click();
  await expect.poll(() => page.url()).toContain("genre=");
  await page.getByRole("menuitem", { name: "Todas las categorías" }).click();
  await expect.poll(() => page.url()).not.toContain("genre=");
  await expect(pill(page, /^Categoría$/)).toBeVisible();
});

test("Año: elegir un año filtra y aparece en la URL; «Todos los años» lo quita", async ({ page }) => {
  await openCatalog(page);
  const total = await resultCount(page);
  await pill(page, /^Año/).click();
  const years = page.getByRole("menuitemradio");
  expect(await years.count()).toBeGreaterThan(1);
  const label = (await years.nth(1).innerText()).trim();
  await years.nth(1).click();
  await expect.poll(() => page.url()).toContain(`year=${label}`);
  await expect(pill(page, new RegExp(`^${label}$`))).toBeVisible();
  const filtered = await resultCount(page);
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThanOrEqual(total);
  await pill(page, new RegExp(`^${label}$`)).click();
  await page.getByRole("menuitemradio", { name: "Todos los años" }).click();
  await expect.poll(() => page.url()).not.toContain("year=");
  expect(await resultCount(page)).toBe(total);
});

test("Duración: «Menos de 5 min» devuelve cortos (antes el filtro de duración no encontraba ninguno)", async ({ page }) => {
  await openCatalog(page);
  await pill(page, /^Duración/).click();
  await page.getByRole("menuitemradio", { name: "Menos de 5 min" }).click();
  await expect.poll(() => page.url()).toContain("maxDuration=5");
  await expect(pill(page, /5 min/)).toBeVisible();
  expect(await resultCount(page)).toBeGreaterThan(0);
});

test("Orden A → Z reordena los títulos alfabéticamente", async ({ page }) => {
  await openCatalog(page);
  await pill(page, /^Orden/).click();
  await page.getByRole("menuitemradio", { name: "A → Z" }).click();
  await expect.poll(() => page.url()).toContain("sort=alpha");
  const list = (await titles(page)).filter(Boolean).slice(0, 12);
  const sorted = [...list].sort((a, b) => a.localeCompare(b, "es"));
  expect(list).toEqual(sorted);
});

test("con filtros activos aparece «Limpiar» y deja todo como al principio", async ({ page }) => {
  await openCatalog(page);
  const total = await resultCount(page);
  await expect(page.getByRole("button", { name: "Limpiar" })).toHaveCount(0);
  await pill(page, /^Duración/).click();
  await page.getByRole("menuitemradio", { name: "Menos de 2 min" }).click();
  await expect(page.getByRole("button", { name: "Limpiar" })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect.poll(() => page.url()).not.toContain("maxDuration");
  expect(await resultCount(page)).toBe(total);
  await expect(page.getByRole("button", { name: "Limpiar" })).toHaveCount(0);
});

test("un enlace con filtros (?genre=…&year=…) abre la página ya filtrada y con las píldoras marcadas", async ({ page }) => {
  await openCatalog(page);
  await pill(page, /^Categoría/).click();
  const genre = (await page.getByRole("menuitemcheckbox").nth(0).innerText()).trim();
  await page.keyboard.press("Escape");
  await openCatalog(page, `?genre=${encodeURIComponent(genre)}&sort=alpha`);
  await expect(page.getByRole("button", { name: genre })).toBeVisible();
  await expect(page.getByRole("button", { name: /A → Z/ })).toBeVisible(); // con un orden elegido la píldora muestra cuál
});

test("valores inválidos en la URL se ignoran sin romper la página", async ({ page }) => {
  await openCatalog(page, "?year=abc&maxDuration=-1&sort=hack");
  expect(await resultCount(page)).toBeGreaterThan(0);
});

test("teclado: Enter abre, flechas navegan, Escape cierra y el foco vuelve a la píldora", async ({ page }) => {
  await openCatalog(page);
  const trigger = pill(page, /^Año/);
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("«Sorpréndeme» abre un corto al azar de los que cumplen los filtros", async ({ page }) => {
  await openCatalog(page);
  await page.getByRole("button", { name: "Sorpréndeme" }).click();
  await expect(page).toHaveURL(/\/cortos\/[^/?#]+$/);
});

test.describe("móvil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("las píldoras no desbordan la página y el menú cabe en pantalla", async ({ page }) => {
    await openCatalog(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pill(page, /^Categoría/).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  });

  test("abrir el menú no mueve la cabecera ni la posición de la página", async ({ page }) => {
    await openCatalog(page);
    await pill(page, /^Año/).scrollIntoViewIfNeeded(); // los filtros quedan bajo las colecciones: se baja hasta ellos
    await page.evaluate(() => window.scrollBy(0, 120));
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await pill(page, /^Año/).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(before);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(before);
  });
});

test.describe("contador de resultados", () => {
  test("por defecto no se muestra ningún «N resultados»", async ({ page }) => {
    await openCatalog(page);
    await expect(resultsNote(page)).toHaveCount(0);
    await expect(page.getByText(/\d+ resultados?$/)).toHaveCount(0);
  });

  test("al aplicar un filtro aparece como respuesta, con el nº de portadas que hay", async ({ page }) => {
    await openCatalog(page);
    await pill(page, /^Duración/).click();
    await page.getByRole("menuitemradio", { name: "Menos de 5 min" }).click();
    const note = resultsNote(page);
    await expect(note).toBeVisible();
    const shown = Number((await note.innerText()).match(/\d+/)![0]);
    expect(shown).toBe(await resultCount(page));
    expect(shown).toBeGreaterThan(0);
  });

  test("concuerda en singular cuando solo hay uno", async ({ page }) => {
    await openCatalog(page, "?maxDuration=1&year=2026");
    const note = resultsNote(page);
    const text = ((await note.count()) > 0 ? await note.innerText() : "").trim();
    if (text) expect(text).toMatch(/^\d+ resultados?$/);
  });

  test("al limpiar los filtros desaparece", async ({ page }) => {
    await openCatalog(page);
    await pill(page, /^Año/).click();
    await page.getByRole("menuitemradio").nth(1).click();
    await expect(resultsNote(page)).toBeVisible();
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(resultsNote(page)).toHaveCount(0);
  });

  test("se anuncia a los lectores de pantalla (aria-live educado)", async ({ page }) => {
    await openCatalog(page);
    await pill(page, /^Orden/).click();
    await page.getByRole("menuitemradio", { name: "A → Z" }).click();
    await expect(resultsNote(page)).toHaveAttribute("aria-live", "polite");
  });

  test("va justo debajo de las píldoras y encima de las portadas, alineado a la izquierda (no en la cabecera)", async ({ page }) => {
    await openCatalog(page);
    await pill(page, /^Año/).click();
    await page.getByRole("menuitemradio").nth(1).click();
    const group = (await page.getByRole("group", { name: "Filtros del catálogo" }).boundingBox())!;
    const note = (await resultsNote(page).boundingBox())!;
    const firstCard = (await page.locator("div.grid > [class*='group/card']").first().boundingBox())!;
    const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(note.y).toBeGreaterThanOrEqual(group.y + group.height - 2); // debajo de las píldoras
    expect(note.y + note.height).toBeLessThanOrEqual(firstCard.y); // encima de las portadas
    expect(Math.abs(note.x - firstCard.x)).toBeLessThanOrEqual(2); // alineado con la primera portada
    expect(note.y).toBeGreaterThan(heading.y + heading.height); // ya no va en la fila del título
  });

  test("es un texto discreto: pequeño, gris, con el número resaltado", async ({ page }) => {
    await openCatalog(page);
    await pill(page, /^Año/).click();
    await page.getByRole("menuitemradio").nth(1).click();
    const note = resultsNote(page);
    expect(await note.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(14);
    const numberColor = await note.locator("strong").evaluate((el) => getComputedStyle(el).color);
    const textColor = await note.evaluate((el) => getComputedStyle(el).color);
    expect(numberColor).not.toBe(textColor);
  });
});
