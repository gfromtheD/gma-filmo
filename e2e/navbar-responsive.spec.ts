import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Navbar: matriz responsive + teclado.
 * Entra como invitado (cookie `gma_guest`) para no depender de Supabase.
 * Punto de cambio escritorio/móvil: 1024 px (decisión documentada en
 * docs/frontend-research/PLAN-REDISENO.md).
 */
const DESKTOP_MIN = 1024;
const WIDTHS = [320, 360, 390, 430, 768, 1023, 1024, 1280, 1440, 1920] as const;
const MIN_TOUCH_TARGET = 44;

async function openHome(page: Page) {
  await page.context().addCookies([
    { name: "gma_guest", value: "1", url: "http://localhost:3000" },
  ]);
  await page.goto("/inicio", { waitUntil: "load" });
  await expect(page.locator("header")).toBeVisible();
}

/**
 * Reintenta el clic hasta que la UI responde: en desarrollo el primer clic puede
 * llegar antes de la hidratación de React y perderse.
 */
async function clickUntil(trigger: Locator, expected: Locator) {
  await expect(async () => {
    // Idempotente: si un intento anterior ya abrió el elemento, no volver a pulsar (sería un toggle).
    if (!(await expected.isVisible())) await trigger.click();
    await expect(expected).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
}

for (const width of WIDTHS) {
  const isDesktop = width >= DESKTOP_MIN;

  test.describe(`navbar a ${width}px`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: !isDesktop });

    test("ningún control de la cabecera queda fuera de pantalla", async ({ page }) => {
      await openHome(page);
      const offenders = await page.locator("header").evaluate((header, vw) => {
        const out: string[] = [];
        header.querySelectorAll("a, button").forEach((el) => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          if (b.left < -0.5 || b.right > vw + 0.5) {
            out.push(`${el.getAttribute("aria-label") ?? el.textContent?.trim()} [${Math.round(b.left)}–${Math.round(b.right)}]`);
          }
        });
        return out;
      }, width);
      expect(offenders).toEqual([]);
    });

    test("buscador y cuenta siempre alcanzables", async ({ page }) => {
      await openHome(page);
      const search = page.getByRole("link", { name: "Buscador" });
      const account = page.getByRole("button", { name: "Cuenta" });
      await expect(search).toBeVisible();
      await expect(account).toBeVisible();
      if (!isDesktop) {
        for (const target of [search, account]) {
          const box = await target.boundingBox();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        }
      }
    });

    test("menú de cuenta: role=menu, Escape lo cierra y devuelve el foco", async ({ page }) => {
      await openHome(page);
      const account = page.getByRole("button", { name: "Cuenta" });
      await clickUntil(account, page.getByRole("menu"));
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toBeHidden();
      await expect(account).toBeFocused();
    });

    if (isDesktop) {
      test("escritorio: secciones en la barra y sin botón de menú", async ({ page }) => {
        await openHome(page);
        const nav = page.getByRole("navigation", { name: "Principal" });
        for (const name of ["Home", "Películas", "Cortos", "Mi Espacio"]) {
          await expect(nav.getByRole("link", { name })).toBeVisible();
        }
        await expect(page.getByRole("button", { name: "Abrir menú principal" })).toBeHidden();
        await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
      });
    } else {
      test("móvil: el menú abre un diálogo con las secciones, Escape cierra y devuelve el foco", async ({ page }) => {
        await openHome(page);
        const trigger = page.getByRole("button", { name: "Abrir menú principal" });
        await expect(trigger).toBeVisible();
        const box = await trigger.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

        const dialog = page.getByRole("dialog", { name: "Menú principal" });
        await clickUntil(trigger, dialog);
        for (const name of ["Home", "Películas", "Cortos", "Mi Espacio"]) {
          await expect(dialog.getByRole("link", { name })).toBeVisible();
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
      });
    }
  });
}

test.describe("navbar: comportamiento", () => {
  for (const width of [390, 1280]) {
    test(`sin errores de consola ni de hidratación al cargar (${width}px)`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.setViewportSize({ width, height: 800 });
      await openHome(page);
      await page.waitForTimeout(1_500);
      expect(errors).toEqual([]);
    });
  }

  test("la píldora se alinea al pasar de móvil a escritorio (reduced-motion: sin transición)", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openHome(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    const nav = page.getByRole("navigation", { name: "Principal" });
    const home = nav.getByRole("link", { name: "Home" });
    const pill = nav.locator("[data-nav-pill]");
    await expect(pill).toBeVisible();

    await expect(async () => {
      const [h, p] = await Promise.all([home.boundingBox(), pill.boundingBox()]);
      expect(Math.abs((p?.x ?? -99) - (h?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((p?.width ?? -99) - (h?.width ?? 0))).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 5_000 });

    const property = await pill.evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(property).toBe("none");
  });

  test("la cabecera se solidifica tras desplazarse", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await openHome(page);
    const layer = page.locator("header [data-scrolled]");
    await expect(layer).toHaveAttribute("data-scrolled", "false");
    await page.mouse.wheel(0, 400);
    await expect(layer).toHaveAttribute("data-scrolled", "true");
  });
});

test.describe("navbar móvil: navegación", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test("elegir una sección cierra el panel y navega; aria-current marca la activa", async ({ page }) => {
    await openHome(page);
    const trigger = page.getByRole("button", { name: "Abrir menú principal" });
    const dialog = page.getByRole("dialog", { name: "Menú principal" });
    await clickUntil(trigger, dialog);
    await expect(dialog.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await dialog.getByRole("link", { name: "Películas" }).click();
    await expect(page).toHaveURL(/peliculas/);
    await expect(dialog).toBeHidden();
  });

  test("el panel abierto se oculta al ensanchar a escritorio", async ({ page }) => {
    await openHome(page);
    const dialog = page.getByRole("dialog", { name: "Menú principal" });
    await clickUntil(page.getByRole("button", { name: "Abrir menú principal" }), dialog);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(dialog).toBeHidden();
    for (const layer of await page.locator("[data-state=open].fixed").all()) {
      await expect(layer).toBeHidden();
    }
  });
});
