import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Denunciar un comentario: envía la denuncia, se marca solo si el servidor confirma y permite reintentar. */
test.use({ viewport: { width: 1440, height: 900 } });

function projectRef(): string | null {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const raw = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    return raw ? (new URL(raw).hostname.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}
const REF = projectRef();
test.skip(!REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

async function signIn(page: Page) {
  const session = {
    access_token: "fake.fake.fake", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await page.context().addCookies([
    { name: `sb-${REF}-auth-token`, value, url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
    { name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` },
  ]);
}

async function openComments(page: Page) {
  await page.route("**/api/comments?**", (route) =>
    route.fulfill({ json: [{
      id: 7, pelicula_id: 1, user_id: "00000000-0000-4000-8000-000000000001", display_name: "Otra persona",
      avatar_color: null, parent_id: null, content: "Comentario ajeno", timestamp_ref: null, like_count: 0,
      liked_by_me: false, created_at: new Date().toISOString(), replies: [],
    }] }),
  );
  await page.goto("/inicio", { waitUntil: "load" });
  const href = await page.locator('a[href^="/cortos/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")).find((h) => h !== null && h.split("/").length === 3),
  );
  await page.goto(`${href as string}#comentarios`, { waitUntil: "load" });
}

test("denunciar envía el id del comentario y queda marcado como denunciado", async ({ page }) => {
  await signIn(page);
  const bodies: unknown[] = [];
  await page.route("**/api/comments/report", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await openComments(page);
  await page.getByRole("button", { name: "Denunciar" }).click();
  await expect(page.getByRole("button", { name: "Denunciado" })).toBeDisabled();
  expect(bodies).toEqual([{ commentId: 7 }]);
});

test("si el servidor falla no se marca como denunciado y se puede reintentar", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/comments/report", (route) => route.fulfill({ status: 500, json: { ok: false } }));
  await openComments(page);
  await page.getByRole("button", { name: "Denunciar" }).click();
  const retry = page.getByRole("button", { name: "Error, reintentar" });
  await expect(retry).toBeEnabled();
  await expect(page.getByRole("button", { name: "Denunciado" })).toHaveCount(0);
});
