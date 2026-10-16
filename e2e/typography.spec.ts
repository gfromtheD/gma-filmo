import { expect, test, type Page } from "@playwright/test";

/**
 * Lo que se pinta de verdad: en todas las páginas, todo texto visible usa Satoshi (primera familia de su pila), y la
 * fuente cargada es la variable de 300 a 900 con su cursiva.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const PAGES = ["/inicio", "/cortos", "/peliculas", "/buscador", "/terminos", "/privacidad", "/cortos/yasha-gozen"];

async function open(page: Page, path: string) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

for (const path of PAGES) {
  test(`${path}: todo el texto visible usa Satoshi`, async ({ page }) => {
    await open(page, path);
    const result = await page.evaluate(() => {
      const first = (family: string) => family.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
      const expected = first(getComputedStyle(document.body).fontFamily);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const others = new Map<string, string>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        const el = node.parentElement;
        if (!text || !el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const family = first(cs.fontFamily);
        if (family !== expected) others.set(`${el.tagName}.${String(el.className).slice(0, 40)} «${text.slice(0, 20)}»`, family);
      }
      return { expected, others: [...others.entries()].slice(0, 10) };
    });
    expect(result.expected.length).toBeGreaterThan(0);
    expect(result.others, `familia esperada: ${result.expected}`).toEqual([]);
  });
}

test("la fuente cargada es Satoshi variable (300–900) y existe su cursiva", async ({ page }) => {
  await open(page, "/inicio");
  const faces = await page.evaluate(() =>
    [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, style: f.style, status: f.status })),
  );
  const bodyFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily.split(",")[0]!.trim().replace(/^["']|["']$/g, ""));
  const mine = faces.filter((f) => f.family.replace(/^["']|["']$/g, "") === bodyFamily);
  expect(mine.length).toBeGreaterThanOrEqual(2); // normal y cursiva
  expect(mine.some((f) => f.style === "normal" && f.weight === "300 900" && f.status === "loaded")).toBe(true);
  expect(mine.some((f) => f.style === "italic" && f.weight === "300 900")).toBe(true);
  // No hay ninguna otra familia cargada (ni Manrope ni serif).
  const others = faces.filter((f) => f.family.replace(/^["']|["']$/g, "") !== bodyFamily && f.status === "loaded");
  expect(others.map((f) => f.family)).toEqual([]);
});

test("el servidor entrega los archivos de la fuente (woff2)", async ({ page }) => {
  const fontResponses: string[] = [];
  page.on("response", (r) => { if (/\.woff2(\?|$)/.test(r.url())) fontResponses.push(`${r.status()} ${r.url()}`); });
  await open(page, "/inicio");
  expect(fontResponses.length).toBeGreaterThan(0);
  expect(fontResponses.every((r) => r.startsWith("200"))).toBe(true);
});
