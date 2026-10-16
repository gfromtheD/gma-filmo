import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Momento del vídeo en los comentarios: nomenclatura según la sección y validación contra la
 * duración de la obra. Sesión simulada y API interceptada: no se escribe nada real.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// «El cine cobra vida» dura 2m 01s (121 s) en la base de datos.
const FICHA = "/cortos/el-cine-cobra-vida";

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
    user: {
      id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", role: "authenticated",
      email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
    },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  await page.context().addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value, url },
    { name: "gma_guest", value: "1", url },
  ]);
}

async function openComments(page: Page) {
  await page.route("**/api/comments?**", (route) => route.fulfill({ json: [] }));
  await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
  await page.getByRole("button", { name: /Añadir momento/ }).waitFor();
}

test.describe("con sesión simulada", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("la opción se nombra según la sección: «del cortometraje»", async ({ page }) => {
    await asFakeUser(page);
    await openComments(page);
    await expect(page.getByRole("button", { name: "Añadir momento del cortometraje" })).toBeVisible();
    await expect(page.getByText("momento del vídeo", { exact: false })).toHaveCount(0);

    await page.getByRole("button", { name: "Añadir momento del cortometraje" }).click();
    await expect(page.getByRole("textbox", { name: "Momento del cortometraje (minutos:segundos)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar el momento del cortometraje" })).toBeVisible();
  });

  test("un momento más allá de la duración del corto se rechaza y no deja publicar", async ({ page }) => {
    await asFakeUser(page);
    await openComments(page);
    await page.getByRole("textbox", { name: /Tu comentario/ }).fill("Qué final tan bonito");
    await page.getByRole("button", { name: "Añadir momento del cortometraje" }).click();
    const moment = page.getByRole("textbox", { name: "Momento del cortometraje (minutos:segundos)" });
    const publish = page.getByRole("button", { name: "Publicar", exact: true });

    await moment.fill("13:12");
    await expect(page.getByRole("alert").filter({ hasText: "El cortometraje dura 2:01" })).toBeVisible();
    await expect(publish).toBeDisabled();

    await moment.fill("1:99");
    await expect(page.getByRole("alert").filter({ hasText: "Formato: m:ss" })).toBeVisible();
    await expect(publish).toBeDisabled();

    await moment.fill("2:01"); // justo el final: válido
    await expect(page.getByText(/dura 2:01|Formato: m:ss/)).toHaveCount(0);
    await expect(publish).toBeEnabled();

    await moment.fill("1:15");
    await expect(publish).toBeEnabled();
  });

  test("se publica con el momento válido y se envía en segundos", async ({ page }) => {
    await asFakeUser(page);
    let sent: { timestampRef?: number } | null = null;
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill({
        json: {
          id: 1, pelicula_id: 1, user_id: "22222222-2222-4222-8222-222222222222", display_name: "QA", avatar_color: null,
          parent_id: null, content: "Qué final tan bonito", timestamp_ref: 75, like_count: 0, liked_by_me: false,
          created_at: new Date().toISOString(), replies: [],
        },
      });
    });
    await openComments(page);
    await page.getByRole("textbox", { name: /Tu comentario/ }).fill("Qué final tan bonito");
    await page.getByRole("button", { name: "Añadir momento del cortometraje" }).click();
    await page.getByRole("textbox", { name: "Momento del cortometraje (minutos:segundos)" }).fill("1:15");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect.poll(() => sent?.timestampRef).toBe(75);
  });
});
