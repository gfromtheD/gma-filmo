import { expect, test, type Page } from "@playwright/test";

/**
 * Fondo de toda la web: sobre un negro casi neutro, manchas de color muy difuminadas (dos verdes, un violeta y un
 * teal) que derivan despacio detrás del contenido. Es el fondo «líquido» del buscador, ahora en todas las páginas, y
 * barato de pintar: degradados radiales, sin filtros de desenfoque.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// Inicio y las fichas quedan fuera a propósito: ahí el color de fondo lo da la portada (hero / cada título).
const PAGES = ["/cortos", "/peliculas", "/buscador", "/terminos"];

async function open(page: Page, path: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(600);
}

for (const path of PAGES) {
  test(`${path}: hay un único fondo de aurora, fijo, detrás del contenido y sin capturar el ratón`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, path);
    await expect(page.locator("[data-site-aurora]")).toHaveCount(1);
    const info = await page.evaluate(() => {
      const el = document.querySelector("[data-site-aurora]") as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        position: cs.position,
        zIndex: cs.zIndex,
        pointerEvents: cs.pointerEvents,
        ariaHidden: el.getAttribute("aria-hidden"),
        blobs: el.querySelectorAll("[data-aurora-blob]").length,
        box: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)],
        viewport: [innerWidth, innerHeight],
      };
    });
    expect(info.position).toBe("fixed");
    expect(info.zIndex).toBe("-1");
    expect(info.pointerEvents).toBe("none");
    expect(info.ariaHidden).toBe("true");
    expect(info.blobs).toBe(4);
    expect(info.box).toEqual(info.viewport);
  });
}

test("en Inicio no hay aurora: el fondo lo pone el color de la portada, sin mezclarse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "/inicio");
  await expect(page.locator("[data-site-aurora]")).toHaveCount(0);
  await expect(page.locator("[data-aurora-blob]")).toHaveCount(0);
  // El brillo ambiental de la portada sí está, opaco sobre el negro de la página (nada de fondo detrás).
  const ambient = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div[aria-hidden='true']")].find((d) => getComputedStyle(d).position === "fixed" && getComputedStyle(d).contain === "strict");
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  expect(ambient).toBe("rgb(7, 7, 9)");
});

test("al navegar de Inicio a otra página la aurora aparece, y al volver desaparece", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "/inicio");
  await expect(page.locator("[data-site-aurora]")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Cortos" }).click();
  await expect(page).toHaveURL(/\/cortos/);
  await expect(page.locator("[data-site-aurora]")).toHaveCount(1);
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.locator("[data-site-aurora]")).toHaveCount(0);
});

test("las manchas son dos verdes, un violeta y un teal, hechas con degradados (sin filtro de desenfoque)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "/cortos");
  const blobs = await page.evaluate(() =>
    [...document.querySelectorAll("[data-aurora-blob]")].map((el) => {
      const cs = getComputedStyle(el);
      return { image: cs.backgroundImage, filter: cs.filter, animation: cs.animationName };
    }),
  );
  const colors = blobs.map((b) => (b.image.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/) ?? []).slice(1, 4).join(","));
  expect(colors.filter((c) => c === "34,177,107").length).toBe(2); // verdes
  expect(colors).toContain("91,63,209"); // violeta
  expect(colors).toContain("19,140,150"); // teal
  for (const b of blobs) {
    expect(b.image).toMatch(/radial-gradient/);
    expect(b.filter).toBe("none");
    expect(b.animation).not.toBe("none");
  }
});

test("con movimiento reducido el fondo queda quieto", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/cortos");
  const animations = await page.evaluate(() => [...document.querySelectorAll("[data-aurora-blob]")].map((el) => getComputedStyle(el).animationName));
  expect(animations.every((a) => a === "none")).toBe(true);
});

test("el negro de base es casi neutro y el contenido queda por encima de las manchas", async ({ page }) => {
  await open(page, "/cortos");
  const info = await page.evaluate(() => {
    const body = getComputedStyle(document.body).backgroundColor;
    const title = document.querySelector("main h1, main h2") as HTMLElement;
    const aurora = document.querySelector("[data-site-aurora]") as HTMLElement;
    // Orden de pintado: lo posterior en el árbol y con z-index mayor queda encima.
    return { body, auroraZ: Number(getComputedStyle(aurora).zIndex), titleVisible: !!title && title.getBoundingClientRect().height > 0 };
  });
  expect(info.body).toBe("rgb(7, 7, 9)");
  expect(info.auroraZ).toBeLessThan(0);
  expect(info.titleVisible).toBe(true);
});

test("el buscador ya no lleva su propia aurora duplicada", async ({ page }) => {
  await open(page, "/buscador");
  expect(await page.locator("[data-aurora-blob]").count()).toBe(4);
  expect(await page.locator(".aurora-blob").count()).toBe(0);
});
