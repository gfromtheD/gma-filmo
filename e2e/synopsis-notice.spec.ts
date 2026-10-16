import { expect, test } from "@playwright/test";

/** Aviso de «sinopsis generada con IA» y la opción de que el usuario proponga una mejor. */
test.use({ viewport: { width: 1280, height: 900 } });

const FICHA = "/cortos/el-cine-cobra-vida";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(FICHA, { waitUntil: "load" });
});

test("muestra el aviso de IA en letra pequeña con una palabra clicable", async ({ page }) => {
  await expect(page.getByText("Sinopsis generada con IA")).toBeVisible();
  await expect(page.getByRole("button", { name: "Propón una mejor" })).toBeVisible();
});

test("el botón abre el formulario y «Cancelar» lo cierra", async ({ page }) => {
  const toggle = page.getByRole("button", { name: "Propón una mejor" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const box = page.getByRole("textbox", { name: "Tu propuesta de sinopsis" });
  await expect(box).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar propuesta" })).toBeDisabled();
  await box.fill("Una sinopsis mejor");
  await expect(page.getByRole("button", { name: "Enviar propuesta" })).toBeEnabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(box).toHaveCount(0);
});

test("es letra pequeña y discreta, sin caja ni botón con borde", async ({ page }) => {
  const note = page.getByText("Sinopsis generada con IA");
  const box = (await note.boundingBox())!;
  expect(box.height).toBeLessThan(24);
  const size = await note.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeLessThanOrEqual(12);
  const link = page.getByRole("button", { name: "Propón una mejor" });
  expect(await link.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
  expect(await link.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
});
