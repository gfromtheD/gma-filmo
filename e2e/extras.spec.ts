import { expect, test, type Page } from "@playwright/test";

/**
 * Pestaña «Extras» de la ficha. La API se intercepta: no se lee ni se escribe nada real
 * (así funciona aunque la tabla `pelicula_extras` aún no exista en la base de datos).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const EXTRAS = [
  { id: 1, title: "Así se hizo", description: "El proceso de animación.", kind: "making_of", kindLabel: "Making of", videoUrl: "https://example.test/making.mp4", posterUrl: null, durationLabel: "2:05" },
  { id: 2, title: "Charla con el director", description: null, kind: "entrevista", kindLabel: "Entrevista", videoUrl: "https://example.test/charla.mp4", posterUrl: null, durationLabel: "10:30" },
  { id: 3, title: "Otra entrevista", description: null, kind: "entrevista", kindLabel: "Entrevista", videoUrl: "https://example.test/otra.mp4", posterUrl: null, durationLabel: null },
];

async function mockExtras(page: Page, extras: unknown[]) {
  await page.route("**/api/extras?**", (route) => route.fulfill({ json: { extras } }));
}

async function openFicha(page: Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
  );
  await page.goto(href as string, { waitUntil: "load" });
}

test("con extras aparece la pestaña, filtra por tipo y abre el reproductor", async ({ page }) => {
  await mockExtras(page, EXTRAS);
  await openFicha(page);

  const tab = page.getByRole("tab", { name: "Extras" });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page).toHaveURL(/#extras$/);
  await expect(page.getByRole("button", { name: "Ver Así se hizo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver Charla con el director" })).toBeVisible();

  const filters = page.getByRole("list", { name: "Filtrar extras por tipo" });
  await filters.getByRole("button", { name: /Entrevista/ }).click();
  await expect(page.getByRole("button", { name: "Ver Así se hizo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver Charla con el director" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver Otra entrevista" })).toBeVisible();
  await filters.getByRole("button", { name: /Todos/ }).click();
  await expect(page.getByRole("button", { name: "Ver Así se hizo" })).toBeVisible();

  await page.getByRole("button", { name: "Ver Así se hizo" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("video")).toHaveAttribute("src", "https://example.test/making.mp4");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("la cabecera sigue fija mientras se ve y se cierra un extra", async ({ page }) => {
  await mockExtras(page, EXTRAS);
  await openFicha(page);
  await page.getByRole("tab", { name: "Extras" }).click();
  await page.getByRole("button", { name: "Ver Así se hizo" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(overflow).not.toBe("hidden");
});

test("sin extras no hay pestaña", async ({ page }) => {
  await mockExtras(page, []);
  await openFicha(page);
  await expect(page.getByRole("tab", { name: "Detalles" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Extras" })).toHaveCount(0);
});

test("si la API falla, la ficha funciona igual sin la pestaña", async ({ page }) => {
  await page.route("**/api/extras?**", (route) => route.fulfill({ status: 500, json: { extras: [] } }));
  await openFicha(page);
  await expect(page.getByRole("tab", { name: "Detalles" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Extras" })).toHaveCount(0);
});
