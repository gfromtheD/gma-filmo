import { expect, test } from "@playwright/test";
import { SHORT_SYNOPSIS_MAX, shortSynopsis } from "../../lib/detail/short-synopsis";

test.describe("shortSynopsis (frase corta de la cabecera)", () => {
  test("usa la frase corta del creador si existe", () => {
    expect(shortSynopsis("Un texto largo ".repeat(30), "Una frase corta.")).toBe("Una frase corta.");
  });

  test("ignora una frase corta vacía o solo con espacios", () => {
    expect(shortSynopsis("Sinopsis breve.", "   ")).toBe("Sinopsis breve.");
  });

  test("si la sinopsis ya es corta se muestra entera", () => {
    expect(shortSynopsis("Una historia breve.", undefined)).toBe("Una historia breve.");
  });

  test("si es larga y no hay frase corta, se queda con las primeras frases que quepan", () => {
    const text = "Primera frase del corto. Segunda frase con más detalle sobre la trama. " + "Y luego mucho más texto. ".repeat(20);
    const result = shortSynopsis(text, undefined);
    expect(result.length).toBeLessThanOrEqual(SHORT_SYNOPSIS_MAX);
    expect(result.startsWith("Primera frase del corto.")).toBe(true);
    expect(result.endsWith(".")).toBe(true);
  });

  test("si la primera frase ya es demasiado larga, corta por palabra y añade puntos suspensivos", () => {
    const result = shortSynopsis("palabra ".repeat(80).trim(), undefined);
    expect(result.length).toBeLessThanOrEqual(SHORT_SYNOPSIS_MAX);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/palabr…$/);
  });

  test("sin texto devuelve cadena vacía", () => {
    expect(shortSynopsis("", undefined)).toBe("");
  });
});
