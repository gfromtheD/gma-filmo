import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * El avatar del perfil principal viene de la base de datos y se decide con un único criterio
 * (foto de creador → avatar elegido → foto de la cuenta → inicial), el mismo que ven los demás.
 * Supabase se intercepta: no se lee ni se escribe nada real.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const USER_ID = "22222222-2222-4222-8222-222222222222";

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

interface MockData {
  profile: { display_name: string; avatar_color: string | null; avatar_url: string | null; avatar_id: string | null };
  creatorPhoto: string | null;
}

/** Responde como PostgREST: objeto único (`maybeSingle`) o lista, según la cabecera Accept. */
function postgrest(route: Route, rows: unknown[]) {
  const wantsObject = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
  if (!wantsObject) return route.fulfill({ json: rows });
  if (rows.length === 1) return route.fulfill({ contentType: "application/vnd.pgrst.object+json", body: JSON.stringify(rows[0]) });
  return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "no rows" }) });
}

async function login(page: Page, data: MockData, writes: { method: string; body: unknown }[] = []) {
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh", user,
  };
  await page.context().addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url },
    { name: "gma_guest", value: "1", url },
  ]);
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: user }));
  await page.route("**/rest/v1/profiles?**", (route) => {
    if (route.request().method() === "GET") return postgrest(route, [data.profile]);
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/rest/v1/creator_profiles?**", (route) => postgrest(route, data.creatorPhoto ? [{ avatar_url: data.creatorPhoto }] : []));
  await page.route("**/rest/v1/sub_profiles?**", (route) => route.fulfill({ json: [] }));
  // Las fotos externas se sirven como un cuadrado de color (no hay red real).
  await page.route("https://lh3.googleusercontent.com/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="#2a6"/></svg>' }),
  );
  await page.route("https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/creadores/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="#a26"/></svg>' }),
  );
}

const GOOGLE = "https://lh3.googleusercontent.com/a/ana";
const CREATOR = "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/creadores/creador.jpg";

async function pillAvatar(page: Page) {
  await page.goto("/inicio", { waitUntil: "load" });
  const header = page.locator("header").first();
  await header.waitFor();
  return header;
}

test.describe("avatar del perfil principal (Supabase simulado)", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("un icono elegido (guardado en la base de datos) se ve en la barra superior", async ({ page }) => {
    await login(page, { profile: { display_name: "Ana", avatar_color: "#22B16B", avatar_url: GOOGLE, avatar_id: "cat" }, creatorPhoto: null });
    const header = await pillAvatar(page);
    await expect(header.locator("img[src='/avatars-svg/avatar-cat.svg']")).toBeVisible();
    await expect(header.locator(`img[src='${GOOGLE}']`)).toHaveCount(0); // el elegido manda sobre la foto de Google
  });

  test("sin avatar elegido se usa la foto de la cuenta", async ({ page }) => {
    await login(page, { profile: { display_name: "Ana", avatar_color: "#22B16B", avatar_url: GOOGLE, avatar_id: null }, creatorPhoto: null });
    const header = await pillAvatar(page);
    await expect(header.locator(`img[src='${GOOGLE}']`)).toBeVisible();
  });

  test("elegir «sin avatar» muestra la inicial aunque haya foto de la cuenta", async ({ page }) => {
    await login(page, { profile: { display_name: "Ana", avatar_color: "#22B16B", avatar_url: GOOGLE, avatar_id: "" }, creatorPhoto: null });
    const header = await pillAvatar(page);
    await expect(header.getByText("A", { exact: true }).first()).toBeVisible();
    await expect(header.locator(`img[src='${GOOGLE}']`)).toHaveCount(0);
  });

  test("la foto de creador manda sobre todo lo demás", async ({ page }) => {
    await login(page, { profile: { display_name: "Ana", avatar_color: "#22B16B", avatar_url: GOOGLE, avatar_id: "cat" }, creatorPhoto: CREATOR });
    const header = await pillAvatar(page);
    await expect(header.locator(`img[src='${CREATOR}']`)).toBeVisible();
    await expect(header.locator("img[src='/avatars-svg/avatar-cat.svg']")).toHaveCount(0);
  });

  test("un avatar que solo existía en este navegador se sube a la base de datos (migración única)", async ({ page }) => {
    const writes: { method: string; body: unknown }[] = [];
    await page.addInitScript((userId) => {
      localStorage.setItem(`gma-profile-settings:${userId}`, JSON.stringify({ avatarIconId: "panda" }));
    }, USER_ID);
    await login(page, { profile: { display_name: "Ana", avatar_color: "#22B16B", avatar_url: null, avatar_id: null }, creatorPhoto: null }, writes);
    const header = await pillAvatar(page);
    await expect.poll(() => writes.some((w) => JSON.stringify(w.body) === JSON.stringify({ avatar_id: "panda" }))).toBe(true);
    await expect(header.locator("img[src='/avatars-svg/avatar-panda.svg']")).toBeVisible(); // y se ve ya mismo
  });

  test("si el avatar ya está en la base de datos no se vuelve a escribir", async ({ page }) => {
    const writes: { method: string; body: unknown }[] = [];
    await page.addInitScript((userId) => {
      localStorage.setItem(`gma-profile-settings:${userId}`, JSON.stringify({ avatarIconId: "panda" }));
    }, USER_ID);
    await login(page, { profile: { display_name: "Ana", avatar_color: "#22B16B", avatar_url: null, avatar_id: "cat" }, creatorPhoto: null }, writes);
    const header = await pillAvatar(page);
    await expect(header.locator("img[src='/avatars-svg/avatar-cat.svg']")).toBeVisible(); // manda la base de datos, no el navegador
    await page.waitForTimeout(1500);
    expect(writes.filter((w) => JSON.stringify(w.body).includes("avatar_id"))).toHaveLength(0);
  });
});
