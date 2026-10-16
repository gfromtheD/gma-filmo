import { expect, test } from "@playwright/test";
import {
  REFERENCE_IMAGE_WIDTH,
  carouselColumns,
  carouselPadLeft,
  carouselSlotWidth,
  topTenScale,
} from "../../lib/home/carousel-geometry";

test.describe("carouselColumns (N tarjetas completas + un trozo)", () => {
  test("2 en tableta, 3 desde 1000 px y 4 desde 1500 px", () => {
    expect(carouselColumns(767)).toBeNull(); // móvil: no usa esta regla
    expect(carouselColumns(768)).toBe(2);
    expect(carouselColumns(999)).toBe(2);
    expect(carouselColumns(1000)).toBe(3);
    expect(carouselColumns(1499)).toBe(3);
    expect(carouselColumns(1500)).toBe(4);
    expect(carouselColumns(2560)).toBe(4);
  });
});

test.describe("carouselPadLeft", () => {
  test("8 px en tableta y 56 px desde 1024 (la portada queda alineada con el título)", () => {
    expect(carouselPadLeft(768)).toBe(8);
    expect(carouselPadLeft(1023)).toBe(8);
    expect(carouselPadLeft(1024)).toBe(56);
    expect(carouselPadLeft(1920)).toBe(56);
  });
});

test.describe("carouselSlotWidth (medido en Filmin: 438 a 1440 px y 448 a 1920 px)", () => {
  test("reparte lo que queda tras el margen entre N tarjetas y el trozo de la siguiente", () => {
    expect(carouselSlotWidth(1440, 1440)).toBeCloseTo(438, 0);
    expect(carouselSlotWidth(1920, 1920)).toBeCloseTo(448, 0);
  });
  test("en móvil no aplica", () => {
    expect(carouselSlotWidth(390, 390)).toBeNull();
  });
});

test.describe("topTenScale (el Top 10 crece lo mismo que las portadas de las demás filas)", () => {
  const imageWidth = (w: number) => (carouselSlotWidth(w, w) ?? 0) - 16;

  test("es el cociente entre la portada de ahora y la de antes (316 px)", () => {
    for (const w of [1024, 1280, 1440, 1600, 1920, 2560]) {
      expect(topTenScale(w, w)).toBeCloseTo(imageWidth(w) / REFERENCE_IMAGE_WIDTH, 5);
    }
  });

  test("a 1440 px crece ~1,34 veces (de 316 a 422 px de portada)", () => {
    expect(topTenScale(1440, 1440)).toBeCloseTo(1.335, 2);
  });

  test("a 1920 px crece ~1,37 veces", () => {
    expect(topTenScale(1920, 1920)).toBeCloseTo(1.367, 2);
  });

  test("la diferencia de tamaño con las demás filas se mantiene: el Top 10 siempre mide 300/178 de su altura", () => {
    for (const w of [1100, 1280, 1440, 1700, 1920]) {
      const topTenHeight = 300 * topTenScale(w, w);
      const imageHeight = (imageWidth(w) * 9) / 16;
      expect(topTenHeight / imageHeight).toBeCloseTo(300 / ((REFERENCE_IMAGE_WIDTH * 9) / 16), 2);
    }
  });

  test("por debajo de 1024 px (formato móvil del Top 10) no cambia", () => {
    expect(topTenScale(1023, 1023)).toBe(1);
    expect(topTenScale(768, 768)).toBe(1);
    expect(topTenScale(390, 390)).toBe(1);
  });

  test("sin medida todavía (0) devuelve 1", () => {
    expect(topTenScale(0, 1440)).toBe(1);
  });
});
