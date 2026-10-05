import { test, expect, type Page } from "@playwright/test";

const uid = "11111111-1111-4111-8111-111111111111";
const selectedViews = new WeakMap<Page, string>();
const browserErrors = new WeakMap<Page, string[]>();
const longName = "María y el colectivo cinematográfico de larguísimos nombres";
const user = { id: uid, email: "correo.extremadamente.largo.para.comprobar.ajustes@ejemplo.invalid", created_at: "2026-01-01T00:00:00Z", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  // Every data request is synthetic; these tests never use live accounts or storage.
  await page.route("https://gma-filmo-test.supabase.co/**", async route => {
    const url = new URL(route.request().url());
    const view = selectedViews.get(page);
    let json: unknown = [];
    if (url.pathname.includes("/auth/")) json = user;
    else if (url.pathname.endsWith("/profiles")) json = { display_name: view === "viewer-setup" ? "" : longName, avatar_color: "#22B16B" };
    else if (url.pathname.endsWith("/creator_profiles")) json = view === "creator-setup" ? null : { avatar_url: "", studio_name: longName };
    else if (url.pathname.endsWith("/sub_profiles")) json = [{ id: "profile-test", name: "Perfil de prueba con PIN", avatar_id: "", color: "#22B16B", is_kids: false, require_pin: true, pin: "1234", autoplay: true }];
    else if (url.pathname.endsWith("/view_history")) json = [{ pelicula_id: 1, last_position: 15, completed: false, last_watched_at: "2026-10-04T10:00:00Z" }];
    else if (url.pathname.endsWith("/watchlist")) json = [{ pelicula_id: 1 }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
  });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("upload")) return route.fulfill({ status: 503, json: { error: "Transporte omitido en prueba visual" } });
    if (path === "/api/ratings") return route.fulfill({ json: { entries: [{ pelicula_id: 1, score: 4.5, comment: "Una reseña larga que comprueba la distribución del diario y sus acciones.", rated_at: "2026-10-04T10:00:00Z" }] } });
    if (path === "/api/ratings/community") return route.fulfill({ json: { reviews: [{ userId: "another-user", displayName: longName, avatarUrl: null, avatarColor: "#22B16B", score: 9, comment: "Texto de prueba con una referenciaextremadamentelargasinseparadores".repeat(3), ratedAt: "2026-10-04T10:00:00Z", likeCount: 1, likedByMe: false }], avgScore: 9, voteCount: 1 } });
    if (path === "/api/comments") return route.fulfill({ json: [{ id: 1, pelicula_id: 1, user_id: "another-user", display_name: longName, avatar_color: "#22B16B", parent_id: null, content: "Un comentario largo con enlaces y palabraslargassinseparadoresparaqueenvuelvan".repeat(3), timestamp_ref: 12, like_count: 1, liked_by_me: false, created_at: "2026-10-04T10:00:00Z", replies: [{ id: 2, pelicula_id: 1, user_id: "another-user", display_name: longName, avatar_color: null, parent_id: 1, content: "Una respuesta anidada que se conserva visible.", timestamp_ref: null, like_count: 0, liked_by_me: false, created_at: "2026-10-04T10:00:00Z", replies: [] }] }] });
    return route.fulfill({ json: { entries: [], ratings: [], comments: [], count: 0, average: null } });
  });
  await page.route("**/__responsive-video.mp4", route => route.fulfill({ status: 204 }));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

async function open(page: Page, view: string) {
  selectedViews.set(page, view);
  await page.context().clearCookies();
  await page.goto(`/creadores/responsive-fixture?view=${view}`);
  if (view === "player") await expect(page.locator(`[data-ready="${view}"]`)).toBeAttached();
  else await expect(page.locator(`[data-ready="${view}"]`)).toBeVisible();
  await page.waitForTimeout(700); // Dejar terminar las transiciones antes de medir.
  if (view === "player") await expect(page.locator(`[data-ready="${view}"]`)).toBeAttached();
  else await expect(page.locator(`[data-ready="${view}"]`)).toBeVisible();
}

async function expectFits(page: Page, label: string) {
  await expect.configure({ soft: true }).poll(() => page.evaluate(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nodes = document.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,a,input,textarea,select,[role=dialog],[role=slider]");
    return [...nodes].flatMap(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!rect.width || !rect.height || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0 || el.closest('[aria-hidden="true"]')) return [];
      // Carousels, tab strips and visually hidden file inputs intentionally extend.
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth) return [];
      }
      const dialogFitsHeight = el.getAttribute("role") !== "dialog" || (rect.top >= -2 && rect.bottom <= height + 2);
      if (rect.right <= width + 2 && rect.left >= -2 && dialogFitsHeight) return [];
      if (style.position === "absolute" && rect.width <= 2) return [];
      return [{ tag: el.tagName, text: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 65), left: Math.round(rect.left), right: Math.round(rect.right), ...(!dialogFitsHeight ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : {}) }];
    }).slice(0, 15);
  }), { message: label, timeout: 3000 }).toEqual([]);
}

const views = ["home", "catalog", "search", "settings", "space", "movie", "series", "profile", "creator", "support", "profiles", "profile-edit", "studio-home", "studio-titles", "studio-profile", "studio-stats", "studio-upload", "studio-edit", "viewer-setup", "creator-setup", "dm"];
for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [667, 375], [844, 390], [768, 1024], [820, 1180], [1024, 768], [1280, 800], [1440, 900]]) {
  test.describe(`${width}×${height}`, () => {
  test.use({ hasTouch: width! < 1280, isMobile: width! < 1280 });
  test(`pantallas y ventanas a ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    for (const view of views) {
      await open(page, view);
      await expectFits(page, `${view} a ${width}×${height}`);
    }
  });
  });
}

test("filtros en píldoras: caben, teclado, foco y cierre en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, "catalog");
  const group = page.getByRole("group", { name: "Filtros del catálogo" });
  await group.scrollIntoViewIfNeeded();
  await expectFits(page, "Píldoras de filtros");
  const trigger = page.getByRole("button", { name: /^Año/ }).first();
  const box = await trigger.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expectFits(page, "Menú de filtro abierto");
  await page.screenshot({ path: test.info().outputPath("filtros-320.png") });
  // Con el teclado se baja por la lista hasta llegar a un año (el foco inicial del menú puede variar) y se elige.
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => (document.activeElement?.textContent ?? "").trim());
    if (/^(19|20)\d\d$/.test(focused)) break;
  }
  await page.keyboard.press("Enter");
  await expect(menu).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Limpiar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(19|20)\d\d$/ })).toBeVisible(); // la píldora muestra el año elegido
  await page.setViewportSize({ width: 320, height: 360 });
  await group.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /^(19|20)\d\d$/ }).click();
  await expectFits(page, "Menú de filtro con poca altura");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^(19|20)\d\d$/ })).toBeFocused();
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.getByRole("button", { name: "Limpiar" })).toHaveCount(0);
});

test("ajustes y diario: controles accesibles con datos largos", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, "settings");
  for (const tab of ["Idioma y subtítulos", "Preferencias de reproducción", "Control parental", "Notificaciones", "Dispositivos"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expectFits(page, `Ajustes ${tab}`);
  }
  await open(page, "space");
  await page.getByRole("button", { name: /Editar valoración/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectFits(page, "Diario valoración");
  await page.waitForTimeout(350);
  await page.screenshot({ path: test.info().outputPath("diario-320.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("navegación: cuenta y pestañas del estudio al girar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, "studio-home");
  // Next synchronizes native history with usePathname without a server navigation.
  await page.evaluate(() => history.pushState(null, "", "/mi-estudio?view=studio-home"));
  const nav = page.getByRole("group", { name: "Secciones de Mi Estudio" });
  await expect(nav.getByRole("button", { name: "Panel", exact: true })).toBeVisible();
  for (const label of ["Panel", "Mis títulos", "Subir", "Perfil"]) {
    const tab = nav.getByRole("button", { name: label, exact: true });
    await tab.click();
    const box = await tab.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(322);
  }
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await expectFits(page, "Navegación y menú de cuenta");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 844, height: 390 });
  await expectFits(page, "Navegación tras rotación");
  await page.screenshot({ path: test.info().outputPath("navegacion-estudio-horizontal.png") });
});

test("mensajes: teclado simulado y selector de emojis", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "dm");
  await expect(page.getByRole("dialog", { name: "Mensajes directos" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 360 });
  await expect.poll(async () => {
    const rect = await page.locator("textarea").boundingBox();
    return rect ? rect.y + rect.height : Infinity;
  }).toBeLessThanOrEqual(360);
  await expectFits(page, "Mensajes con altura reducida");
  await expect(page.locator("textarea")).toBeVisible();
  const box = await page.locator("textarea").boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "Elegir emoji" }).click();
  const popup = page.locator("[data-dm-popup]");
  await expect(popup).toBeVisible();
  await expectFits(page, "Emoji en pantalla reducida");
  await page.screenshot({ path: test.info().outputPath("mensajes-teclado.png") });
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
});

test("perfil con PIN, editor y estudio en horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await open(page, "profiles");
  await page.getByRole("button", { name: "Entrar como Perfil de prueba con PIN", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectFits(page, "PIN horizontal");
  await page.getByRole("button", { name: "Volver a perfiles", exact: true }).click();
  await open(page, "profile-edit");
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expectFits(page, "Editor perfil ajustes");
  await page.screenshot({ path: test.info().outputPath("perfil-horizontal.png") });
  await open(page, "studio-titles");
  await page.getByRole("button", { name: /Opciones de/ }).first().click();
  await expectFits(page, "Menú del título en horizontal");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Abrir Un cortometraje con un título largo para probar todos los tamaños", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectFits(page, "Ficha del título del estudio");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir Un cortometraje con un título largo para probar todos los tamaños", exact: true }).first()).toBeFocused();
});

test("reproductor: controles, pausa y paneles en móvil y horizontal", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
  });
  for (const viewport of [{ width: 320, height: 640 }, { width: 667, height: 375 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await open(page, "player");
    await page.waitForTimeout(5000); // Intro antes de montar el vídeo principal.
    await page.locator("video:not([aria-hidden])").evaluate(video => {
      Object.defineProperty(video, "duration", { configurable: true, value: 30 });
      video.dispatchEvent(new Event("loadedmetadata"));
      video.dispatchEvent(new Event("playing"));
    });
    await page.mouse.move(150, 180);
    await page.waitForTimeout(3400);
    await page.touchscreen.tap(160, 200);
    await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    await expect(page.locator("h2").locator("..")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("button", { name: "Reproducir", exact: true }).locator("../..")).toHaveCSS("opacity", "1");
    await expectFits(page, "Reproductor en pausa");
    const creditBounds = await page.getByRole("link", { name: longName, exact: true }).evaluate(element => {
      const link = element.getBoundingClientRect();
      let parent = element.parentElement;
      while (parent && getComputedStyle(parent).overflowY !== "auto") parent = parent.parentElement;
      const panel = parent!.getBoundingClientRect();
      return { top: link.top, bottom: link.bottom, panelTop: panel.top, panelBottom: panel.bottom };
    });
    expect(creditBounds.top).toBeGreaterThanOrEqual(creditBounds.panelTop - 1);
    expect(creditBounds.bottom).toBeLessThanOrEqual(creditBounds.panelBottom + 1);
    await page.screenshot({ path: test.info().outputPath(`player-${viewport.width}.png`) });
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expectFits(page, "Configuración del reproductor");
  }
});

test("ficha: reseñas largas, comentarios anidados y valoración", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, "movie");
  await expect(page.getByText(longName, { exact: true }).first()).toBeVisible();
  await expectFits(page, "Reseñas largas");
  await page.getByRole("tab", { name: "Comentarios", exact: true }).click();
  await page.getByRole("button", { name: "1 respuesta", exact: true }).click();
  await expect(page.getByText("Una respuesta anidada que se conserva visible.")).toBeVisible();
  await expectFits(page, "Comentarios anidados");
  await page.getByRole("tab", { name: "Valoraciones", exact: true }).click();
  // La valoración se edita en un formulario integrado en la ficha (ya no es un diálogo modal).
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.locator("#rating-form-title")).toBeVisible();
  await expectFits(page, "Valoración 5 por 2");
  await page.waitForTimeout(350);
  await page.screenshot({ path: test.info().outputPath("valoracion-320.png") });
});

for (const width of [320, 768, 1440]) {
  test(`subida: detalles y vista previa a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("gma_studio_upload_draft:11111111-1111-4111-8111-111111111111", JSON.stringify({
        step: 1, mainFile: { name: "Unarchivoextremadamentelargoparacomprobarlaenvolturadeltexto.mp4", size: "10 MB", sizeBytes: 10485760, r2Url: "https://example.invalid/test.mp4" },
        assetUrls: {}, form: { title: "Una película con un nombre largo que se revisa en móvil y tablet", description: "Un argumento de ejemplo para comprobar el ajuste de las columnas.", genre: "Drama", year: "2026", duration: "10 min", language: "Español", subtitles: [], poster: { from: "#123", to: "#234", accent: "#22B16B" }, trailer: false },
      }));
    });
    await open(page, "studio-upload");
    await expect(page.getByPlaceholder("14 min")).toBeVisible();
    await expectFits(page, "Detalles subida");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expectFits(page, "Vista previa subida");
    await page.screenshot({ path: test.info().outputPath(`subida-preview-${width}.png`), fullPage: true });
  });
}

test("subida: archivos en cola y menú de tipo sin transferencia real", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page, "studio-upload");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "subtitulos-con-un-nombre-largo-de-prueba.srt", mimeType: "text/plain", buffer: Buffer.from("1\n00:00:00,000 --> 00:00:01,000\nPrueba local\n") });
  await expect(page.getByRole("heading", { name: "Archivos añadidos" })).toBeVisible();
  await expectFits(page, "Cola de archivos en móvil");
  await page.getByRole("button", { name: "Subtítulos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Película / Corto", exact: true })).toBeVisible();
  await expectFits(page, "Menú de tipo de archivo");
  await page.screenshot({ path: test.info().outputPath("subida-cola-320.png"), fullPage: true });
});

test("composición de inicio y estudio en móvil y escritorio", async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ["home", "studio-home"]) {
      await open(page, view);
      await expectFits(page, `${view} ${width}px`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(350);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: test.info().outputPath(`${view}-${width}.png`), fullPage: true });
    }
  }
});

test("configuración del creador: cuatro pasos en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page, "creator-setup");
  await page.getByRole("button", { name: "Sí, añadir acceso de creador", exact: true }).click();
  await page.getByPlaceholder("Escribe tu nombre").fill(longName);
  await page.getByPlaceholder("El nombre de tu estudio").fill("Estudio de cine con un nombre amplio para probar el formulario");
  for (let step = 0; step < 4; step++) {
    await expectFits(page, `Configuración creador paso ${step + 1}`);
    if (step < 3) await page.getByRole("button", { name: "Guardar y continuar →", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Empezar a crear →", exact: true })).toBeVisible();
});

test("listas, búsqueda y próximamente en móvil, tablet y escritorio", async ({ page }) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page, "coming-soon");
    await expectFits(page, `Próximamente ${width}px`);
    await open(page, "search");
    await page.getByPlaceholder("Buscar cortos, películas y autores…").fill("Un cortometraje");
    await page.waitForTimeout(500);
    await expectFits(page, `Resultados de búsqueda ${width}px`);
    await page.getByPlaceholder("Buscar cortos, películas y autores…").fill("Unabúsquedaextremadamentelargasinresultadosniseparadores");
    await page.waitForTimeout(500);
    await expect(page.getByText(/Sin resultados para/)).toBeVisible();
    await expectFits(page, `Búsqueda vacía ${width}px`);
    await open(page, "studio-titles");
    await page.getByRole("button", { name: "Vista en lista", exact: true }).click();
    await expectFits(page, `Lista de títulos ${width}px`);
    await page.screenshot({ path: test.info().outputPath(`titulos-lista-${width}.png`), fullPage: true });
    const title = page.getByRole("button", { name: /^Abrir Un cortometraje/ }).first();
    await title.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectFits(page, `Detalles desde lista ${width}px`);
    await page.keyboard.press("Escape");
    await expect(title).toBeFocused();
    await page.getByRole("button", { name: "Vista en cuadrícula", exact: true }).click();
    await expectFits(page, `Cuadrícula de títulos ${width}px`);
  }
});

test.describe("teclado de escritorio", () => {
  test.use({ hasTouch: false, isMobile: false });
  test("foco visible del avatar y nombres de controles", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "space");
    const edit = page.getByRole("button", { name: "Editar perfil", exact: true });
    await edit.focus();
    await expect(edit).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "Cuenta", exact: true }).click();
    await page.getByRole("menuitem", { name: "Configuración", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Cuenta", exact: true })).toBeFocused();
    await open(page, "settings");
    await page.getByRole("button", { name: "Idioma y subtítulos", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Idioma de la aplicación", exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Subtítulos forzados", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preferencias de reproducción", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Reproducir siguiente episodio", exact: true })).toBeVisible();
  });
});
