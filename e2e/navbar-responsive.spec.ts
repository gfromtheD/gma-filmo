import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Navbar: matriz responsive + teclado.
 * Entra como invitado (cookie `gma_guest`) para no depender de Supabase.
 * Punto de cambio escritorio/móvil: 1024 px (decisión documentada en
 * docs/frontend-research/PLAN-REDISENO.md). Por debajo hay barra de navegación inferior (sin menú lateral).
 */
const DESKTOP_MIN = 1024;
const WIDTHS = [320, 360, 390, 430, 768, 1023, 1024, 1280, 1440, 1920] as const;
const MIN_TOUCH_TARGET = 44;
/** Como en Filmin, el visitante en móvil ve el botón de registro; su acceso a la cuenta va en la barra inferior ("Entrar"). */
const GUEST_ACCOUNT_MIN = 640;

async function openHome(page: Page) {
  await page.context().addCookies([
    { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
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

const tabBar = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });

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
      const account = page.getByRole("button", { name: "Cuenta" });
      const guestOnPhone = width < GUEST_ACCOUNT_MIN;

      // El buscador (lupa) está siempre en la cabecera.
      const search = page.locator("header").getByRole("link", { name: "Buscador" });
      await expect(search).toBeVisible();
      if (isDesktop) {
        await expect(account).toBeVisible();
        return;
      }
      const box = await search.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

      if (guestOnPhone) {
        await expect(page.getByRole("link", { name: "Registrarse" })).toBeVisible();
        await expect(account).toBeHidden();
      } else {
        await expect(account).toBeVisible();
      }
    });

    test("menú de cuenta: role=menu, Escape lo cierra y devuelve el foco", async ({ page }) => {
      test.skip(width < GUEST_ACCOUNT_MIN, "El visitante en móvil accede a la cuenta desde la barra inferior");
      await openHome(page);
      const account = page.getByRole("button", { name: "Cuenta" });
      await clickUntil(account, page.getByRole("menu"));
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toBeHidden();
      await expect(account).toBeFocused();
    });

    if (isDesktop) {
      test("escritorio: secciones en la barra superior, sin barra inferior ni botón de menú", async ({ page }) => {
        await openHome(page);
        const nav = page.getByRole("navigation", { name: "Principal" });
        for (const name of ["Home", "Películas", "Cortos"]) {
          await expect(nav.getByRole("link", { name })).toBeVisible();
        }
        // Mi Espacio ya no está en el menú: se abre desde el icono de guardados.
        await expect(nav.getByRole("link", { name: "Mi Espacio" })).toHaveCount(0);
        await expect(page.locator("header").getByRole("link", { name: "Mi lista" })).toHaveAttribute("href", "/mi-espacio");
        await expect(page.getByRole("button", { name: "Abrir menú principal" })).toHaveCount(0);
        await expect(tabBar(page)).toBeHidden();
        await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
      });

      test("escritorio: las secciones van a la izquierda, pegadas a la marca, no centradas", async ({ page }) => {
        await openHome(page);
        const brand = (await page.locator("header").getByRole("link", { name: "GMA" }).first().boundingBox())!;
        const nav = (await page.getByRole("navigation", { name: "Principal" }).boundingBox())!;
        const search = (await page.locator("header").getByRole("link", { name: "Buscador" }).boundingBox())!;
        // Empieza justo después de la marca (separación corta): no está centrado en la cabecera.
        expect(nav.x - (brand.x + brand.width)).toBeGreaterThanOrEqual(8);
        expect(nav.x - (brand.x + brand.width)).toBeLessThanOrEqual(24); // todavía más pegado: como en Filmin
        // Y no invade los controles de la derecha.
        expect(nav.x + nav.width).toBeLessThan(search.x - 24);
      });

      test("escritorio: la sección actual no lleva línea verde debajo (solo queda marcada para lectores de pantalla)", async ({ page }) => {
        await openHome(page);
        const nav = page.getByRole("navigation", { name: "Principal" });
        const home = nav.getByRole("link", { name: "Home" });
        await expect(home).toHaveAttribute("aria-current", "page");
        const underline = await home.evaluate((el) => {
          const after = getComputedStyle(el, "::after");
          const visible = after.content !== "none" && after.content !== "normal" && parseFloat(after.opacity) > 0 && parseFloat(after.height) > 0;
          return { visible, content: after.content };
        });
        expect(underline.visible, JSON.stringify(underline)).toBe(false);
        // Ningún elemento propio del menú dibuja una línea verde fija en la parte inferior.
        const greenBars = await nav.evaluate((n) =>
          [...n.querySelectorAll("*")].filter((el) => {
            const cs = getComputedStyle(el);
            const b = el.getBoundingClientRect();
            return b.height > 0 && b.height <= 4 && b.width > 20 && cs.backgroundColor === "rgb(34, 177, 107)";
          }).length,
        );
        expect(greenBars).toBe(0);
      });

      test("escritorio: la sección actual también se ilumina al pasar el cursor; al pulsarla queda en blanco hasta que el cursor sale", async ({ page }) => {
        await openHome(page);
        const nav = page.getByRole("navigation", { name: "Principal" });
        const home = nav.getByRole("link", { name: "Home" });
        const color = () => home.evaluate((el) => getComputedStyle(el).color);
        await expect(home).toHaveAttribute("aria-current", "page");

        // Estando en Home, pasar por Home lo ilumina (si no, parecería un fallo).
        await home.hover();
        await expect.poll(color).toBe("rgb(34, 177, 107)");

        // Al pulsarlo (recarga la sección) vuelve a blanco aunque el cursor siga encima...
        await home.click();
        await expect.poll(color, { timeout: 5000 }).toBe("rgb(255, 255, 255)");

        // ...y al salir y volver a entrar se ilumina otra vez.
        await page.mouse.move(2, 400);
        await expect.poll(color).toBe("rgb(255, 255, 255)");
        await home.hover();
        await expect.poll(color).toBe("rgb(34, 177, 107)");
      });

      test("escritorio: la marca es solo el logo (sin el punto ni la palabra «filmo»)", async ({ page }) => {
        await openHome(page);
        const brand = page.locator("header").getByRole("link", { name: "GMA" }).first();
        expect((await brand.innerText()).trim()).toBe("");
        await expect(page.locator("header").getByText(/filmo/i)).toHaveCount(0);
      });

      test("escritorio: lupa, guardados y avatar son más grandes", async ({ page }) => {
        await openHome(page);
        const header = page.locator("header");
        const iconSize = async (name: string) => {
          const svg = header.getByRole("link", { name }).locator("svg").first();
          const box = (await svg.boundingBox())!;
          return Math.round(box.width);
        };
        expect(await iconSize("Buscador")).toBeGreaterThanOrEqual(26);
        expect(await iconSize("Mi lista")).toBeGreaterThanOrEqual(26);
        const avatar = (await header.getByRole("button", { name: "Cuenta" }).locator("span").first().boundingBox())!;
        expect(avatar.height).toBeGreaterThanOrEqual(34);
      });

      test("escritorio: la palabra se colorea al pasar el cursor y vuelve a blanco al hacer clic y llegar", async ({ page }) => {
        await openHome(page);
        const nav = page.getByRole("navigation", { name: "Principal" });
        const color = (name: string) => nav.getByRole("link", { name }).evaluate((el) => getComputedStyle(el).color);
        const link = nav.getByRole("link", { name: "Películas" });
        expect(await color("Películas")).toBe("rgb(255, 255, 255)");
        await link.hover();
        await expect.poll(() => color("Películas")).toBe("rgb(34, 177, 107)");
        await link.click(); // el cursor se queda encima
        await expect(page).toHaveURL(/\/peliculas/);
        await expect.poll(() => color("Películas"), { timeout: 5000 }).toBe("rgb(255, 255, 255)");
      });
    } else {
      test("móvil: píldora flotante con cuatro accesos, el activo marcado y sin menú lateral", async ({ page }) => {
        await openHome(page);
        const bar = tabBar(page);
        await expect(bar).toBeVisible();
        for (const name of ["Inicio", "Películas", "Cortos", "Entrar"]) {
          const link = bar.getByRole("link", { name });
          await expect(link).toBeVisible();
          const box = await link.boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        }
        await expect(bar.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("button", { name: "Abrir menú principal" })).toHaveCount(0);
        await expect(bar.getByRole("link", { name: "Buscar" })).toHaveCount(0); // la lupa vive en la cabecera

        // Es una píldora flotante: redondeada, separada del borde inferior y de los laterales, centrada.
        const pill = bar.locator("ul");
        const box = await pill.boundingBox();
        expect(box).not.toBeNull();
        const gapBottom = 800 - ((box?.y ?? 0) + (box?.height ?? 0));
        expect(gapBottom).toBeGreaterThanOrEqual(10);
        expect(gapBottom).toBeLessThanOrEqual(30);
        expect(box?.x ?? 0).toBeGreaterThanOrEqual(12);
        expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThanOrEqual(1);
        expect(parseFloat(await pill.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(30);
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

  test("la cabecera se solidifica y queda pegada tras desplazarse", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await openHome(page);
    const header = page.locator("header[data-scrolled]");
    await expect(header).toHaveAttribute("data-scrolled", "false");
    await page.mouse.wheel(0, 600);
    await expect(header).toHaveAttribute("data-scrolled", "true");
    // Debe quedar pegada arriba (sticky), no desaparecer con el scroll.
    await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -999)).toBe(0);
  });
});

test.describe("barra inferior móvil: navegación", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test("elegir una sección navega y marca la nueva como activa", async ({ page }) => {
    await openHome(page);
    const bar = tabBar(page);
    await expect(bar.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    await expect(async () => {
      await bar.getByRole("link", { name: "Películas" }).click();
      await expect(page).toHaveURL(/peliculas/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(tabBar(page).getByRole("link", { name: "Películas" })).toHaveAttribute("aria-current", "page");
    await expect(tabBar(page).getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
  });

  test("el visitante ve «Entrar» (login) y la lupa de la cabecera lleva al buscador", async ({ page }) => {
    await openHome(page);
    await expect(tabBar(page).getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/?login=1");
    await expect(page.locator("header").getByRole("link", { name: "Buscador" })).toHaveAttribute("href", "/buscador");
  });

  test("no tapa el final de la página y no desborda en horizontal", async ({ page }) => {
    await openHome(page);
    // La página reserva el alto de la barra (56 px + zona segura) bajo el pie de página para que no tape lo último.
    const reserved = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("footer")!.parentElement!).paddingBottom));
    expect(reserved).toBeGreaterThanOrEqual(56);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });

  test("al ensanchar a escritorio la barra inferior desaparece y aparece la superior", async ({ page }) => {
    await openHome(page);
    await expect(tabBar(page)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(tabBar(page)).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  });
});

test.describe("cabecera del visitante en móvil: los controles respiran", () => {
  for (const width of [320, 360, 390, 430]) {
    test(`a ${width}px, logo, lupa y registro no se tocan (≥ 8 px entre ellos)`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true });
      const page = await context.newPage();
      await openHome(page);
      const header = page.locator("header");
      const logo = await header.getByRole("link", { name: "GMA" }).boundingBox();
      const search = await header.getByRole("link", { name: "Buscador" }).boundingBox();
      const register = await header.getByRole("link", { name: "Registrarse" }).boundingBox();
      expect(logo).not.toBeNull();
      expect(search).not.toBeNull();
      expect(register).not.toBeNull();
      expect(search!.x - (logo!.x + logo!.width)).toBeGreaterThanOrEqual(8);
      expect(register!.x - (search!.x + search!.width)).toBeGreaterThanOrEqual(4);
      expect(register!.x + register!.width).toBeLessThanOrEqual(width);
      await context.close();
    });
  }
});

/**
 * Regresión: con la página desplazada, abrir un menú modal bloqueaba el scroll poniendo `overflow: hidden`
 * en <body>. Como <body> pasaba a ser un contenedor de scroll, la cabecera pegajosa saltaba al principio del
 * documento (desaparecía) y la pantalla quedaba bloqueada a la altura del scroll.
 */
test.describe("abrir un menú con la página desplazada no rompe la cabecera", () => {
  async function headerTop(page: Page) {
    return page.evaluate(() => Math.round(document.querySelector("header")!.getBoundingClientRect().top));
  }

  test("escritorio: el menú de cuenta deja la cabecera en su sitio y la página se sigue moviendo", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await openHome(page);
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(async () => {
      expect(await headerTop(page)).toBe(0);
    }).toPass({ timeout: 5_000 });
    await clickUntil(page.getByRole("button", { name: "Cuenta" }), page.getByRole("menu"));
    expect(await headerTop(page)).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(900);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    expect(await headerTop(page)).toBe(0);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(900);
    await context.close();
  });

  test("móvil: el menú de un filtro del catálogo tampoco desplaza la cabecera ni la barra inferior", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.context().addCookies([
      { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
    ]);
    await page.goto("/cortos", { waitUntil: "load" });
    const trigger = page.getByRole("button", { name: /^Año/ }).first();
    // Se baja hasta la píldora (así la página queda bien desplazada) y se anota esa posición.
    await trigger.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    const scrolled = await page.evaluate(() => Math.round(window.scrollY));
    expect(scrolled).toBeGreaterThan(300);
    await expect(async () => {
      expect(await headerTop(page)).toBe(0);
    }).toPass({ timeout: 5_000 });
    await clickUntil(trigger, page.getByRole("menu"));
    expect(await headerTop(page)).toBe(0);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(scrolled);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    expect(await headerTop(page)).toBe(0);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(scrolled);
    await context.close();
  });
});

