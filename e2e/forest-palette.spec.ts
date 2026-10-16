import { expect, test, type Page } from "@playwright/test";

/** La paleta negra, tal como se pinta: fondo, pie, tarjetas y paneles salen del tema. */
test.use({ viewport: { width: 1280, height: 900 } });

async function open(page: Page, path: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(800);
}

test("las variables del tema llegan al navegador con sus valores", async ({ page }) => {
  await open(page, "/cortos");
  const vars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(["bg", "surface-2", "panel", "surface", "border", "line-strong"].map((n) => [n, cs.getPropertyValue(`--gma-${n}`).trim().toUpperCase()]));
  });
  expect(vars).toEqual({
    "bg": "#070709", "surface-2": "#0E0E11", panel: "#141417", surface: "#1C1C21", border: "#26262B", "line-strong": "#33333A",
  });
});

test("el fondo de la página es el negro del tema y el pie lo mantiene casi opaco", async ({ page }) => {
  await open(page, "/cortos");
  const colors = await page.evaluate(() => {
    const footer = document.querySelector("footer") as HTMLElement;
    return { body: getComputedStyle(document.body).backgroundColor, footer: getComputedStyle(footer.parentElement!).backgroundColor };
  });
  expect(colors.body).toBe("rgb(7, 7, 9)");
  // El pie va casi opaco (oscuro) para que su texto se lea sobre cualquier mancha de la aurora.
  expect(colors.footer).toMatch(/(rgba\(7, 7, 9, 0\.(8|9)\d*\)|\/ 0\.(8|9)\d*\))$/); // Chrome puede devolverlo en oklab
});

test("todo fondo oscuro sólido es uno de los colores del tema (no quedan grises sueltos)", async ({ page }) => {
  for (const path of ["/inicio", "/cortos", "/cortos/yasha-gozen", "/buscador", "/terminos"]) {
    await open(page, path);
    const offenders = await page.evaluate(() => {
      const found = new Map<string, string>();
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const m = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (!m) continue;
        const [r, g, b, a] = [+m[1]!, +m[2]!, +m[3]!, m[4] === undefined ? 1 : +m[4]];
        if (a < 0.9) continue; // transparencias (velos de vídeo, sombras): no son un fondo sólido
        const allowed = ["7,7,9", "14,14,17", "20,20,23", "28,28,33", "38,38,43", "51,51,58"];
        const isDark = Math.max(r, g, b) <= 0x48 && !(g > b + 12); // los verdes de marca no cuentan
        if (isDark && !allowed.includes(`${r},${g},${b}`) && !(r === 0 && g === 0 && b === 0)) found.set(`rgb(${r}, ${g}, ${b})`, `${el.tagName}.${String(el.className).slice(0, 50)}`);
      }
      return [...found.entries()].slice(0, 6);
    });
    expect(offenders, `en ${path}`).toEqual([]);
  }
});
