import { expect, test } from "@playwright/test";
import {
  DEFAULT_REVIEW_LIMIT,
  MAX_REVIEW_LIMIT,
  paginateReviews,
  parseReviewQuery,
  sortReviews,
} from "../../lib/ratings/review-query";

const review = (id: string, likeCount: number, ratedAt: string) => ({ id, likeCount, ratedAt });

test("sin parámetros se conserva el comportamiento histórico", () => {
  expect(parseReviewQuery(new URLSearchParams())).toEqual({ limit: DEFAULT_REVIEW_LIMIT, offset: 0, sort: "top" });
});

test("limit y offset se acotan y los valores inválidos caen al valor por defecto", () => {
  const q = (s: string) => parseReviewQuery(new URLSearchParams(s));
  expect(q("limit=10&offset=20")).toMatchObject({ limit: 10, offset: 20 });
  expect(q("limit=9999").limit).toBe(MAX_REVIEW_LIMIT);
  expect(q("limit=0").limit).toBe(1);
  expect(q("limit=-4").limit).toBe(1);
  expect(q("limit=abc").limit).toBe(DEFAULT_REVIEW_LIMIT);
  expect(q("limit=2.5").limit).toBe(DEFAULT_REVIEW_LIMIT);
  expect(q("offset=-3").offset).toBe(0);
  expect(q("offset=x").offset).toBe(0);
  expect(q("sort=recent").sort).toBe("recent");
  expect(q("sort=lo-que-sea").sort).toBe("top");
});

test("orden 'top': más 'De acuerdo' primero, desempate por fecha; no muta la entrada", () => {
  const input = [
    review("a", 1, "2026-01-01T00:00:00Z"),
    review("b", 3, "2026-01-02T00:00:00Z"),
    review("c", 3, "2026-01-05T00:00:00Z"),
    review("d", 0, "2026-02-01T00:00:00Z"),
  ];
  const snapshot = JSON.stringify(input);
  expect(sortReviews(input, "top").map((r) => r.id)).toEqual(["c", "b", "a", "d"]);
  expect(JSON.stringify(input)).toBe(snapshot);
});

test("orden 'recent': por fecha descendente sin importar los 'De acuerdo'", () => {
  const input = [review("a", 9, "2026-01-01T00:00:00Z"), review("b", 0, "2026-03-01T00:00:00Z")];
  expect(sortReviews(input, "recent").map((r) => r.id)).toEqual(["b", "a"]);
});

test("paginación: páginas consecutivas no repiten ni pierden elementos", () => {
  const all = Array.from({ length: 23 }, (_, i) => i);
  const first = paginateReviews(all, { limit: 10, offset: 0 });
  const second = paginateReviews(all, { limit: 10, offset: 10 });
  const third = paginateReviews(all, { limit: 10, offset: 20 });
  expect([...first.page, ...second.page, ...third.page]).toEqual(all);
  expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
  expect(third.total).toBe(23);
  expect(paginateReviews(all, { limit: 10, offset: 99 })).toEqual({ page: [], total: 23, hasMore: false });
  expect(paginateReviews([], { limit: 5, offset: 0 })).toEqual({ page: [], total: 0, hasMore: false });
});
