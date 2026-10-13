import { expect, test } from "@playwright/test";
import { SCORES, formatReviewDate, scoreLabel, starsToScore } from "../../lib/ratings/score-format";

test("la escala es 1–10 y cada nota tiene etiqueta", () => {
  expect(SCORES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const s of SCORES) expect(scoreLabel(s).length).toBeGreaterThan(0);
  expect(scoreLabel(0)).toBe("");
  expect(scoreLabel(11)).toBe("");
});

test("estrellas guardadas ↔ nota: ida y vuelta sin pérdida (0,5–5 → 1–10)", () => {
  for (const score of SCORES) expect(starsToScore(score / 2)).toBe(score);
  expect(starsToScore(0)).toBe(1);
  expect(starsToScore(9)).toBe(10);
});

test("la fecha se muestra como '12 OCTUBRE 2026' y tolera valores inválidos", () => {
  expect(formatReviewDate("2026-10-12T10:00:00Z")).toBe("12 OCTUBRE 2026");
  expect(formatReviewDate("2026-01-05T12:00:00Z")).toBe("5 ENERO 2026");
  expect(formatReviewDate("no-es-una-fecha")).toBe("");
});
