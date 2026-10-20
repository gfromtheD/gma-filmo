import { expect, test } from "@playwright/test";
import { isRevealActive, revealedAmount, snapTarget } from "../../lib/footer-reveal";

const FULL = 400;
const PEEK = 80;

test.describe("pie en dos fases", () => {
  test("cuánto se ve del pie: nada, un trozo o entero", () => {
    expect(revealedAmount({ viewportHeight: 900, zoneTop: 1000, footerHeight: FULL })).toBe(0);
    expect(revealedAmount({ viewportHeight: 900, zoneTop: 820, footerHeight: FULL })).toBe(80);
    expect(revealedAmount({ viewportHeight: 900, zoneTop: 100, footerHeight: FULL })).toBe(FULL);
  });

  test("bajando, la franja de abajo se completa y, si sigues, se completa el pie entero", () => {
    expect(snapTarget({ amount: 30, peek: PEEK, full: FULL, direction: "down" })).toBe(PEEK);
    expect(snapTarget({ amount: 200, peek: PEEK, full: FULL, direction: "down" })).toBe(FULL);
  });

  test("subiendo, vuelve a la franja y de ahí a nada", () => {
    expect(snapTarget({ amount: 200, peek: PEEK, full: FULL, direction: "up" })).toBe(PEEK);
    expect(snapTarget({ amount: 30, peek: PEEK, full: FULL, direction: "up" })).toBe(0);
  });

  test("en una fase ya completa no hay nada que ajustar", () => {
    for (const amount of [0, PEEK, FULL, PEEK + 1, FULL - 1]) {
      expect(snapTarget({ amount, peek: PEEK, full: FULL, direction: "down" })).toBeNull();
    }
    expect(snapTarget({ amount: 0, peek: PEEK, full: FULL, direction: "up" })).toBeNull();
  });

  test("si el pie no tiene fase extra, solo hay dos estados: nada o entero", () => {
    expect(snapTarget({ amount: 100, peek: FULL, full: FULL, direction: "down" })).toBe(FULL);
    expect(snapTarget({ amount: 100, peek: FULL, full: FULL, direction: "up" })).toBe(0);
  });

  test("el efecto se activa solo si el pie cabe, hay movimiento normal y no asoma a medias al cargar", () => {
    const base = { viewportHeight: 900, footerHeight: FULL, zoneDocumentTop: 1500, prefersReducedMotion: false };
    expect(isRevealActive(base)).toBe(true);
    expect(isRevealActive({ ...base, prefersReducedMotion: true })).toBe(false);
    expect(isRevealActive({ ...base, footerHeight: 950 })).toBe(false); // no cabe en la ventana
    expect(isRevealActive({ ...base, zoneDocumentTop: 700 })).toBe(false); // a medias en la primera pantalla
    expect(isRevealActive({ ...base, zoneDocumentTop: 400 })).toBe(true); // página corta: se ve entero
  });
});
