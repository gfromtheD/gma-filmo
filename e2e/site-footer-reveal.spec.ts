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

  test("arriba del todo no se ve; al llegar al final se va destapando de abajo arriba", async ({ page }) => {
    const wrapper = await open(page);
    await expect(wrapper).toHaveAttribute("data-footer-reveal", "on", { timeout: 15_000 });
    await page.waitForTimeout(500);
    const { vh, h } = await page.evaluate(() => ({
      vh: window.innerHeight,
      h: Math.round((document.querySelector("[data-footer-reveal]") as HTMLElement).getBoundingClientRect().height),
    }));
    const x = 120; // sobre la marca / texto de la izquierda del pie

    // Arriba del todo: nada del pie asoma.
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await footerShowsAt(page, x, vh - 20)).toBe(false);

    // Destapado a medias (150 px): se ve su parte baja, pero aún no la alta.
    await page.evaluate((offset) => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight - offset), 150);
    await page.waitForTimeout(150);
    expect(await footerShowsAt(page, x, vh - 20)).toBe(true);
    expect(await footerShowsAt(page, x, vh - h + 20)).toBe(false);

    // Al final del todo: entero.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    expect(await footerShowsAt(page, x, vh - h + 20)).toBe(true);
    expect(await footerShowsAt(page, x, vh - 20)).toBe(true);
  });

  test("en una ventana más baja que el pie es un pie normal (se puede ver entero)", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 300 });
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
