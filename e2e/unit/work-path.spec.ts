import { expect, test } from "@playwright/test";
import { FEATURE_MIN_SECONDS_EXCLUSIVE, durationSeconds, isFeature, workPath } from "../../lib/catalog/work-path";

test("una obra marcada como «Película» va a /peliculas y el resto a /cortos", () => {
  expect(workPath({ id: "la-pelicula", genre: "Película" })).toBe("/peliculas/la-pelicula");
  expect(workPath({ id: "yasha-gozen", genre: "Cortometraje" })).toBe("/cortos/yasha-gozen");
  expect(workPath({ id: "sin-genero" })).toBe("/cortos/sin-genero");
  expect(isFeature({ genre: "Película" })).toBe(true);
  expect(isFeature({ genre: null })).toBe(false);
});

test("el umbral es el de la industria: más de 40 minutos es película", () => {
  expect(FEATURE_MIN_SECONDS_EXCLUSIVE).toBe(40 * 60);
});

test("la duración se lee en el formato antiguo (1h 02m, 9m 40s), en el del motor (62m) y sin dato (Corto)", () => {
  expect(durationSeconds("1h 02m")).toBe(3720);
  expect(durationSeconds("9m 40s")).toBe(580);
  expect(durationSeconds("7m 00s")).toBe(420);
  expect(durationSeconds("62m")).toBe(3720);
  expect(durationSeconds("10s")).toBe(10);
  expect(durationSeconds("0m")).toBeNull();
  expect(durationSeconds("Corto")).toBeNull();
  expect(durationSeconds(null)).toBeNull();
});
