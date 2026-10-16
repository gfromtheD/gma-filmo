import { expect, test, type Page } from "@playwright/test";

/**
 * Transición entre portadas del hero: la portada vieja se queda al 100 % debajo mientras la nueva se funde por
 * encima (sin parpadeo de fondo), y el texto va en dos tiempos: el viejo se va rápido y el nuevo entra después, de
 * modo que nunca se ven dos títulos a la vez en el mismo sitio.
 */
test.use({ viewport: { width: 1440, height: 900 } });

type Frame = { t: number; h1: { text: string; o: number }[]; imgs: number[] };

async function openHome(page: Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  await expect(page.getByRole("group", { name: "Diapositivas destacadas" })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
}

/** Anota, fotograma a fotograma, cómo se ven los títulos y las imágenes del hero mientras cambia de portada. */
async function recordTransition(page: Page, trigger: () => Promise<void>, ms = 2200): Promise<Frame[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __hero: Frame[]; __stop: boolean };
    w.__hero = [];
    w.__stop = false;
    const eff = (el: Element | null) => {
      let o = 1;
      for (let n = el; n && n !== document.body; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
      return o;
    };
    const t0 = performance.now();
    const tick = () => {
      const sections = [...document.querySelectorAll("section[aria-label='Destacados']")];
      const h1 = [...document.querySelectorAll("section[aria-label='Destacados'] h1")].map((h) => ({
        text: h.textContent?.trim() ?? "",
        o: eff(h),
      }));
      const imgs = sections.map((s) => eff(s.querySelector(".absolute.inset-x-0.top-0.z-0")));
      w.__hero.push({ t: Math.round(performance.now() - t0), h1, imgs });
      if (!w.__stop) requestAnimationFrame(tick);
    };
    tick();
  });
  await trigger();
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const w = window as unknown as { __hero: Frame[]; __stop: boolean };
    w.__stop = true;
    return w.__hero;
  });
}

const goToSlide = (page: Page, n: number) => () => page.getByRole("button", { name: new RegExp(`diapositiva ${n} de`) }).click();

test.describe("movimiento normal", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "no-preference" }); });

  test("nunca hay dos títulos visibles a la vez", async ({ page }) => {
    await openHome(page);
    const frames = await recordTransition(page, goToSlide(page, 2));
    const overlap = frames.filter((f) => f.h1.filter((h) => h.o > 0.15).length > 1);
    expect(overlap, `fotogramas con solape: ${JSON.stringify(overlap.slice(0, 2))}`).toEqual([]);
    // Hubo transición de verdad: en algún momento coexistieron dos portadas.
    expect(frames.some((f) => f.imgs.length > 1)).toBe(true);
  });

  test("el título nuevo no aparece de golpe: nace transparente, y el viejo se va en unos 300 ms", async ({ page }) => {
    await openHome(page);
    const frames = await recordTransition(page, goToSlide(page, 2));
    const firstWithTwo = frames.find((f) => f.h1.length > 1)!;
    expect(firstWithTwo, "debería haber dos títulos durante la transición").toBeTruthy();
    expect(firstWithTwo.h1[0]!.text).not.toBe(firstWithTwo.h1[1]!.text);
    // El nuevo (el que casi no se ve) nace transparente.
    expect(firstWithTwo.h1.some((h) => h.o < 0.1), JSON.stringify(firstWithTwo.h1)).toBe(true);

    const oldTitle = firstWithTwo.h1.find((h) => h.o >= 0.1) ?? firstWithTwo.h1[0]!;
    const startT = firstWithTwo.t;
    const oldGone = frames.find((f) => f.t > startT && !f.h1.some((h) => h.text === oldTitle.text && h.o > 0.05));
    expect(oldGone, "el título viejo debería haberse ido").toBeTruthy();
    expect(oldGone!.t - startT).toBeLessThanOrEqual(450);
    // Y el nuevo acaba totalmente visible.
    expect(frames.at(-1)!.h1.some((h) => h.o > 0.98)).toBe(true);
  });

  test("la imagen no parpadea: la portada de debajo se mantiene opaca mientras la nueva se funde", async ({ page }) => {
    await openHome(page);
    const frames = await recordTransition(page, goToSlide(page, 2));
    expect(frames.filter((f) => f.imgs.length > 1).length).toBeGreaterThan(5);
    // En CADA fotograma (con una o dos portadas) la imagen cubre por completo: nunca se transparenta el fondo oscuro ni
    // hay un fotograma en blanco justo al empezar el fundido (eso es lo que se ve como un golpe o un «glitch»).
    for (const f of frames) {
      const coverage = 1 - f.imgs.reduce((acc, o) => acc * (1 - o), 1);
      expect(coverage, `t=${f.t} imgs=${f.imgs}`).toBeGreaterThanOrEqual(0.98);
    }
  });

  test("al terminar solo queda una portada y un título", async ({ page }) => {
    await openHome(page);
    const frames = await recordTransition(page, goToSlide(page, 2), 2500);
    const last = frames.at(-1)!;
    expect(last.imgs.length).toBe(1);
    expect(last.h1.length).toBe(1);
  });
});

test("en escritorio el texto va alineado a la izquierda (también los títulos de varias líneas), en todas las portadas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  const dots = page.getByRole("group", { name: "Diapositivas destacadas" }).getByRole("button");
  const count = await dots.count();
  for (let i = 0; i < count; i++) {
    await dots.nth(i).click();
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const h1 = document.querySelector("section[aria-label='Destacados'] h1")!;
      const range = document.createRange();
      range.selectNodeContents(h1);
      // Inicio de cada línea (el punto más a la izquierda de cada fila de texto; el «…» de un título recortado no cuenta).
      const rows = new Map<number, number>();
      for (const r of range.getClientRects()) {
        const top = Math.round(r.top);
        rows.set(top, Math.min(rows.get(top) ?? Infinity, Math.round(r.left)));
      }
      return { align: getComputedStyle(h1).textAlign, lefts: [...rows.values()], text: h1.textContent!.trim().slice(0, 20) };
    });
    expect(["left", "start"], `${info.text}: text-align`).toContain(info.align);
    expect(Math.max(...info.lefts) - Math.min(...info.lefts), `${info.text}: líneas desalineadas ${info.lefts}`).toBeLessThanOrEqual(6);
    expect(Math.min(...info.lefts)).toBe(64);
  }
});

test("en móvil el texto sigue centrado", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  const h1 = page.locator("section[aria-label='Destacados'] h1").first();
  await expect(h1).toBeVisible({ timeout: 20_000 });
  expect(await h1.evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
});

test("con movimiento reducido el cambio es directo: una sola portada y un solo título en todo momento", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  const frames = await recordTransition(page, goToSlide(page, 2), 1500);
  expect(frames.every((f) => f.h1.length === 1 && f.imgs.length === 1)).toBe(true);
  expect(frames.at(-1)!.h1[0]!.o).toBeGreaterThan(0.98);
});
