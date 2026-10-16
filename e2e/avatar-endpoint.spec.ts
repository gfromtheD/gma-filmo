import { expect, test } from "@playwright/test";

/**
 * Endpoint de imágenes de avatar (`/api/avatar`): validación de parámetros y respuestas de error.
 * (La entrega de una imagen real depende de datos de la base de datos; su decodificación y sus
 * límites se cubren en los tests unitarios de `lib/profiles/avatar.ts`.)
 */
const COOKIE = { name: "gma_guest", value: "1" };

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ ...COOKIE, url: baseURL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
});

test("una cuenta que no es un UUID se rechaza con 400", async ({ context }) => {
  const response = await context.request.get("/api/avatar?u=no-es-un-uuid&p=");
  expect(response.status()).toBe(400);
});

test("un perfil con un identificador demasiado largo se rechaza con 400", async ({ context }) => {
  const response = await context.request.get(`/api/avatar?u=2679de6b-50b8-4f3a-b679-aae057ed2b7d&p=${"x".repeat(65)}`);
  expect(response.status()).toBe(400);
});

test("sin imagen subida (cuenta o perfil inexistente) responde 404 y sin contenido", async ({ context }) => {
  const missing = await context.request.get("/api/avatar?u=00000000-0000-4000-8000-000000000000&p=");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toBe("");
  const noSub = await context.request.get("/api/avatar?u=00000000-0000-4000-8000-000000000000&p=p_inexistente");
  expect(noSub.status()).toBe(404);
});

test("una cuenta sin avatar propio subido tampoco devuelve imagen", async ({ context }) => {
  const response = await context.request.get("/api/avatar?u=2679de6b-50b8-4f3a-b679-aae057ed2b7d&p=");
  expect(response.status()).toBe(404);
});
