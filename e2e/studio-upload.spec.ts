import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Pasarela de subida de Mi Estudio, probada en una página temporal (se crea al empezar y se borra al terminar) porque
 * `/mi-estudio` exige una sesión real de creador en el servidor.
 */
test.use({ viewport: { width: 1280, height: 1000 } });
test.describe.configure({ mode: "serial" });

const FIXTURE_DIR = path.join(process.cwd(), "app", "(platform)", "creadores", "upload-wizard-fixture");
const FIXTURE_SOURCE = `"use client";
import { UploadWizard } from "@/components/features/studio/upload/upload-wizard";
export default function Fixture() { return <div className="mx-auto w-full max-w-[1180px] p-6"><UploadWizard /></div>; }
`;
const URL_PATH = "/creadores/upload-wizard-fixture";

test.beforeAll(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_DIR, "page.tsx"), FIXTURE_SOURCE);
});
test.afterAll(() => fs.rmSync(FIXTURE_DIR, { recursive: true, force: true }));

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL_PATH, { waitUntil: "load" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await expect(page.getByRole("navigation", { name: "Pasos de la subida" })).toBeVisible({ timeout: 30_000 });
}

/** Etiqueta de un campo obligatorio: «Nombre* (obligatorio)». */
const req = (name: string) => new RegExp(`^${name}\\*? ?\\(obligatorio\\)`);

const stepsNav = (page: Page) => page.getByRole("navigation", { name: "Pasos de la subida" });
const goStep = (page: Page, name: string) => stepsNav(page).getByRole("button", { name: new RegExp(`^Paso \\d\\s*${name}`) }).click();
/** Abre un desplegable por su etiqueta y elige una opción. */
async function pick(page: Page, label: RegExp, option: string, index = 0) {
  await page.getByLabel(label).nth(index).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const next = (page: Page) => page.getByRole("button", { name: "Siguiente" }).click();
const review = (page: Page) => page.getByRole("button", { name: "Revisar y enviar" }).click();

test("muestra los 3 pasos en orden, empieza en «Sube tu obra» y cuenta los completos", async ({ page }) => {
  await open(page);
  const labels = await stepsNav(page).getByRole("listitem").allInnerTexts();
  expect(labels.map((l) => l.replace(/\s+/g, " ").trim().replace(/^paso \d\s*/i, "").replace(/\s*[✓!·]$/, "").replace(/\s*\(.*\)$/, ""))).toEqual([
    "Sube tu obra", "Crea tu ficha", "Completa los detalles",
  ]);
  await expect(stepsNav(page).getByRole("button", { name: /^Paso 1\s*Sube tu obra/ })).toHaveAttribute("aria-current", "step");
  await expect(stepsNav(page).getByText("0 de 3 pasos completos")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sube tu obra", level: 2 })).toBeVisible();
});

test("Siguiente y Anterior recorren los pasos y se puede saltar desde la lista", async ({ page }) => {
  await open(page);
  await next(page);
  await expect(page.getByRole("heading", { name: "Crea tu ficha", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Anterior" }).click();
  await expect(page.getByRole("heading", { name: "Sube tu obra", level: 2 })).toBeVisible();
  await goStep(page, "Completa los detalles");
  await expect(page.getByRole("heading", { name: "Completa los detalles", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(0); // en el último paso se revisa
  await review(page);
  await expect(page.getByRole("heading", { name: "Revisar y enviar", level: 2 })).toBeVisible();
  await expect(stepsNav(page)).toHaveCount(0); // la revisión no es un paso: desaparece la lista
  await page.getByRole("button", { name: "Volver a editar" }).click();
  await expect(stepsNav(page)).toBeVisible();
});

test("al empezar no hay avisos: solo salen al saltar de un paso sin completarlo", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("alert").filter({ hasText: /S/ })).toHaveCount(0); // (el anunciador de rutas de Next está vacío)
  await expect(stepsNav(page).getByText("(incompleto)")).toHaveCount(0);
  await next(page); // sale de «Sube tu obra» sin subir nada
  await expect(stepsNav(page).getByRole("button", { name: /Sube tu obra.*incompleto/ })).toBeVisible();
  await expect(stepsNav(page).getByRole("button", { name: /Completa los detalles.*incompleto/ })).toHaveCount(0);
});

test("en el paso del vídeo los botones caben en pantalla sin bajar, y en los largos están al final", async ({ page }) => {
  for (const height of [700, 1000]) {
    await page.setViewportSize({ width: 1280, height });
    await open(page);
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeInViewport();
  }
  // en un paso largo no flotan: están debajo del todo, no encima del contenido
  await goStep(page, "Crea tu ficha");
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBe(0);
  await expect(page.getByRole("button", { name: "Siguiente" })).not.toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeInViewport();
});

test("al salir de un paso incompleto, al volver se ve qué falta", async ({ page }) => {
  await open(page);
  await goStep(page, "Crea tu ficha");
  await next(page); // se va sin rellenar
  await goStep(page, "Crea tu ficha");
  await expect(page.getByRole("alert").filter({ hasText: "te falta" })).toContainText("Título");
  await expect(page.getByText("Escribe el título.")).toBeVisible();
  await expect(page.getByText("Escribe la sinopsis corta.")).toBeVisible();
});

test("un archivo que no cumple las reglas se rechaza con el motivo", async ({ page }) => {
  await open(page);
  await goStep(page, "Crea tu ficha");
  const poster = page.locator("[data-file-slot='Cartel']");
  await poster.locator("input[type=file]").setInputFiles({ name: "cartel.webp", mimeType: "image/webp", buffer: PNG });
  await expect(poster.getByRole("alert")).toContainText("JPG, PNG o GIF");
  await poster.getByRole("button", { name: /Descartar/ }).click();
  await poster.locator("input[type=file]").setInputFiles({ name: "cartel.png", mimeType: "image/png", buffer: PNG });
  await expect(poster.getByText("Subido")).toBeVisible({ timeout: 10_000 });
  await expect(poster.getByText(/más pequeña que la medida sugerida|proporción es distinta/)).toBeVisible();
});

test("el pie de la web solo aparece en la revisión final", async ({ page }) => {
  await open(page);
  await expect(page.locator("footer")).toHaveCount(0);
  await goStep(page, "Crea tu ficha");
  await expect(page.locator("footer")).toHaveCount(0);
  await goStep(page, "Completa los detalles");
  await review(page);
  await expect(page.locator("footer")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => (await page.locator("footer").boundingBox())?.y ?? 9999).toBeLessThan(1000);
  await expect(page.locator("footer")).toBeInViewport();
  await page.getByRole("button", { name: "Volver a editar" }).click();
  await expect(page.locator("footer")).toHaveCount(0);
});

test("el tráiler y los extras se añaden en la ficha, y son opcionales", async ({ page }) => {
  await open(page);
  await goStep(page, "Crea tu ficha");
  await expect(page.getByRole("heading", { name: "Tráiler", level: 3 })).toBeVisible();
  const trailer = page.locator("[data-file-slot='Archivo de tráiler']");
  await trailer.locator("input[type=file]").setInputFiles({ name: "trailer.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(1024, 1) });
  await expect(trailer.getByText("Subido")).toBeVisible({ timeout: 15_000 });

  // los extras se ven como una galería (no plegada): se añaden varios a la vez y cada uno se reconoce por su archivo
  await expect(page.getByRole("heading", { name: /^Extras/, level: 3 })).toBeVisible();
  // al principio hay tres sugerencias (fotograma, póster, vídeo) y una casilla «+» para añadir más
  await expect(page.locator("[data-extras-suggestion]")).toHaveCount(3);
  await expect(page.locator("[data-extras-more]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Añadir póster" })).toBeVisible();
  const add = page.locator("input[data-extras-input]");
  await add.setInputFiles([
    { name: "foto.png", mimeType: "image/png", buffer: PNG },
    { name: "entrevista.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(1024, 1) },
  ]);
  const first = page.locator("[data-file-slot='Extra 1']");
  const second = page.locator("[data-file-slot='Extra 2']");
  await expect(first.getByText("Subido")).toBeVisible({ timeout: 10_000 });
  await expect(first.getByText("Fotograma", { exact: true })).toBeVisible();
  await expect(second.getByText("Vídeo", { exact: true })).toBeVisible();
  await expect(second.getByText("Subido")).toBeVisible({ timeout: 15_000 });

  // ya hay un fotograma y un vídeo: solo queda sugerido el póster, y la casilla «+» sigue ahí
  await expect(page.locator("[data-extras-suggestion]")).toHaveCount(1);
  await expect(page.locator("[data-extras-suggestion='poster']")).toHaveCount(1);
  await expect(page.locator("[data-extras-more]")).toHaveCount(1);
  await first.getByRole("button", { name: /Quitar Extra 1/ }).click();
  await expect(page.locator("[data-file-slot='Extra 2']")).toHaveCount(0); // el segundo pasa a ser el primero
  await expect(page.locator("[data-file-slot='Extra 1']").getByText("Vídeo", { exact: true })).toBeVisible();
});

test("el vídeo se sube soltándolo en la caja o eligiéndolo, y se puede quitar", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Arrastra tu vídeo aquí")).toBeVisible();
  await expect(page.getByRole("button", { name: /Usar un enlace/ })).toHaveCount(0); // solo se sube archivo
  const zone = page.locator("[data-file-slot='Archivo de vídeo']");
  await zone.locator("input[type=file]").setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.alloc(10, 1) });
  await expect(zone.getByRole("alert")).toContainText("archivo de vídeo");
  await zone.getByRole("button", { name: /Descartar/ }).click();
  await zone.locator("input[type=file]").setInputFiles({ name: "peli.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048, 1) });
  await expect(zone.getByText("Subido")).toBeVisible({ timeout: 15_000 });
  await expect(zone.getByText("peli.mp4")).toBeVisible();
  await zone.getByRole("button", { name: /Quitar/ }).click();
  await expect(page.getByText("Arrastra tu vídeo aquí")).toBeVisible();
});

test("mientras el servidor procesa el vídeo sale la pantalla de carga y luego pasa a «Subido»", async ({ page }) => {
  await open(page);
  const zone = page.locator("[data-file-slot='Archivo de vídeo']");
  await zone.locator("input[type=file]").setInputFiles({ name: "peli.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048, 1) });
  // la cubeta representa la carga desde el principio: no hay barra de progreso aparte
  await expect(zone.getByRole("status")).toBeVisible();
  await expect(zone.getByRole("progressbar")).toHaveCount(0);
  await expect(zone.getByText("Procesando tu vídeo")).toBeVisible({ timeout: 10_000 });
  await expect(zone.getByRole("progressbar")).toHaveCount(0);
  // mientras procesa, el paso no está completo
  await expect(stepsNav(page).getByText("0 de 3 pasos completos")).toBeVisible();
  await expect(zone.getByText("Subido")).toBeVisible({ timeout: 15_000 });
  await expect(zone.getByText("Procesando tu vídeo")).toHaveCount(0);
  await expect(stepsNav(page).getByText("1 de 3 pasos completos")).toBeVisible();
});

test("la revisión enseña qué falta y lleva al paso para arreglarlo", async ({ page }) => {
  await open(page);
  await goStep(page, "Completa los detalles");
  await review(page);
  await expect(page.getByRole("alert").filter({ hasText: "Antes de enviar te falta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeDisabled();
  await page.getByRole("button", { name: "Ir al paso" }).nth(1).click(); // «Tu ficha»
  await expect(page.getByRole("heading", { name: "Crea tu ficha", level: 2 })).toBeVisible();
  await expect(page.getByText("Escribe el título.")).toBeVisible();
});

test("el desplegable de países busca y elige", async ({ page }) => {
  await open(page);
  await goStep(page, "Completa los detalles");
  await page.getByLabel(/^País de producción/).click();
  await page.getByRole("searchbox", { name: /Buscar en País de producción/ }).fill("fran");
  await expect(page.getByRole("option", { name: "Francia", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "España", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Francia", exact: true }).click();
  await expect(page.getByLabel(/^País de producción/)).toContainText("Francia");
});

test("la sinopsis corta avisa al pasar de 250 caracteres", async ({ page }) => {
  await open(page);
  await goStep(page, "Crea tu ficha");
  const short = page.getByLabel(req("Sinopsis corta"));
  await short.fill("a".repeat(251));
  await expect(page.getByText("251 / 250")).toBeVisible();
  await expect(page.getByText("Te pasas 1 caracteres.")).toBeVisible();
  await short.fill("a".repeat(250));
  await expect(page.getByText("250 / 250")).toBeVisible();
});

test("el borrador se guarda solo y sigue ahí al recargar", async ({ page }) => {
  await open(page);
  await goStep(page, "Crea tu ficha");
  await page.getByLabel(req("Título")).fill("Nieve");
  await page.getByLabel(/^Título original/).fill("Snow");
  await expect(page.getByText("Borrador guardado en este navegador.")).toBeVisible({ timeout: 5000 });
  await page.reload({ waitUntil: "load" });
  await goStep(page, "Crea tu ficha");
  await expect(page.getByLabel(req("Título"))).toHaveValue("Nieve");
  await expect(page.getByLabel(/^Título original/)).toHaveValue("Snow");
});

test("recorrido completo: con todo lo obligatorio, la revisión deja enviar", async ({ page }) => {
  await open(page);
  // Vídeo
  await page.locator("[data-file-slot='Archivo de vídeo'] input[type=file]").setInputFiles({ name: "peli.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048, 1) });
  await expect(page.locator("[data-file-slot='Archivo de vídeo']").getByText("Subido")).toBeVisible({ timeout: 15_000 });
  // Ficha: imágenes, título y sinopsis
  await goStep(page, "Crea tu ficha");
  for (const label of ["Banner", "Cartel"]) {
    const slot = page.locator(`[data-file-slot='${label}']`);
    await slot.locator("input[type=file]").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: PNG });
    await expect(slot.getByText("Subido")).toBeVisible({ timeout: 10_000 });
  }
  await page.getByLabel(req("Título")).fill("Nieve");
  await page.getByLabel(/^Título original/).fill("Snow");
  await page.getByLabel(req("Sinopsis corta")).fill("Una historia breve.");
  await page.getByLabel(req("Sinopsis larga")).fill("Una historia algo más larga que la corta.");
  // Datos e idioma
  await goStep(page, "Completa los detalles");
  await page.getByRole("button", { name: "Añadir persona" }).click();
  await page.getByLabel(req("Nombre")).first().fill("Ana Pérez");
  await expect(page.getByLabel(/^Papel/)).toContainText("Director/a"); // la primera persona entra como director/a
  await page.getByLabel(/^Duración/).fill("12");
  await page.getByLabel(/^Año de estreno/).fill("2025");
  await pick(page, /^País de producción/, "España");
  await page.getByLabel(req("Categoría")).click();
  await page.getByRole("option", { name: "Animación" }).click();
  await page.keyboard.press("Escape");
  await pick(page, /^Idioma original/, "español");
  await expect(stepsNav(page).getByText("3 de 3 pasos completos")).toBeVisible();
  // Revisión: vista previa de la ficha y envío
  await review(page);
  const preview = page.getByRole("article", { name: "Vista previa de la ficha" });
  await expect(preview.getByRole("heading", { name: "Nieve" })).toBeVisible();
  await expect(preview.getByText("Una historia breve.")).toBeVisible();
  await expect(preview.getByText("Ana Pérez")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeDisabled(); // faltan los términos
  await page.getByLabel(/acepto los términos de uso/).check();
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeEnabled();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByRole("status").filter({ hasText: "motor" })).toBeVisible({ timeout: 10_000 });
  // El motor no está conectado: lo dice claramente
  await expect(page.getByText("El motor de subida todavía no está conectado")).toBeVisible();
});

test("en móvil nada se sale por los lados y los pasos se desplazan en horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await goStep(page, "Crea tu ficha");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await goStep(page, "Completa los detalles");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
