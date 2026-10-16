import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Funciones de comunidad de los comentarios (a la YouTube): orden, contadores abreviados, momentos
 * clicables, enlace permanente, insignia del creador, edición y acciones del creador (fijar y corazón).
 * Sesión simulada y API interceptada: no se escribe nada real.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const FICHA = "/cortos/el-cine-cobra-vida"; // dura 2m 01s
const ME = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

function supabaseProjectRef(): string | null {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const raw = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
    const url = raw.replace(/^["']|["']$/g, "");
    return url ? (new URL(url).hostname.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}
const PROJECT_REF = supabaseProjectRef();

async function asFakeUser(page: Page) {
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: ME, aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  await page.context().addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url },
    { name: "gma_guest", value: "1", url },
  ]);
}

type Row = Record<string, unknown>;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const comment = (id: number, extra: Row = {}): Row => ({
  id, pelicula_id: 1, user_id: OTHER, display_name: `Persona ${id}`, avatar_color: null, parent_id: null,
  content: `Comentario ${id}`, timestamp_ref: null, like_count: 0, liked_by_me: false, created_at: daysAgo(10 - id),
  replies: [], is_creator: false, viewer_is_creator: false, ...extra,
});

async function open(page: Page, threads: Row[], hash = "#comentarios") {
  await page.route("**/api/comments?**", (route) => route.fulfill({ json: threads }));
  await page.goto(`${FICHA}${hash}`, { waitUntil: "load" });
  await page.getByText(/Comentario \d/).first().waitFor();
}

const order = (page: Page) => page.locator("[id^='comentario-']").evaluateAll((els) => els.map((e) => e.id));

test.describe("con sesión simulada", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("orden «Destacados» (más «De acuerdo») y «Más recientes»", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(1, { like_count: 1 }), comment(2, { like_count: 9 }), comment(3, { like_count: 0, created_at: daysAgo(0) })]);
    expect(await order(page)).toEqual(["comentario-2", "comentario-1", "comentario-3"]);
    // El recuento va en grande: «3 comentarios».
    await expect(page.getByRole("heading", { name: "3 comentarios" })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Ordenar por" });
    await trigger.click();
    await expect(page.getByRole("menuitemradio", { name: /Destacados/ })).toBeChecked();
    await page.getByRole("menuitemradio", { name: /Más recientes/ }).click();
    expect(await order(page)).toEqual(["comentario-3", "comentario-2", "comentario-1"]);

    await trigger.click();
    await expect(page.getByRole("menuitemradio", { name: /Más recientes/ })).toBeChecked();
    await page.getByRole("menuitemradio", { name: /Destacados/ }).click();
    expect(await order(page)).toEqual(["comentario-2", "comentario-1", "comentario-3"]);
  });

  test("el contador se abrevia y el botón tiene un nombre accesible descriptivo", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(1, { like_count: 1900 }), comment(2, { like_count: 1 })]);
    await expect(page.getByRole("button", { name: "Indica que te gusta este comentario junto con otras 1,9 K personas" })).toContainText("1,9 K");
    await expect(page.getByRole("button", { name: "Indica que te gusta este comentario junto con otra persona" })).toBeVisible();
  });

  test("los momentos del texto son enlaces si caben en la duración (2:01) y no si se pasan", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(1, { content: "Comentario 1: mira el 0:30 y el 13:12 y el 99:99" })]);
    await expect(page.getByRole("button", { name: "0:30" })).toBeVisible();
    await expect(page.getByRole("button", { name: "13:12" })).toHaveCount(0); // se pasa de 2:01
    await expect(page.getByRole("button", { name: "99:99" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "0:30" })).toHaveAttribute("title", "Ir al minuto 0:30");
  });

  test("muestra las insignias: creador, fijado, del creador y (editado)", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [
      comment(1, { is_creator: true, content: "Comentario 1: del creador" }),
      comment(2, { pinned_at: daysAgo(1), creator_hearted: true, edited_at: daysAgo(2), like_count: 0 }),
      comment(3, { like_count: 50 }),
    ]);
    expect(await order(page)).toEqual(["comentario-2", "comentario-3", "comentario-1"]); // el fijado va primero
    await expect(page.locator("#comentario-1").getByTitle("Creador de esta obra")).toBeVisible();
    await expect(page.locator("#comentario-2").getByText("Fijado", { exact: true })).toBeVisible();
    await expect(page.locator("#comentario-2").getByText("Del creador")).toBeVisible();
    await expect(page.locator("#comentario-2").getByText("(editado)")).toBeVisible();
    await expect(page.locator("#comentario-3").getByText("(editado)")).toHaveCount(0);
  });

  test("el enlace permanente abre la pestaña, despliega las respuestas y resalta el comentario", async ({ page }) => {
    await asFakeUser(page);
    const many = Array.from({ length: 12 }, (_, i) => comment(i + 1, { like_count: 100 - i }));
    many[11] = comment(12, { like_count: 1, replies: [comment(30, { parent_id: 12, content: "Comentario 30: la respuesta enlazada" })] });
    await open(page, many, "#comentario-30");
    await expect(page.getByRole("tab", { name: "Comentarios", selected: true })).toBeVisible();
    await expect(page.getByText("Comentario 30: la respuesta enlazada")).toBeVisible(); // hilo 12 (fuera de la primera página) con respuestas abiertas
    await expect(page.locator("#comentario-30")).toHaveClass(/shadow-\[0_0_0_2px_#22B16B\]/);
    await expect(page.locator("#comentario-30")).toBeInViewport();
  });

  test("las respuestas se muestran de 10 en 10 con «Mostrar más respuestas»", async ({ page }) => {
    await asFakeUser(page);
    const replies = Array.from({ length: 12 }, (_, i) => comment(100 + i, { parent_id: 1, content: `Respuesta ${i + 1}` }));
    await open(page, [comment(1, { replies })]);
    await page.getByRole("button", { name: "12 respuestas" }).click();
    await expect(page.getByText("Respuesta 10", { exact: true })).toBeVisible();
    await expect(page.getByText("Respuesta 11", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Mostrar más respuestas" }).click();
    await expect(page.getByText("Respuesta 12", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mostrar más respuestas" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ocultar respuestas" })).toBeVisible();
  });

  test("la fecha enlaza al comentario", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(7)]);
    await expect(page.locator("#comentario-7").getByRole("link", { name: /hace|ahora/ })).toHaveAttribute("href", "#comentario-7");
  });

  test("editar el propio comentario: se envía el cambio y aparece «(editado)»", async ({ page }) => {
    await asFakeUser(page);
    const sent: { body: Record<string, unknown> | null } = { body: null };
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      sent.body = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true, content: "Texto corregido", edited_at: new Date().toISOString() } });
    });
    await open(page, [comment(1, { user_id: ME, content: "Comentario 1: con una errata" })]);

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    const box = page.getByRole("textbox", { name: "Editar tu comentario" });
    await expect(box).toHaveValue("Comentario 1: con una errata");
    await box.fill("Texto corregido");
    await page.locator("#comentario-1").getByRole("button", { name: "Guardar", exact: true }).click();

    await expect.poll(() => sent.body).toEqual({ commentId: 1, content: "Texto corregido", profileId: "" });
    await expect(page.getByText("Texto corregido")).toBeVisible();
    await expect(page.getByText("(editado)")).toBeVisible();
  });

  test("otro perfil de la misma cuenta no ve «Tú», «Editar» ni «Eliminar»", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(1, { user_id: ME, profile_id: "p_otro" })]);
    await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Eliminar", exact: true })).toHaveCount(0);
    await expect(page.getByText("Tú", { exact: true })).toHaveCount(0);
  });

  test("solo el autor ve «Editar»", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(1, { user_id: OTHER })]);
    await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
  });

  test("el creador puede dar corazón y fijar; el comentario fijado sube arriba", async ({ page }) => {
    await asFakeUser(page);
    const actions: string[] = [];
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      actions.push((route.request().postDataJSON() as { action: string }).action);
      return route.fulfill({ json: { ok: true } });
    });
    await open(page, [comment(1, { like_count: 9, viewer_is_creator: true }), comment(2, { like_count: 0, viewer_is_creator: true })]);
    expect(await order(page)).toEqual(["comentario-1", "comentario-2"]);

    await page.locator("#comentario-2").getByRole("button", { name: "Dar corazón" }).click();
    await expect(page.locator("#comentario-2").getByText("Del creador")).toBeVisible();
    await page.locator("#comentario-2").getByRole("button", { name: "Fijar", exact: true }).click();
    await expect(page.locator("#comentario-2").getByText("Fijado", { exact: true })).toBeVisible();
    expect(await order(page)).toEqual(["comentario-2", "comentario-1"]);
    expect(actions).toEqual(["heart", "pin"]);
  });

  test("las acciones del creador no se ofrecen a los demás", async ({ page }) => {
    await asFakeUser(page);
    await open(page, [comment(1, { viewer_is_creator: false })]);
    await expect(page.getByRole("button", { name: "Dar corazón" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fijar", exact: true })).toHaveCount(0);
  });

  test("si la función aún no existe en el servidor, se avisa sin romper nada", async ({ page }) => {
    await asFakeUser(page);
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      return route.fulfill({ status: 503, json: { ok: false, error: "feature_unavailable" } });
    });
    await open(page, [comment(1, { viewer_is_creator: true })]);
    await page.getByRole("button", { name: "Fijar", exact: true }).click();
    await expect(page.getByText("Esta función aún no está disponible.")).toBeVisible();
    await expect(page.getByText("Fijado", { exact: true })).toHaveCount(0);
  });
});

test.describe("«De acuerdo» en el propio comentario", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("el autor también puede marcar «De acuerdo» en su comentario (como en YouTube)", async ({ page }) => {
    await asFakeUser(page);
    const liked: number[] = [];
    await page.route("**/api/comments/like", (route) => {
      liked.push((route.request().postDataJSON() as { commentId: number }).commentId);
      return route.fulfill({ json: { ok: true } });
    });
    await open(page, [comment(1, { user_id: ME, like_count: 0 })]);
    const button = page.locator("#comentario-1").getByRole("button", { name: /Indica que te gusta este comentario/ });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator("#comentario-1").getByRole("button", { name: "Quitar tu «me gusta» de este comentario" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => liked).toEqual([1]); // la interfaz responde al instante; la petición sale un momento después
  });
});
