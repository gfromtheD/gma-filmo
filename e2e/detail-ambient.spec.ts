import { expect, test, type Page } from "@playwright/test";

/**
 * Cada corto o película tiene su propio fondo: el brillo de color de su portada, como en Inicio con el hero. Por eso
 * en las fichas no hay aurora (se mezclaría), y la imagen de cabecera se funde con ese brillo en vez de acabar en un
 * escalón de color sólido.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function open(page: Page, path: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(1200);
}

/** El brillo de la portada: capa fija a pantalla completa con la imagen muy desenfocada. */
const ambientInfo = (page: Page) =>
  page.evaluate(() => {
    const layer = [...document.querySelectorAll<HTMLElement>("div[aria-hidden='true']")].find(
      (d) => getComputedStyle(d).position === "fixed" && getComputedStyle(d).contain === "strict" && !d.hasAttribute("data-site-aurora"),
    );
    if (!layer) return null;
    const img = layer.querySelector("img");
    return { src: img?.getAttribute("src") ?? null, bg: getComputedStyle(layer).backgroundColor, z: getComputedStyle(layer).zIndex };
  });

test("la ficha de un corto tiene el brillo de su portada y no la aurora", async ({ page }) => {
  await open(page, "/cortos/yasha-gozen");
  await expect(page.locator("[data-site-aurora]")).toHaveCount(0);
  const ambient = await ambientInfo(page);
  expect(ambient).not.toBeNull();
  expect(ambient!.bg).toBe("rgb(7, 7, 9)");
  expect(ambient!.src, "debería usar la portada del propio corto").toMatch(/\S/);
});

test("cada título tiene un fondo propio: dos fichas distintas no comparten el brillo", async ({ page }) => {
  await open(page, "/cortos/yasha-gozen");
  const first = await ambientInfo(page);
  await open(page, "/cortos/la-pelicula");
  const second = await ambientInfo(page);
  expect(first?.src).toBeTruthy();
  expect(second?.src).toBeTruthy();
  expect(second!.src).not.toBe(first!.src);
});

test("el contenido de la ficha queda por encima del brillo y sigue siendo legible", async ({ page }) => {
  await open(page, "/cortos/yasha-gozen");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Similares" })).toBeVisible();
  // Orden de capas: brillo (0) < contenido de la ficha (2) y el pie (1) por encima del brillo.
  const z = await page.evaluate(() => {
    const h1 = document.querySelector("h1")!;
    let node: HTMLElement | null = h1;
    let content = 0;
    while (node && node !== document.body) {
      const zi = parseInt(getComputedStyle(node).zIndex, 10);
      if (!Number.isNaN(zi) && getComputedStyle(node).position !== "static" && zi >= 1) { content = Math.max(content, zi); }
      node = node.parentElement;
    }
    const footer = document.querySelector("[data-footer-reveal]") as HTMLElement;
    return { content, footer: parseInt(getComputedStyle(footer).zIndex, 10) };
  });
  expect(z.content).toBeGreaterThanOrEqual(2);
  expect(z.footer).toBeGreaterThanOrEqual(1);
  expect(z.footer).toBeLessThanOrEqual(z.content);
});

test("la imagen de cabecera se funde hacia abajo (máscara), no acaba en un escalón de color", async ({ page }) => {
  await open(page, "/cortos/yasha-gozen");
  const mask = await page.evaluate(() => {
    const section = document.querySelector("h1")!.closest("section")!;
    const imageBox = section.querySelector("div.relative.overflow-hidden, div.overflow-hidden") as HTMLElement;
    const cs = getComputedStyle(imageBox);
    return { mask: cs.maskImage || cs.webkitMaskImage };
  });
  expect(mask.mask).toMatch(/linear-gradient/);
  expect(mask.mask).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
});

test("las colecciones (no son una ficha) siguen con la aurora", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/cortos", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/coleccion/"]').first().getAttribute("href");
  await page.goto(href!, { waitUntil: "load" });
  await expect(page.locator("[data-site-aurora]")).toHaveCount(1);
});

test("al entrar en una ficha desde el catálogo la aurora desaparece y aparece el brillo de la portada", async ({ page }) => {
  await open(page, "/cortos");
  await expect(page.locator("[data-site-aurora]")).toHaveCount(1);
  await page.locator('a[href^="/cortos/"]:not([href*="coleccion"])').filter({ hasNot: page.locator("[data-nope]") }).evaluateAll((links) => {
    const target = links.find((a) => /^\/cortos\/[^/]+$/.test(a.getAttribute("href") ?? "")) as HTMLElement | undefined;
    target?.click();
  });
  await expect(page).toHaveURL(/\/cortos\/[^/]+$/);
  await expect(page.locator("[data-site-aurora]")).toHaveCount(0);
  expect(await ambientInfo(page)).not.toBeNull();
});

test.describe("la cabecera de la web en la ficha es como en Inicio: no existe hasta que se hace scroll", () => {
  for (const [label, size] of [["escritorio", { width: 1280, height: 900 }], ["móvil", { width: 390, height: 844 }]] as const) {
    test(`${label}: la imagen de la ficha sube por detrás de la cabecera (sin franja distinta arriba)`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, "/cortos/yasha-gozen");
      const info = await page.evaluate(() => {
        const header = document.querySelector("header")!.getBoundingClientRect();
        const section = document.querySelector("h1")!.closest("section")!.getBoundingClientRect();
        return { headerBottom: Math.round(header.bottom), sectionTop: Math.round(section.top) };
      });
      // El hero empieza en lo alto de la página, bajo la cabecera transparente (como el de Inicio).
      expect(info.sectionTop).toBeLessThanOrEqual(0);
      expect(info.headerBottom).toBeGreaterThan(40);
    });

    test(`${label}: hay un degradado oscuro bajo la cabecera para que los menús se lean sobre cualquier imagen`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, "/cortos/yasha-gozen");
      const scrim = await page.evaluate(() => {
        const section = document.querySelector("h1")!.closest("section")!;
        const el = section.querySelector("[data-header-scrim]") as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height), image: getComputedStyle(el).backgroundImage };
      });
      expect(scrim).not.toBeNull();
      expect(scrim!.top).toBeLessThanOrEqual(0);
      expect(scrim!.height).toBeGreaterThanOrEqual(80);
      expect(scrim!.image).toMatch(/linear-gradient/);
    });

    test(`${label}: el contenido de la cabecera de la ficha no queda tapado por la barra`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, "/cortos/yasha-gozen");
      const h1Top = await page.evaluate(() => Math.round(document.querySelector("h1")!.getBoundingClientRect().top));
      const headerBottom = await page.evaluate(() => Math.round(document.querySelector("header")!.getBoundingClientRect().bottom));
      expect(h1Top).toBeGreaterThanOrEqual(headerBottom);
    });
  }
});

test("las tarjetas de Detalles son cristal oscuro: toman un poco del color de cada portada, sin gris sólido", async ({ page }) => {
  await open(page, "/cortos/yasha-gozen");
  const cards = page.locator("[data-detail-card]");
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  const info = await cards.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    // Chrome devuelve la transparencia como rgba(r, g, b, a) o como «oklab(l a b / alfa)»: se lee el último número tras « / » o la 4.ª componente.
    const slash = cs.backgroundColor.match(/\/\s*([\d.]+)\s*\)/);
    const rgba = cs.backgroundColor.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/);
    const alpha = slash ? Number(slash[1]) : rgba ? Number(rgba[1]) : 1;
    return { background: cs.backgroundColor, alpha, blur: cs.backdropFilter, border: cs.borderTopWidth, borderColor: cs.borderTopColor };
  });
  // Semitransparente (deja pasar el brillo de la portada), no un gris sólido.
  expect(info.alpha, info.background).toBeGreaterThan(0.15);
  expect(info.alpha, info.background).toBeLessThan(0.7);
  expect(info.blur).toMatch(/blur/);
  expect(info.border).toBe("1px");
});

test("el tono de las tarjetas cambia con la portada (dos títulos, dos fondos detrás)", async ({ page }) => {
  const sample = async (path: string) => {
    await open(page, path);
    return page.evaluate(() => {
      const card = document.querySelector("[data-detail-card]") as HTMLElement;
      const r = card.getBoundingClientRect();
      // El color que se ve «detrás»: el del brillo de la portada en ese punto (la capa fija a pantalla completa).
      const layer = [...document.querySelectorAll<HTMLElement>("div[aria-hidden='true']")].find((d) => getComputedStyle(d).position === "fixed" && getComputedStyle(d).contain === "strict" && !d.hasAttribute("data-site-aurora"));
      const img = layer?.querySelector("img");
      return { src: img?.getAttribute("src") ?? null, top: Math.round(r.top) };
    });
  };
  const a = await sample("/cortos/yasha-gozen");
  const b = await sample("/cortos/la-pelicula");
  expect(a.src).toBeTruthy();
  expect(b.src).toBeTruthy();
  expect(a.src).not.toBe(b.src);
});

for (const tab of ["Valoraciones", "Comentarios"]) {
  test(`la pestaña ${tab} no tiene superficies de gris sólido: son cristal oscuro como Detalles`, async ({ page }) => {
    await open(page, "/cortos/yasha-gozen");
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(2500);
    const solid = await page.evaluate(() => {
      const panel = document.querySelector("[role='tabpanel']")!;
      const found = new Map<string, string>();
      for (const el of panel.querySelectorAll<HTMLElement>("*")) {
        const cs = getComputedStyle(el);
        const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const parts = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
        const [r, g, b] = parts;
        const a = parts.length > 3 ? parts[3]! : 1;
        if (a < 0.8) continue; // transparencias: cristal, skeletons, resaltados
        const isDarkGray = Math.max(r!, g!, b!) <= 0x48 && !(g! > b! + 12); // los verdes de marca no cuentan
        if (isDarkGray && el.getBoundingClientRect().width > 40 && el.getBoundingClientRect().height > 20)
          found.set(`rgb(${r}, ${g}, ${b})`, `${el.tagName}.${String(el.className).slice(0, 60)}`);
      }
      return [...found.entries()];
    });
    expect(solid, `superficies sólidas en ${tab}`).toEqual([]);
  });
}
