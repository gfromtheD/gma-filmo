import { expect, test, type Page } from "@playwright/test";

/**
 * Tarjeta flotante de la portada de inicio: micro-animación de apertura (nace sobre la portada, se despliega hacia
 * abajo y el texto aparece escalonado) y de cierre (se desvanece), en la línea del fundido del catálogo.
 */
test.use({ viewport: { width: 1440, height: 900 } });

async function openHome(page: Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.goto("/inicio", { waitUntil: "load" });
  const row = page.locator("section.group\\/row", { has: page.getByRole("heading", { name: "Recién llegados" }) });
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator("[class*='group/card']").first()).toBeVisible({ timeout: 20_000 });
  return row;
}

/** Empieza a anotar, cada pocos milisegundos, cómo se ve la tarjeta flotante y la portada que la origina. */
async function startRecording(page: Page) {
  await page.evaluate(() => {
    type Frame = { t: number; visible: boolean; opacity: number; image: DOMRect | null; panel: DOMRect; clip: string; bodyOpacity: number; count: number };
    const w = window as unknown as { __frames: Frame[]; __cover: DOMRect | null; __rec: number };
    w.__frames = [];
    w.__cover = null;
    const t0 = performance.now();
    w.__rec = window.setInterval(() => {
      const panel = document.querySelector("[data-hover-preview]") as HTMLElement | null;
      if (!panel) {
        if (w.__frames.length) w.__frames.push({ t: Math.round(performance.now() - t0), visible: false, opacity: 0, image: null, panel: new DOMRect(), clip: "", bodyOpacity: 0, count: 0 });
        return;
      }
      const cs = getComputedStyle(panel);
      const image = panel.querySelector("[data-preview-image]") as HTMLElement | null;
      const body = panel.querySelector("[data-preview-body]") as HTMLElement | null;
      w.__frames.push({
        t: Math.round(performance.now() - t0),
        visible: cs.visibility === "visible",
        opacity: Number(cs.opacity),
        image: image ? image.getBoundingClientRect() : null,
        panel: panel.getBoundingClientRect(),
        clip: cs.clipPath,
        bodyOpacity: body ? Number(getComputedStyle(body).opacity) : 1,
        count: document.querySelectorAll("[data-hover-preview]").length,
      });
    }, 8);
  });
}

async function frames(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __frames: { t: number; visible: boolean; opacity: number; image: DOMRect | null; panel: DOMRect; clip: string; bodyOpacity: number }[] };
    return w.__frames.map((f) => ({
      t: f.t, visible: f.visible, opacity: f.opacity, clip: f.clip, bodyOpacity: f.bodyOpacity,
      image: f.image ? { x: f.image.x, y: f.image.y, w: f.image.width, h: f.image.height } : null,
      panel: { x: f.panel.x, y: f.panel.y, w: f.panel.width, h: f.panel.height },
    }));
  });
}

test.describe("con movimiento normal", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "no-preference" }); });

  test("la imagen de la tarjeta nace exactamente sobre la portada y luego se despliega", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator("[class*='group/card']").first();
    const cover = (await card.locator("a > div").first().boundingBox())!;
    await page.mouse.move(2, 2);
    await startRecording(page);
    await card.hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(900);
    const list = (await frames(page)).filter((f) => f.visible && f.image);

    // Primer fotograma visible: la imagen de la tarjeta cubre la portada (dentro de unos píxeles).
    const first = list[0]!;
    expect(Math.abs(first.image!.x - cover.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(first.image!.y - cover.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(first.image!.w - cover.width)).toBeLessThanOrEqual(3);

    // Termina más alta o igual y con el panel completo (más alto que su imagen).
    const last = list.at(-1)!;
    expect(last.panel.h).toBeGreaterThan(last.image!.h + 100);
    expect(last.opacity).toBe(1);
  });

  test("se despliega hacia abajo: al principio solo se ve la imagen y el recorte se abre en unos 300 ms", async ({ page }) => {
    const row = await openHome(page);
    await page.mouse.move(2, 2);
    await startRecording(page);
    await row.locator("[class*='group/card']").first().hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(900);
    const list = (await frames(page)).filter((f) => f.visible);
    expect(list[0]!.clip).toMatch(/^inset\(/);
    expect(list[0]!.clip).not.toBe(list.at(-1)!.clip); // el recorte cambia hasta abrirse del todo
    expect(list.some((f) => f.clip !== list[0]!.clip && f.clip !== list.at(-1)!.clip)).toBe(true); // y pasa por estados intermedios
  });

  test("el texto aparece escalonado: no está visible al abrirse y llega a verse del todo", async ({ page }) => {
    const row = await openHome(page);
    await page.mouse.move(2, 2);
    await startRecording(page);
    await row.locator("[class*='group/card']").first().hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(900);
    const list = (await frames(page)).filter((f) => f.visible);
    expect(list[0]!.bodyOpacity).toBeLessThan(0.3);
    expect(list.at(-1)!.bodyOpacity).toBe(1);
    // La tarjeta ya se ve antes de que el texto termine de aparecer.
    const withCardButNoFullText = list.filter((f) => f.opacity > 0.5 && f.bodyOpacity < 1);
    expect(withCardButNoFullText.length).toBeGreaterThan(2);
  });

  test("al sacar el cursor la tarjeta se desvanece en vez de desaparecer de golpe", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator("[class*='group/card']").first();
    await card.hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(600);
    await startRecording(page);
    await page.mouse.move(2, 2);
    await expect(page.locator("[data-hover-preview]")).toHaveCount(0, { timeout: 2000 });
    const list = (await frames(page)).filter((f) => f.visible);
    expect(list.some((f) => f.opacity > 0.05 && f.opacity < 0.95)).toBe(true); // estados intermedios
    expect(Math.min(...list.map((f) => f.opacity))).toBeLessThan(0.3);
  });

  test("si el cursor vuelve a la tarjeta mientras se cierra, se queda abierta", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator("[class*='group/card']").first();
    await card.hover();
    const preview = page.locator("[data-hover-preview]");
    await expect(preview).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(600);
    const box = (await preview.boundingBox())!;
    await page.mouse.move(2, 2);
    await page.waitForTimeout(150); // ya empezó a cerrarse
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    await expect(preview).toHaveCount(1);
    expect(Number(await preview.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  });

  test("Escape la cierra al instante, sin animación de salida", async ({ page }) => {
    const row = await openHome(page);
    await row.locator("[class*='group/card']").first().hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-hover-preview]")).toHaveCount(0, { timeout: 300 });
  });
});

test.describe("zona clicable de la tarjeta", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

  async function openPreview(page: Page) {
    const row = await openHome(page);
    await row.locator("[class*='group/card']").first().hover();
    const preview = page.locator("[data-hover-preview]");
    await expect(preview).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(400);
    return preview;
  }

  const cursorAt = (page: Page, x: number, y: number) =>
    page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px!, py!);
      return el ? getComputedStyle(el).cursor : "none";
    }, [x, y] as const);

  test("sobre la imagen el cursor es el normal y un clic no navega", async ({ page }) => {
    const preview = await openPreview(page);
    const image = (await preview.locator("[data-preview-image]").boundingBox())!;
    const x = image.x + image.width / 2;
    const y = image.y + image.height / 3;
    expect(await cursorAt(page, x, y)).toBe("default");
    const url = page.url();
    await page.mouse.click(x, y);
    await page.waitForTimeout(300);
    expect(page.url()).toBe(url);
  });

  test("de la imagen hacia abajo el cursor es el dedo y un clic lleva a la ficha", async ({ page }) => {
    const preview = await openPreview(page);
    const image = (await preview.locator("[data-preview-image]").boundingBox())!;
    const panel = (await preview.boundingBox())!;
    const x = panel.x + 6; // lateral, lejos de botones
    const y = image.y + image.height + 10;
    expect(await cursorAt(page, x, y)).toBe("pointer");
    expect(await cursorAt(page, x, panel.y + panel.height - 6)).toBe("pointer");
    await page.mouse.click(x, y);
    await expect(page).toHaveURL(/\/cortos\/[^/]+$/);
  });
});

test.describe("título y nota de la tarjeta", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/ratings/community**", (route) =>
      route.fulfill({ json: { reviews: [], avgScore: 7.5, voteCount: 2, total: 0, hasMore: false } }),
    );
  });

  const GREEN = "rgb(34, 177, 107)";
  async function open(page: Page) {
    const row = await openHome(page);
    await row.locator("[class*='group/card']").first().hover();
    const preview = page.locator("[data-hover-preview]");
    await expect(preview).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);
    return preview;
  }

  test("el título solo se pone verde cuando el cursor está sobre el propio título", async ({ page }) => {
    const preview = await open(page);
    const title = preview.locator("a.self-start");
    expect(await title.evaluate((el) => getComputedStyle(el).color)).not.toBe(GREEN);

    // Sobre la sinopsis (zona clicable, pero no el título): sigue blanco.
    const synopsis = (await preview.locator("p.line-clamp-5").boundingBox())!;
    await page.mouse.move(synopsis.x + synopsis.width / 2, synopsis.y + 8);
    expect(await title.evaluate((el) => getComputedStyle(el).color)).not.toBe(GREEN);

    // Sobre «Ver ahora»: blanco (antes ocurría lo contrario que en el resto: verde y luego blanco).
    await preview.getByRole("link", { name: "Ver ahora" }).hover();
    expect(await title.evaluate((el) => getComputedStyle(el).color)).not.toBe(GREEN);

    // Sobre el título: verde.
    await title.hover();
    expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe(GREEN);
  });

  test("la nota usa el formato del catálogo: «★ 7.5 · 2 valoraciones»", async ({ page }) => {
    const preview = await open(page);
    const score = preview.locator("[data-preview-score]");
    await expect(score).toHaveText("★ 7.5 · 2 valoraciones");
    await expect(preview.getByText("votos")).toHaveCount(0);
  });
});

test.describe("con movimiento reducido", () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

  test("la tarjeta aparece ya abierta, sin recorte ni texto a medias", async ({ page }) => {
    const row = await openHome(page);
    await page.mouse.move(2, 2);
    await startRecording(page);
    await row.locator("[class*='group/card']").first().hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);
    const list = (await frames(page)).filter((f) => f.visible);
    const settled = list.at(-1)!;
    expect(settled.opacity).toBe(1);
    expect(settled.bodyOpacity).toBe(1);
    // Sin transiciones: salta del primer fotograma (como mucho) al estado final.
    const intermediate = list.filter((f) => f.opacity > 0.05 && f.opacity < 0.95);
    expect(intermediate.length).toBe(0);
  });

  test("al salir se cierra enseguida", async ({ page }) => {
    const row = await openHome(page);
    await row.locator("[class*='group/card']").first().hover();
    await expect(page.locator("[data-hover-preview]")).toBeVisible({ timeout: 3000 });
    await page.mouse.move(2, 2);
    await expect(page.locator("[data-hover-preview]")).toHaveCount(0, { timeout: 600 });
  });
});
