import { expect, test } from "@playwright/test";
import { aplicarPreferencia, retrasoSubida, techoPara } from "../../lib/media/quality-governor";

test.describe("reparto de la calidad según la carga", () => {
  test("con sitio, máxima calidad para todos", () => {
    expect(techoPara("alta", { nuevo: true, alturaActual: null })).toBe(Infinity);
    expect(techoPara("alta", { nuevo: false, alturaActual: 360 })).toBe(Infinity);
  });

  test("red apretada: los nuevos a 720p y quien ya ve en 1080p no pierde calidad", () => {
    expect(techoPara("media", { nuevo: true, alturaActual: null })).toBe(720);
    expect(techoPara("media", { nuevo: false, alturaActual: 1080 })).toBe(1080);
    expect(techoPara("media", { nuevo: false, alturaActual: 360 })).toBe(720);
  });

  test("red al límite: los nuevos a 360p y quien estaba en 1080p baja a 720p", () => {
    expect(techoPara("baja", { nuevo: true, alturaActual: null })).toBe(360);
    expect(techoPara("baja", { nuevo: false, alturaActual: 1080 })).toBe(720);
    expect(techoPara("baja", { nuevo: false, alturaActual: 360 })).toBe(360);
  });

  test("una elección manual sin sitio espera y no corta el vídeo", () => {
    expect(aplicarPreferencia(720, 1080)).toEqual({ altura: 720, esperando: true });
    expect(aplicarPreferencia(Infinity, 1080)).toEqual({ altura: 1080, esperando: false });
    expect(aplicarPreferencia(720, "auto")).toEqual({ altura: 720, esperando: false });
  });

  test("al liberarse, sube antes quien más tiempo lleva en baja calidad", () => {
    expect(retrasoSubida(2 * 60_000, 0.5)).toBeLessThan(retrasoSubida(10_000, 0.5));
    expect(retrasoSubida(5 * 60_000, 0.5)).toBe(0);
  });
});
