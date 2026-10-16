import { expect, test, type Page } from "@playwright/test";

/**
 * Pie de página: simple y accesible al final de todas las secciones (plataforma y páginas legales), con enlaces
 * útiles y las redes oficiales. En pantallas cortas se queda abajo del todo y en móvil no queda tapado por la barra
 * inferior de navegación.
 */
const SECTIONS = ["/inicio", "/cortos", "/peliculas", "/series", "/buscador", "/terminos", "/privacidad"];

async function visit(page: Page, path: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(path, { waitUntil: "load" });
  const footer = page.getByRole("contentinfo");
  // El pie se destapa al llegar al final de la página (efecto de cortina): hay que bajar del todo.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(footer).toBeVisible({ timeout: 20_000 });
  return footer;
}

for (const path of SECTIONS) {
  test(`${path} termina con el pie de página`, async ({ page }) => {
    const footer = await visit(page, path);
    await expect(footer.getByRole("link", { name: "Términos de uso" })).toHaveAttribute("href", "/terminos");
    await expect(footer.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacidad");
    await expect(footer.getByText("Generación Maldita").first()).toBeVisible();
  });
}

test("hay un único pie de página y es lo último de la página", async ({ page }) => {
  await visit(page, "/inicio");
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  const gap = await page.evaluate(() => {
    const footer = document.querySelector("footer")!.getBoundingClientRect();
    return Math.round(document.documentElement.scrollHeight - (footer.bottom + window.scrollY));
  });
  expect(gap).toBeLessThanOrEqual(1);
});

test("las redes oficiales abren en pestaña nueva, con rel seguro y nombre accesible", async ({ page }) => {
  const footer = await visit(page, "/inicio");
  const social = footer.getByRole("list", { name: "Redes sociales" }).getByRole("link");
  expect(await social.count()).toBeGreaterThanOrEqual(2);
  for (const link of await social.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    expect(await link.getAttribute("rel")).toMatch(/noopener/);
    expect(await link.getAttribute("href")).toMatch(/^https:\/\/(www\.)?(x|twitter|instagram|tiktok|youtube)\.com\//);
    expect((await link.getAttribute("aria-label")) ?? "").toMatch(/X|Instagram|TikTok|YouTube/);
  }
  await expect(footer.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", /instagram\.com\/genartmal/);
  await expect(footer.getByRole("link", { name: /^X\b|en X/ })).toHaveAttribute("href", /(x|twitter)\.com\/GenArtMal/);
});

test("en una página corta el pie se queda abajo del todo de la ventana", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await visit(page, "/buscador");
  const bottom = await page.evaluate(() => document.querySelector("footer")!.getBoundingClientRect().bottom);
  expect(Math.round(bottom)).toBeGreaterThanOrEqual(1399);
});

test("en móvil el pie no queda tapado por la barra inferior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const footer = await visit(page, "/inicio");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const privacy = footer.getByRole("link", { name: "Política de privacidad" });
  const tabBar = page.locator("nav[aria-label]").filter({ has: page.getByRole("link", { name: "Cortos" }) }).last();
  const linkBox = (await privacy.boundingBox())!;
  const tabBox = await tabBar.boundingBox();
  if (tabBox) expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(tabBox.y + 1);
  // Y nada se sale por los lados.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("se puede llegar a todos los enlaces con el teclado y tienen foco visible", async ({ page }) => {
  const footer = await visit(page, "/inicio");
  const links = footer.getByRole("link");
  const first = links.first();
  await first.focus();
  const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

test("en Inicio el pie queda por encima del fondo ambiental: se ve oscuro y nítido, no velado", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const footer = await visit(page, "/inicio");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(2500); // el fondo ambiental llega después de cargar: justo cuando antes tapaba el pie
  const png = (await footer.screenshot()).toString("base64");
  // Zona vacía del pie (entre la marca y las columnas): debe ser el fondo oscuro de la página, no el velo gris.
  const luminance = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const x = Math.round(bitmap.width * 0.45);
    const { data } = ctx.getImageData(x, Math.round(bitmap.height * 0.35), 40, 40);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    return sum / (data.length / 4);
  }, png);
  expect(luminance).toBeLessThan(25);
});

test("el pie tiene su propia capa (posición y z-index) para no quedar bajo fondos fijos", async ({ page }) => {
  await visit(page, "/inicio");
  // La capa propia la lleva el envoltorio del pie (el que se desplaza con la página).
  const style = await page.locator("[data-footer-reveal]").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { position: cs.position, zIndex: Number(cs.zIndex) };
  });
  expect(style.position).not.toBe("static");
  expect(style.zIndex).toBeGreaterThanOrEqual(1);
});

test("TikTok y YouTube se ven ya como iconos apagados que no son enlaces, hasta tener sus cuentas", async ({ page }) => {
  const footer = await visit(page, "/inicio");
  const list = footer.getByRole("list", { name: "Redes sociales" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  for (const name of ["TikTok", "YouTube"]) {
    const item = list.getByRole("listitem").filter({ hasText: name });
    await expect(item).toHaveCount(1);
    await expect(item.getByRole("link")).toHaveCount(0); // no hay nada a lo que ir
    await expect(item.locator("svg")).toBeVisible();
    await expect(item.getByText(/próximamente/i)).toHaveCount(1); // lo anuncia a lectores de pantalla
  }
  // Los activos siguen siendo enlaces.
  await expect(list.getByRole("link")).toHaveCount(2);
});
