import { expect, test, type Page } from "@playwright/test";

/**
 * Aviso «Inicia sesión para comentar» (visitantes), en Valoraciones y en Comentarios: ya no es un campo de texto
 * desactivado sino una invitación clara, con un botón verde que lleva a iniciar sesión.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function openTab(page: Page, tab: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/cortos/yasha-gozen", { waitUntil: "load" });
  await page.getByRole("tab", { name: tab }).click();
  await page.waitForTimeout(1200);
  return page.getByRole("tabpanel");
}

for (const tab of ["Valoraciones", "Comentarios"]) {
  test(`${tab}: el aviso tiene mensaje, explicación y un botón verde «Iniciar sesión»`, async ({ page }) => {
    const panel = await openTab(page, tab);
    await expect(panel.getByText("Inicia sesión para comentar")).toBeVisible();
    const button = panel.getByRole("link", { name: "Iniciar sesión" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", "/?login=1");
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(34, 177, 107)");
    // El mensaje se lee como un título, no como el texto gris de un campo desactivado.
    const message = panel.getByText("Inicia sesión para comentar");
    expect(await message.evaluate((el) => parseFloat(getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
    expect(await message.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  });
}

test("el botón lleva a iniciar sesión", async ({ page }) => {
  const panel = await openTab(page, "Comentarios");
  await panel.getByRole("link", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/\?login=1/);
});

test("en móvil el mensaje y el botón se apilan y el botón ocupa un objetivo táctil cómodo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openTab(page, "Comentarios");
  const button = panel.getByRole("link", { name: "Iniciar sesión" });
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("el aviso no lleva icono: solo el mensaje, la explicación y el botón", async ({ page }) => {
  for (const tab of ["Valoraciones", "Comentarios"]) {
    const panel = await openTab(page, tab);
    const card = panel.getByText("Inicia sesión para comentar").locator("xpath=ancestor::div[contains(@class,'rounded-[12px]')][1]");
    await expect(card).toBeVisible();
    expect(await card.locator("svg").count(), `icono en ${tab}`).toBe(0);
    await expect(card.getByText("Valora y comenta con tu perfil.")).toBeVisible();
    await expect(card.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  }
});
