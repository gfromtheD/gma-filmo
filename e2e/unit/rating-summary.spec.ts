import { expect, test } from "@playwright/test";
import { attachCommunityScores, formatCommunityScore, summarizeRatings } from "../../lib/ratings/summary";

test.describe("summarizeRatings (nota media de la gente)", () => {
  test("la nota es la media de las estrellas puesta en escala de 0 a 10 con un decimal", () => {
    const result = summarizeRatings([{ pelicula_id: 1, score: 4 }, { pelicula_id: 1, score: 5 }]);
    expect(result.get(1)).toEqual({ average: 9, votes: 2 });
  });

  test("redondea a un decimal, igual que la ficha", () => {
    const result = summarizeRatings([{ pelicula_id: 1, score: 4.5 }, { pelicula_id: 1, score: 4.5 }, { pelicula_id: 1, score: 5 }]);
    expect(result.get(1)?.average).toBe(9.3); // (4,5+4,5+5)/3 × 2 = 9,33…
  });

  test("con un solo voto, la nota es ese voto", () => {
    expect(summarizeRatings([{ pelicula_id: 7, score: 3.5 }]).get(7)).toEqual({ average: 7, votes: 1 });
  });

  test("cada película tiene su propia media", () => {
    const result = summarizeRatings([
      { pelicula_id: 1, score: 5 },
      { pelicula_id: 2, score: 2 },
      { pelicula_id: 2, score: 3 },
    ]);
    expect(result.get(1)).toEqual({ average: 10, votes: 1 });
    expect(result.get(2)).toEqual({ average: 5, votes: 2 });
  });

  test("ignora las valoraciones vacías (0), negativas o inválidas", () => {
    const rows = [
      { pelicula_id: 1, score: 0 },
      { pelicula_id: 1, score: -2 },
      { pelicula_id: 1, score: Number.NaN },
      { pelicula_id: 1, score: Number.POSITIVE_INFINITY },
      { pelicula_id: 1, score: null as unknown as number },
      { pelicula_id: 1, score: 4 },
    ];
    expect(summarizeRatings(rows).get(1)).toEqual({ average: 8, votes: 1 });
  });

  test("una película sin ninguna valoración válida no aparece", () => {
    const result = summarizeRatings([{ pelicula_id: 3, score: 0 }]);
    expect(result.has(3)).toBe(false);
    expect(result.size).toBe(0);
  });

  test("nunca pasa de 10 aunque llegue una estrella de más", () => {
    expect(summarizeRatings([{ pelicula_id: 1, score: 9 }]).get(1)?.average).toBe(10);
  });

  test("sin datos devuelve un mapa vacío", () => {
    expect(summarizeRatings([]).size).toBe(0);
  });
});

test.describe("formatCommunityScore", () => {
  test("siempre con un decimal", () => {
    expect(formatCommunityScore(8)).toBe("8.0");
    expect(formatCommunityScore(9.3)).toBe("9.3");
    expect(formatCommunityScore(7.25)).toBe("7.3");
  });
  test("se queda entre 0 y 10", () => {
    expect(formatCommunityScore(12)).toBe("10.0");
    expect(formatCommunityScore(-1)).toBe("0.0");
  });
});

test.describe("attachCommunityScores", () => {
  const items = [{ numericId: 1, title: "A" }, { numericId: 2, title: "B" }];

  test("añade la nota solo a los títulos que tienen votos", () => {
    const summaries = summarizeRatings([{ pelicula_id: 2, score: 4 }]);
    const result = attachCommunityScores(items, summaries);
    expect(result[0]).toEqual({ numericId: 1, title: "A" });
    expect(result[1]).toEqual({ numericId: 2, title: "B", communityScore: { average: 8, votes: 1 } });
  });

  test("no modifica la lista original", () => {
    const copy = JSON.stringify(items);
    attachCommunityScores(items, summarizeRatings([{ pelicula_id: 1, score: 5 }]));
    expect(JSON.stringify(items)).toBe(copy);
  });

  test("cuando empiezan a llegar valoraciones, la nota aparece sola", () => {
    expect(attachCommunityScores(items, summarizeRatings([]))[0]).not.toHaveProperty("communityScore");
    const later = attachCommunityScores(items, summarizeRatings([{ pelicula_id: 1, score: 4.5 }]));
    expect(later[0]).toHaveProperty("communityScore");
  });
});
