import { expect, test } from "@playwright/test";
import { rateLimit, rateLimitCheck } from "../../lib/api/rate-limit";

let counter = 0;
const uniqueKey = () => `test/${Date.now()}/${counter++}`;

test("permite hasta el límite y bloquea a partir de ahí", () => {
  const key = uniqueKey();
  for (let i = 0; i < 5; i++) expect(rateLimitCheck(key, 5).allowed).toBe(true);
  expect(rateLimitCheck(key, 5).allowed).toBe(false);
});

test("al bloquear indica cuántos segundos faltan para poder volver a intentarlo", () => {
  const key = uniqueKey();
  rateLimitCheck(key, 1, 60_000, 1_000);
  const blocked = rateLimitCheck(key, 1, 60_000, 21_000);
  expect(blocked.allowed).toBe(false);
  expect(blocked.retryAfterSeconds).toBe(40);
});

test("pasada la ventana vuelve a permitir", () => {
  const key = uniqueKey();
  rateLimitCheck(key, 1, 1_000, 0);
  expect(rateLimitCheck(key, 1, 1_000, 500).allowed).toBe(false);
  expect(rateLimitCheck(key, 1, 1_000, 1_001).allowed).toBe(true);
});

test("el retraso nunca baja de 1 segundo", () => {
  const key = uniqueKey();
  rateLimitCheck(key, 1, 60_000, 0);
  expect(rateLimitCheck(key, 1, 60_000, 59_999).retryAfterSeconds).toBe(1);
});

test("rateLimit sigue devolviendo solo un booleano (resto de la API)", () => {
  const key = uniqueKey();
  expect(rateLimit(key, 1)).toBe(true);
  expect(rateLimit(key, 1)).toBe(false);
});
