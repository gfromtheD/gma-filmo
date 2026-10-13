import { expect, test, type Page } from "@playwright/test";

/** Portada y ficha con la distribución inspirada en Filmin (experimento). */
async function openHome(page: Page) {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: "http://localhost:3000" }]);
  await page.goto("/inicio", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("portada", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("hero bajo la cabecera, con pausa accesible", async ({ page }) => {
    await openHome(page);
    const hero = page.getByRole("region", { name: "Destacados" }).or(page.locator("section[aria-roledescription=carousel]"));
    const box = await hero.first().boundingBox();
    expect(box?.y ?? 99).toBeLessThanOrEqual(1); // empieza en el borde superior (bajo la cabecera)
    const pause = page.getByRole("button", { name: "Pausar presentación" });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(page.getByRole("button", { name: "Reanudar presentación" })).toBeVisible();
  });

  test("las filas muestran 4 columnas a 1440 px y las flechas reflejan los extremos", async ({ page }) => {
    await openHome(page);
    const row = page.locator("section.group\\/row").first();
    await expect(row).toBeVisible();
    const widths = await row.evaluate((el) => {
      const scroller = el.querySelector("div.overflow-x-auto") as HTMLElement;
      const items = [...scroller.children] as HTMLElement[];
      return { first: Math.round(items[0]!.getBoundingClientRect().width), content: Math.round(scroller.clientWidth - 112) };
    });
    expect(Math.abs(widths.first - widths.content / 4)).toBeLessThanOrEqual(2);
    await row.hover();
    await expect(row.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await expect(row.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });
});

test.describe("ficha", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("pestañas ARIA: flechas cambian de pestaña y el hash refleja el estado", async ({ page }) => {
    await openHome(page);
    const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
      links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
    );
    expect(href).toBeTruthy();
    await page.goto(href as string, { waitUntil: "load" });

    const tablist = page.getByRole("tablist", { name: "Secciones de la ficha" });
    await expect(tablist).toBeVisible();
    const first = tablist.getByRole("tab").first();
    await expect(first).toHaveAttribute("aria-selected", "true");

    await expect(async () => {
      await first.focus();
      await page.keyboard.press("ArrowRight");
      await expect(tablist.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
    }).toPass({ timeout: 15_000 });
    expect(page.url()).toMatch(/#(similares|valoraciones)$/);
  });
});

test.describe("vista previa al pasar el ratón", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  async function hoverFirstCard(page: Page) {
    await openHome(page);
    await page.evaluate(() => window.scrollTo(0, 560));
    const card = page.locator("div.snap-x > div").first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + (box?.height ?? 0) + 120);
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2, { steps: 5 });
    return page.locator("[data-hover-preview]");
  }

  test("aparece tras la espera, dentro del viewport, con ver y guardar", async ({ page }) => {
    const preview = await hoverFirstCard(page);
    await expect(preview).toBeVisible({ timeout: 3_000 });
    const box = await preview.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(340);
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(15);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1440 - 15);
    await expect(preview.getByRole("link", { name: "Ver ahora" })).toBeVisible();
    await expect(preview.getByRole("button", { name: /mi lista/i })).toBeVisible();
  });

  test("se mantiene abierta sobre el panel, se cierra al salir y con Escape sin reabrirse", async ({ page }) => {
    const preview = await hoverFirstCard(page);
    await expect(preview).toBeVisible({ timeout: 3_000 });
    const box = await preview.boundingBox();
    // Cursor sobre el panel pero aún dentro de la huella de la portada original.
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2 + 12, (box?.y ?? 0) + (box?.height ?? 0) / 2 + 12, { steps: 4 });
    await page.waitForTimeout(400);
    await expect(preview).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await page.waitForTimeout(800); // más que el retraso de apertura: no debe reabrirse
    await expect(preview).toBeHidden();

    await page.mouse.move(5, 5, { steps: 4 });
    await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 40, { steps: 4 });
    await page.mouse.move(5, 5, { steps: 4 });
    await expect(preview).toBeHidden();
  });
});
