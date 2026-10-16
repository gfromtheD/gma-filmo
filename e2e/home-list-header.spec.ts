import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Fila «Mi Lista» de la portada: enlace «Ver todas» en texto, sin chip, igual que en «Colecciones para ti». */
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

async function openHome(page: Page) {
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
  await page.route("**/api/watchlist**", (route) => route.fulfill({ json: { ids: [1, 2, 3] } }));
  await page.goto("/inicio", { waitUntil: "load" });
  await expect(page.getByRole("region", { name: "Mi Lista" })).toBeAttached({ timeout: 20_000 });
}

const section = (page: Page, name: string) => page.locator("section", { has: page.getByRole("region", { name }) });

test("Mi Lista tiene un «Ver todas» que lleva a Mi Espacio", async ({ page }) => {
  await openHome(page);
  const link = section(page, "Mi Lista").getByRole("link", { name: "Ver todas" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/mi-espacio");
});

test("es solo texto, sin chip: sin fondo ni borde, y con el mismo estilo que el de Colecciones para ti", async ({ page }) => {
  await openHome(page);
  const style = (name: string) =>
    section(page, name).getByRole("link", { name: "Ver todas" }).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, color: cs.color, size: cs.fontSize, weight: cs.fontWeight };
    });
  const list = await style("Mi Lista");
  const collections = await style("Colecciones para ti");
  expect(list.bg).toBe("rgba(0, 0, 0, 0)");
  expect(list.border).toBe("0px");
  expect(list).toEqual(collections);
});

test("el título y el subtítulo ya no son un enlace ni llevan flecha", async ({ page }) => {
  await openHome(page);
  const header = section(page, "Mi Lista");
  await expect(header.getByRole("link", { name: /ver todo$/ })).toHaveCount(0);
  await expect(header.getByRole("heading", { name: "Mi Lista" }).locator("xpath=ancestor::a")).toHaveCount(0);
});

test("la zona pulsable es cómoda y al pulsarla se abre Mi Espacio", async ({ page }) => {
  await openHome(page);
  const link = section(page, "Mi Lista").getByRole("link", { name: "Ver todas" });
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(/\/mi-espacio/);
});

test("va alineado a la derecha, en la misma línea que el encabezado", async ({ page }) => {
  await openHome(page);
  const header = section(page, "Mi Lista");
  const link = (await header.getByRole("link", { name: "Ver todas" }).boundingBox())!;
  const title = (await header.getByRole("heading", { name: "Mi Lista" }).boundingBox())!;
  expect(link.x).toBeGreaterThan(title.x + 400);
  expect(link.y).toBeLessThan(title.y + 80);
});
