import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** «Continuar viendo»: la barra de progreso va sobre la imagen y nunca toca el año ni la categoría. */
test.use({ viewport: { width: 1440, height: 900 } });

const ME = "22222222-2222-4222-8222-222222222222";

function projectRef(): string | null {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const raw = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
    const url = raw.replace(/^["']|["']$/g, "");
    return url ? (new URL(url).hostname.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}
const REF = projectRef();
test.skip(!REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

test("la barra de progreso queda dentro de la imagen, por encima del título, el año y la categoría", async ({ page }) => {
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: ME, aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  await page.context().addCookies([
    { name: `sb-${REF}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url },
    { name: "gma_guest", value: "1", url },
  ]);
  // Todos los títulos con unos minutos vistos.
  const rows = Array.from({ length: 200 }, (_, i) => ({
    pelicula_id: i + 1, last_position: 70, completed: false, last_watched_at: new Date().toISOString(),
  }));
  await page.route("**/rest/v1/view_history**", (route) => route.fulfill({ json: rows }));

  await page.goto("/inicio", { waitUntil: "load" });
  const section = page.locator("section.group\\/row", { has: page.getByRole("heading", { name: "Continuar viendo" }) });
  await expect(section).toBeVisible({ timeout: 20_000 });
  await section.scrollIntoViewIfNeeded();

  const card = section.locator("a", { has: page.locator("h3") }).first();
  const bar = card.locator("div.pointer-events-none.absolute.bottom-2").first();
  await expect(bar).toBeVisible();
  const barBox = (await bar.boundingBox())!;
  const art = (await card.locator("div.aspect-video").first().boundingBox())!;
  const info = (await card.locator("h3").boundingBox())!;

  expect(barBox.y + barBox.height).toBeLessThanOrEqual(art.y + art.height); // dentro de la imagen
  expect(barBox.y + barBox.height).toBeLessThan(info.y); // y por encima del texto
});
