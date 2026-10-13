import { expect, test, type Page } from "@playwright/test";

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
      await account.click();
      await expect(page.getByRole("menu")).toBeVisible();
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

        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Menú principal" });
        await expect(dialog).toBeVisible();
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
