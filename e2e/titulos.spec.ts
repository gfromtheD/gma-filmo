import { expect, test } from "@playwright/test";

/** Título de la pestaña: lo específico primero, la marca una sola vez y al final ("Página · GMA Filmo"). */
const BRAND = "GMA Filmo";

const PAGES: ReadonlyArray<readonly [string, string]> = [
  ["/inicio", "Inicio · GMA Filmo"],
  ["/cortos", "Cortometrajes · GMA Filmo"],
  ["/buscador", "Buscador · GMA Filmo"],
  ["/terminos", "Condiciones de uso · GMA Filmo"],
  ["/privacidad", "Política de privacidad · GMA Filmo"],
];

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
  ]);
});

for (const [path, expected] of PAGES) {
  test(`${path}: «${expected}»`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(expected);
  });
}

test("una ficha usa el título de la obra y la marca una sola vez", async ({ page }) => {
  await page.goto("/inicio", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
  );
  await page.goto(href as string, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  expect(title.endsWith(` · ${BRAND}`)).toBe(true);
  expect(title.split(BRAND).length - 1).toBe(1);
  expect(title.length).toBeLessThanOrEqual(70);
});
