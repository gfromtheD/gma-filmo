import { expect, test, type Page } from "@playwright/test";

/**
 * Pie «de cortina»: queda fijo al fondo de la ventana y el contenido de la página lo va destapando al llegar al
 * final del scroll. Solo cuando cabe en la ventana y el usuario no pidió menos movimiento; si no, es un pie normal.
 */
async function open(page: Page, path = "/cortos") {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(path, { waitUntil: "load" });
  return page.locator("[data-footer-reveal]");
}

/** ¿Hay, en ese punto de la ventana, algo del pie de página que reciba el ratón (es decir, que se vea)? */
async function footerShowsAt(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px!, py!);
    return !!el?.closest("footer");
  }, [x, y] as const);
}

test.describe("movimiento normal", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("se activa (contenedor recortado y contenido fijo) y el contenedor mide lo que el pie", async ({ page }) => {
    const wrapper = await open(page);
    await expect(wrapper).toHaveAttribute("data-footer-reveal", "on", { timeout: 15_000 });
    const info = await page.evaluate(() => {
      const w = document.querySelector("[data-footer-reveal]") as HTMLElement;
      const inner = w.firstElementChild as HTMLElement;
      return {
        clip: getComputedStyle(w).clipPath,
        position: getComputedStyle(inner).position,
        wrapperHeight: Math.round(w.getBoundingClientRect().height),
        footerHeight: Math.round(inner.getBoundingClientRect().height),
      };
    });
    expect(info.clip).not.toBe("none");
    expect(info.position).toBe("fixed");
    expect(Math.abs(info.wrapperHeight - info.footerHeight)).toBeLessThanOrEqual(1);
  });

  test("asoma primero la franja inferior y, si se sigue bajando, se completa el pie; nunca queda a medias", async ({ page }) => {
    const wrapper = await open(page);
    await expect(wrapper).toHaveAttribute("data-footer-reveal", "on", { timeout: 15_000 });
    await page.waitForTimeout(500);
    const { vh, full, peek, max } = await page.evaluate(() => {
      const zone = document.querySelector("[data-footer-reveal]") as HTMLElement;
      return {
        vh: window.innerHeight,
        full: Math.round(zone.getBoundingClientRect().height),
        peek: Number(zone.dataset.footerPeek),
        max: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    const x = 120; // sobre la parte izquierda del pie
    const settle = () => page.waitForTimeout(900); // el pie completa su fase al dejar de hacer scroll

    // Arriba del todo: nada del pie asoma.
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await footerShowsAt(page, x, vh - 20)).toBe(false);

    // Asoma menos que la franja y se deja de hacer scroll: se completa la franja (año, legal y redes), no más.
    await page.evaluate((y) => window.scrollTo(0, y), max - full + Math.round(peek / 2));
    await settle();
    expect(await footerShowsAt(page, x, vh - 20)).toBe(true);
    expect(await footerShowsAt(page, x, vh - peek - 40)).toBe(false);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Política de privacidad" })).toBeInViewport();

    // Se fuerza a media segunda fase y se deja de hacer scroll: se completa el pie entero.
    await page.evaluate((y) => window.scrollTo(0, y), max - Math.round((full - peek) / 2));
    await settle();
    expect(await footerShowsAt(page, x, vh - full + 20)).toBe(true);

    // Se sube un poco y se deja: vuelve a la franja.
    await page.evaluate((y) => window.scrollTo(0, y), max - 40);
    await settle();
    expect(await footerShowsAt(page, x, vh - peek - 40)).toBe(false);
    expect(await footerShowsAt(page, x, vh - 20)).toBe(true);
  });

  test("la franja inferior lleva el año, los enlaces legales en horizontal y las redes", async ({ page }) => {
    await open(page);
    const bar = page.getByRole("contentinfo").getByRole("navigation", { name: "Legal" });
    await expect(bar.getByRole("link")).toHaveCount(2);
    const boxes = await bar.getByRole("link").evaluateAll((links) => links.map((l) => l.getBoundingClientRect().top));
    expect(Math.abs(boxes[0]! - boxes[1]!)).toBeLessThanOrEqual(4); // en la misma línea
    await expect(page.getByRole("contentinfo").getByRole("list", { name: "Redes sociales" })).toBeAttached();
  });

  test("en una ventana más baja que el pie es un pie normal (se puede ver entero)", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 240 });
    const wrapper = await open(page);
    await expect(wrapper).toHaveAttribute("data-footer-reveal", "off", { timeout: 15_000 });
    const position = await page.evaluate(() => getComputedStyle((document.querySelector("[data-footer-reveal]") as HTMLElement).firstElementChild!).position);
    expect(position).not.toBe("fixed");
  });

  test("en móvil el contenido fijo respeta la barra inferior (el último enlace queda sobre ella)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const wrapper = await open(page, "/inicio");
    await expect(wrapper).toHaveAttribute("data-footer-reveal", "on", { timeout: 15_000 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const link = (await page.getByRole("contentinfo").getByRole("link", { name: "Política de privacidad" }).boundingBox())!;
    const tab = await page.locator("nav").filter({ has: page.getByRole("link", { name: "Cortos" }) }).last().boundingBox();
    if (tab) expect(link.y + link.height).toBeLessThanOrEqual(tab.y + 1);
  });
});

test("con movimiento reducido es un pie normal, sin efecto", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const wrapper = await open(page);
  await expect(wrapper).toHaveAttribute("data-footer-reveal", "off", { timeout: 15_000 });
  const clip = await page.evaluate(() => getComputedStyle(document.querySelector("[data-footer-reveal]")!).clipPath);
  expect(clip).toBe("none");
});
