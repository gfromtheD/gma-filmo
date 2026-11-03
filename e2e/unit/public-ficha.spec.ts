import { expect, test } from "@playwright/test";
import { hasPublicContent, toPublicFicha } from "../../lib/media/public-ficha";

const ficha = (patch: Record<string, unknown> = {}) => ({
  originalTitle: "", durationMinutes: 12, productionCountry: "", releaseYear: 2025, categories: [], ageRating: "", firstFilm: false,
  language: "", synopsisShort: "x", synopsisLong: "y", genres: [], themes: [], team: [], awards: [], ai: { used: false, note: "" },
  allowComments: true, subtitleLanguages: [], extras: [], acceptedTerms: true, ...patch,
});

test.describe("ficha pública (lo que se enseña de la ficha del creador)", () => {
  test("traduce país e idiomas a su nombre en español y quita vacíos y repetidos", () => {
    const result = toPublicFicha(ficha({ productionCountry: "ES", language: "es", subtitleLanguages: ["en", "en", "fr"], themes: [" memoria ", "memoria", "", "exilio"] }));
    expect(result?.country).toBe("España");
    expect(result?.language?.toLowerCase()).toContain("espa");
    expect(result?.subtitleLanguages).toHaveLength(2);
    expect(result?.themes).toEqual(["memoria", "exilio"]);
  });

  test("no deja pasar lo privado: condiciones, permiso de comentarios ni la nota sobre IA", () => {
    const result = toPublicFicha(ficha({ ai: { used: true, note: "nota interna" }, firstFilm: true }));
    expect(JSON.stringify(result)).not.toContain("nota interna");
    expect(result).not.toHaveProperty("acceptedTerms");
    expect(result).not.toHaveProperty("allowComments");
    expect(result?.usesAi).toBe(true);
    expect(result?.firstFilm).toBe(true);
  });

  test("una ficha sin nada que mostrar, o inválida, no genera tarjetas", () => {
    expect(toPublicFicha(ficha())).toBeNull();
    expect(toPublicFicha({ title: "no es una ficha" })).toBeNull();
    expect(toPublicFicha(null)).toBeNull();
  });

  test("los premios sin festival ni premio se descartan", () => {
    const result = toPublicFicha(ficha({ awards: [{ festival: "Gijón", award: "Mejor corto" }, { festival: " ", award: " " }] }));
    expect(result?.awards).toEqual([{ festival: "Gijón", award: "Mejor corto" }]);
    expect(result && hasPublicContent(result)).toBe(true);
  });
});
