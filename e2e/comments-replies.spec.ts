import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Respuestas a comentarios: hilos de un solo nivel, contador con respuestas y errores claros cuando
 * el comentario padre ya no existe. Sesión simulada y API interceptada: no se escribe nada real.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const FICHA = "/cortos/el-cine-cobra-vida";
const ME = "22222222-2222-4222-8222-222222222222";

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
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const url = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
  await page.context().addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value, url },
    { name: "gma_guest", value: "1", url },
  ]);
}

const comment = (id: number, parent_id: number | null, content: string, user_id = "33333333-3333-4333-8333-333333333333") => ({
  id, pelicula_id: 1, user_id, display_name: `Persona ${id}`, avatar_color: null, parent_id, content,
  timestamp_ref: null, like_count: 0, liked_by_me: false, created_at: new Date(Date.now() - 60_000 * (10 - id)).toISOString(), replies: [] as unknown[],
});

const THREADS = [{ ...comment(1, null, "Me ha encantado el final"), replies: [comment(2, 1, "A mí también")] }, comment(3, null, "Muy buena animación")];

async function openComments(page: Page) {
  await page.route("**/api/comments?**", (route) => route.fulfill({ json: THREADS }));
  await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
  await page.getByText("Me ha encantado el final").waitFor();
}

test.describe("con sesión simulada", () => {
  test.skip(!PROJECT_REF, "Sin NEXT_PUBLIC_SUPABASE_URL en .env.local");

  test("el contador suma comentarios y respuestas", async ({ page }) => {
    await asFakeUser(page);
    await openComments(page);
    await expect(page.getByRole("heading", { name: /^3 comentarios$/ })).toBeVisible();
  });

  test("también se puede responder a una respuesta (como en YouTube)", async ({ page }) => {
    await asFakeUser(page);
    await openComments(page);
    await expect(page.getByRole("button", { name: /Responder/ })).toHaveCount(2); // dos comentarios principales (respuestas plegadas)
    await page.getByRole("button", { name: /1 respuesta/ }).click();
    await expect(page.getByText("A mí también")).toBeVisible();
    await expect(page.getByRole("button", { name: /Responder/ })).toHaveCount(3); // ahora también la respuesta
  });

  test("al responder a una respuesta se indica a quién, sin escribir su nombre en el texto, y se publica en el hilo principal", async ({ page }) => {
    await asFakeUser(page);
    const sent: { body: { parentId?: number; replyToId?: number; content?: string } | null } = { body: null };
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sent.body = route.request().postDataJSON();
      return route.fulfill({ json: { ...comment(11, 1, "gracias", ME), display_name: "Yo", reply_to_id: 2, reply_to_name: "Persona 2" } });
    });
    await openComments(page);
    await page.getByRole("button", { name: /1 respuesta/ }).click();

    await page.locator("#comentario-2").getByRole("button", { name: /Responder/ }).click();
    await expect(page.getByText("Respondiendo a", { exact: false })).toContainText("@Persona 2");
    const box = page.getByRole("textbox", { name: "Tu respuesta" });
    await expect(box).toHaveValue(""); // el nombre ya no se escribe en el texto
    await expect(box).toBeFocused();
    await expect(page.getByRole("button", { name: "Publicar", exact: true }).last()).toBeDisabled();

    await box.pressSequentially("gracias");
    await page.getByRole("button", { name: "Publicar", exact: true }).last().click();
    await expect.poll(() => sent.body?.parentId).toBe(1); // al comentario principal, no a la respuesta
    expect(sent.body?.replyToId).toBe(2); // y a la persona concreta que se menciona
    expect(sent.body?.content).toBe("gracias");
    await expect(page.locator("#comentario-11").getByRole("link", { name: "@Persona 2" })).toBeVisible();
  });

  test("responder a un comentario principal no lleva mención", async ({ page }) => {
    await asFakeUser(page);
    const sent: { body: { parentId?: number; replyToId?: number | null } | null } = { body: null };
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sent.body = route.request().postDataJSON();
      return route.fulfill({ json: comment(12, 3, "Qué bonito", ME) });
    });
    await openComments(page);
    await page.locator("#comentario-3").getByRole("button", { name: /Responder/ }).click();
    await expect(page.getByText("Respondiendo a", { exact: false })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Tu respuesta" }).fill("Qué bonito");
    await page.getByRole("button", { name: "Publicar", exact: true }).last().click();
    await expect.poll(() => sent.body?.parentId).toBe(3);
    expect(sent.body?.replyToId ?? null).toBeNull();
  });

  test("la mención muestra el nombre ACTUAL aunque la persona haya cambiado de nombre", async ({ page }) => {
    await asFakeUser(page);
    // El texto guardado no lleva ningún nombre; el servidor entrega el actual («Bea», antes «Persona 2»).
    const threads = [{ ...comment(1, null, "Me ha encantado el final"), replies: [
      comment(2, 1, "A mí también"), { ...comment(4, 1, "totalmente"), reply_to_id: 2, reply_to_name: "Bea" },
    ] }];
    await page.route("**/api/comments?**", (route) => route.fulfill({ json: threads }));
    await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
    await page.getByRole("button", { name: /2 respuestas/ }).click();

    const mention = page.locator("#comentario-4").getByRole("link", { name: "@Bea" });
    await expect(mention).toBeVisible();
    await expect(mention).toHaveAttribute("href", "#comentario-2");
    await expect(page.locator("#comentario-4")).not.toContainText("@Persona 2");
  });

  test("la mención es un enlace que lleva al comentario mencionado", async ({ page }) => {
    await asFakeUser(page);
    const threads = [{ ...comment(1, null, "Me ha encantado el final"), replies: [
      comment(2, 1, "A mí también"), { ...comment(4, 1, "totalmente"), reply_to_id: 2, reply_to_name: "Persona 2" },
    ] }];
    await page.route("**/api/comments?**", (route) => route.fulfill({ json: threads }));
    await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
    await page.getByRole("button", { name: /2 respuestas/ }).click();
    await page.locator("#comentario-4").getByRole("link", { name: "@Persona 2" }).click();
    await expect.poll(() => page.url()).toContain("#comentario-2");
  });

  test("una mención al comentario principal del hilo también se muestra con el nombre actual", async ({ page }) => {
    await asFakeUser(page);
    const threads = [{ ...comment(1, null, "Me ha encantado el final"), replies: [{ ...comment(7, 1, "q tal"), reply_to_id: 1, reply_to_name: "Yahya" }] }];
    await page.route("**/api/comments?**", (route) => route.fulfill({ json: threads }));
    await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
    await page.getByRole("button", { name: /1 respuesta/ }).click();
    await expect(page.locator("#comentario-7").getByRole("link", { name: "@Yahya" })).toHaveAttribute("href", "#comentario-1");
  });

  test("si el comentario mencionado ya no existe se indica sin mostrar un nombre", async ({ page }) => {
    await asFakeUser(page);
    const threads = [{ ...comment(1, null, "Me ha encantado el final"), replies: [
      { ...comment(5, 1, "de acuerdo"), reply_to_id: 99, reply_to_name: null },
    ] }];
    await page.route("**/api/comments?**", (route) => route.fulfill({ json: threads }));
    await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
    await page.getByRole("button", { name: /1 respuesta/ }).click();
    const card = page.locator("#comentario-5");
    await expect(card).toContainText("@comentario eliminado");
    await expect(card.getByRole("link", { name: /^@/ })).toHaveCount(0);
  });

  test("los comentarios antiguos con «@Nombre» en el texto siguen resaltándose", async ({ page }) => {
    await asFakeUser(page);
    const threads = [{ ...comment(1, null, "Me ha encantado el final"), replies: [comment(2, 1, "A mí también"), comment(6, 1, "@Persona 2 gracias")] }];
    await page.route("**/api/comments?**", (route) => route.fulfill({ json: threads }));
    await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
    await page.getByRole("button", { name: /2 respuestas/ }).click();
    await expect(page.locator("#comentario-6").getByText("@Persona 2", { exact: true })).toBeVisible();
  });

  test("al responder se envía el comentario padre, sin momento, y la respuesta aparece en el hilo", async ({ page }) => {
    await asFakeUser(page);
    const sent: { body: { parentId?: number; timestampRef?: number | null; content?: string } | null } = { body: null };
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sent.body = route.request().postDataJSON();
      return route.fulfill({ json: comment(10, 3, "Totalmente de acuerdo", ME) });
    });
    await openComments(page);

    await page.locator("#comentario-3").getByRole("button", { name: /Responder/ }).click(); // al comentario 3 («Muy buena animación»)
    await expect(page.getByRole("button", { name: /Añadir momento/ })).toHaveCount(1); // solo el formulario principal lo ofrece
    await page.getByRole("textbox", { name: "Tu respuesta" }).fill("Totalmente de acuerdo");
    await page.getByRole("button", { name: "Publicar", exact: true }).last().click();

    await expect.poll(() => sent.body?.parentId).toBe(3);
    expect(sent.body?.timestampRef ?? null).toBeNull();
    await expect(page.getByText("Totalmente de acuerdo")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^4 comentarios$/ })).toBeVisible();
  });

  test("si el comentario ya no existe, se explica y no se añade nada", async ({ page }) => {
    await asFakeUser(page);
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 404, json: { error: "parent_invalid", reason: "deleted" } });
    });
    await openComments(page);

    await page.getByRole("button", { name: /Responder/ }).first().click();
    await page.getByRole("textbox", { name: "Tu respuesta" }).fill("¿Sigues ahí?");
    await page.getByRole("button", { name: "Publicar", exact: true }).last().click();

    await expect(page.getByText(/no se puede responder a este comentario/i)).toBeVisible();
    await expect(page.getByText("¿Sigues ahí?", { exact: true })).toHaveCount(1); // solo el texto del campo, no un comentario nuevo
    await expect(page.getByRole("heading", { name: /^3 comentarios$/ })).toBeVisible();
  });

  test("si la API falla, se muestra un error genérico sin datos internos", async ({ page }) => {
    await asFakeUser(page);
    await page.route("**/api/comments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 500, json: { error: "server_error" } });
    });
    await openComments(page);
    await page.getByRole("textbox", { name: "Tu comentario" }).fill("Hola");
    await page.getByRole("button", { name: "Publicar", exact: true }).first().click();
    await expect(page.getByText("No se pudo publicar tu comentario. Inténtalo de nuevo.")).toBeVisible();
  });
});

test("los comentarios muestran la foto de perfil del autor y, si no carga, su inicial", async ({ page }) => {
  const withPhotos = [
    { ...comment(1, null, "Con foto"), display_name: "Ana", avatar_url: "https://lh3.googleusercontent.com/a/ana.svg" },
    { ...comment(2, null, "Foto rota"), display_name: "Beto", avatar_url: "https://lh3.googleusercontent.com/a/rota.png" },
    { ...comment(3, null, "Sin foto"), display_name: "Carla", avatar_url: null },
  ];
  await page.route("https://lh3.googleusercontent.com/a/ana.svg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><rect width="45" height="45" fill="#2a6"/></svg>' }),
  );
  await page.route("https://lh3.googleusercontent.com/a/rota.png", (route) => route.abort());
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.route("**/api/comments?**", (route) => route.fulfill({ json: withPhotos }));
  await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
  await page.getByText("Con foto", { exact: true }).waitFor();

  await expect(page.locator("img[src='https://lh3.googleusercontent.com/a/ana.svg']")).toBeVisible();
  await expect(page.locator("img[src='https://lh3.googleusercontent.com/a/rota.png']")).toHaveCount(0); // al fallar la imagen se vuelve a la inicial
  await expect(page.getByText("B", { exact: true })).toBeVisible();
  await expect(page.getByText("C", { exact: true })).toBeVisible();
  await expect(page.getByText("A", { exact: true })).toHaveCount(0); // Ana tiene foto: no se muestra su inicial
});

test("el avatar elegido en el selector de perfiles (icono o foto propia) se ve en los comentarios", async ({ page }) => {
  const rows = [
    { ...comment(1, null, "Con icono"), display_name: "Babadoke", avatar_icon_id: "cat", avatar_color: "yellow" },
    { ...comment(2, null, "Con foto propia"), display_name: "Perfil 2", avatar_url: "/avatars-svg/avatar-panda.svg", avatar_color: "purple" },
  ];
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.route("**/api/comments?**", (route) => route.fulfill({ json: rows }));
  await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
  await page.getByText("Con icono", { exact: true }).waitFor();

  await expect(page.locator("img[src='/avatars-svg/avatar-cat.svg']")).toBeVisible();
  await expect(page.locator("[id^='comentario-']", { hasText: "Con foto propia" }).locator("img[src='/avatars-svg/avatar-panda.svg']")).toBeVisible();
  await expect(page.getByText("B", { exact: true })).toHaveCount(0); // con icono no se muestra la inicial
});

test("las valoraciones muestran el avatar del perfil con el que se valoró", async ({ page }) => {
  const review = (n: number, extra: Record<string, unknown>) => ({
    userId: `3333333${n}-3333-4333-8333-333333333333`, profileId: "", displayName: `Autor ${n}`, avatarUrl: null, avatarIconId: null,
    avatarColor: "green", score: 8, comment: `Valoración ${n}`, ratedAt: new Date().toISOString(), likeCount: 0, likedByMe: false, ...extra,
  });
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.route("**/api/ratings/community?**", (route) =>
    route.fulfill({
      json: {
        reviews: [review(1, { avatarIconId: "panda", avatarColor: "blue" }), review(2, { avatarUrl: "/avatars-svg/avatar-cat.svg" }), review(3, {})],
        avgScore: 8, voteCount: 3, total: 3, hasMore: false,
      },
    }),
  );
  await page.goto(`${FICHA}#valoraciones`, { waitUntil: "load" });
  await page.getByText("Valoración 1").waitFor();
  await expect(page.locator("img[src='/avatars-svg/avatar-panda.svg']")).toBeVisible();
  await expect(page.locator("img[src='/avatars-svg/avatar-cat.svg']")).toBeVisible();
  await expect(page.getByText("A", { exact: true })).toBeVisible(); // «Autor 3»: sin foto ni icono, su inicial
});

test("un invitado no ve el formulario ni los botones de responder", async ({ page }) => {
  await page.context().addCookies([{ name: "gma_guest", value: "1", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  await page.route("**/api/comments?**", (route) => route.fulfill({ json: THREADS }));
  await page.goto(`${FICHA}#comentarios`, { waitUntil: "load" });
  await page.getByText("Me ha encantado el final").waitFor();
  await expect(page.getByRole("button", { name: /Responder/ })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Tu comentario" })).toHaveCount(0);
});
