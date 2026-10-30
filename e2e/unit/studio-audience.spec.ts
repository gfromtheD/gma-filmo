import { test, expect } from "@playwright/test";
import { applyAudience } from "../../lib/studio/audience";
import { STUDIO_DATA } from "../../components/features/studio/studio-data";
import type { StudioData, StudioTitle } from "../../components/features/studio/studio-types";

const title = (id: string): StudioTitle => ({ id, title: id } as StudioTitle);
const base = (ids: string[]): StudioData => ({ ...STUDIO_DATA, titles: ids.map(title) });

test.describe("applyAudience", () => {
  test("pone a cada obra sus espectadores, votos y comentarios", () => {
    const data = applyAudience(base(["a", "b"]), {
      titles: [{ slug: "a", viewers: 3, ratingAvg: 4, ratingCount: 2, comments: 5 }],
      totalViewers: 3, monthly: [{ month: "2026-10", viewers: 3 }],
    });
    expect(data.titles[0]).toMatchObject({ views: 3, rating: 8, ratingCount: 2, comments: 5 });
    expect(data.titles[1]).toMatchObject({ views: 0, ratingCount: 0, comments: 0 });
    expect(data.titles[1]!.rating).toBeUndefined();
  });

  test("el total de espectadores es el de personas distintas, no la suma por obra", () => {
    const data = applyAudience(base(["a", "b"]), {
      titles: [{ slug: "a", viewers: 2, ratingAvg: null, ratingCount: 0, comments: 0 }, { slug: "b", viewers: 2, ratingAvg: null, ratingCount: 0, comments: 0 }],
      totalViewers: 2, monthly: [],
    });
    expect(data.creator.stats.totalViews).toBe(2);
  });

  test("la nota media pondera por votos", () => {
    const data = applyAudience(base(["a", "b"]), {
      titles: [{ slug: "a", viewers: 1, ratingAvg: 5, ratingCount: 1, comments: 0 }, { slug: "b", viewers: 1, ratingAvg: 3, ratingCount: 3, comments: 0 }],
      totalViewers: 2, monthly: [],
    });
    expect(data.creator.stats.avgRating).toBeCloseTo(7);
  });

  test("no muta los datos de entrada", () => {
    const input = base(["a"]);
    applyAudience(input, { titles: [{ slug: "a", viewers: 9, ratingAvg: null, ratingCount: 0, comments: 0 }], totalViewers: 9, monthly: [] });
    expect(input.titles[0]!.views).toBeUndefined();
  });
});
