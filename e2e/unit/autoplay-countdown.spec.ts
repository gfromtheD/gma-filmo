import { expect, test } from "@playwright/test";
import { AUTOPLAY_WINDOW_SECS, autoplayWindowFor, shouldTickCountdown } from "../../lib/player/autoplay-countdown";

test.describe("cuenta atrás hacia el siguiente título", () => {
  test("en obras largas empieza 10 s antes del final", () => {
    expect(autoplayWindowFor(600)).toBe(AUTOPLAY_WINDOW_SECS);
    expect(autoplayWindowFor(70)).toBe(AUTOPLAY_WINDOW_SECS);
  });

  test("en vídeos cortos la ventana se reduce y nunca pasa del 15 % de la duración", () => {
    expect(autoplayWindowFor(6)).toBeCloseTo(0.9, 5);
    expect(autoplayWindowFor(30)).toBeCloseTo(4.5, 5);
    for (const duration of [1, 6, 15, 30, 66, 120]) {
      expect(autoplayWindowFor(duration)).toBeLessThanOrEqual(duration * 0.15 + 1e-9);
      expect(autoplayWindowFor(duration)).toBeLessThanOrEqual(AUTOPLAY_WINDOW_SECS);
    }
  });

  test("con una duración desconocida o no válida no hay ventana (no se arranca la cuenta atrás)", () => {
    expect(autoplayWindowFor(0)).toBe(0);
    expect(autoplayWindowFor(-5)).toBe(0);
    expect(autoplayWindowFor(Number.NaN)).toBe(0);
    expect(autoplayWindowFor(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test("el contador solo baja mientras el vídeo se reproduce", () => {
    expect(shouldTickCountdown(5, true)).toBe(true);
    expect(shouldTickCountdown(5, false)).toBe(false);
  });

  test("no baja si no hay cuenta atrás o ya llegó a cero", () => {
    expect(shouldTickCountdown(null, true)).toBe(false);
    expect(shouldTickCountdown(0, true)).toBe(false);
  });
});
