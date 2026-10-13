/**
 * Parámetros de listado de reseñas de /api/ratings/community.
 * Todo es opcional: sin parámetros se conserva el comportamiento histórico
 * (5 reseñas, ordenadas por "De acuerdo" y luego por fecha).
 */

export type ReviewSort = "top" | "recent";

export const DEFAULT_REVIEW_LIMIT = 5;
export const MAX_REVIEW_LIMIT = 50;

export interface ReviewQuery {
  readonly limit: number;
  readonly offset: number;
  readonly sort: ReviewSort;
}

export interface ReviewPage<T> {
  readonly page: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
}

function toInt(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function parseReviewQuery(params: URLSearchParams): ReviewQuery {
  const limit = Math.min(Math.max(toInt(params.get("limit"), DEFAULT_REVIEW_LIMIT), 1), MAX_REVIEW_LIMIT);
  const offset = Math.max(toInt(params.get("offset"), 0), 0);
  const sort: ReviewSort = params.get("sort") === "recent" ? "recent" : "top";
  return { limit, offset, sort };
}

interface Sortable {
  readonly likeCount: number;
  readonly ratedAt: string;
}

/** Devuelve una copia ordenada; no modifica la lista original. */
export function sortReviews<T extends Sortable>(reviews: readonly T[], sort: ReviewSort): T[] {
  const byRecency = (a: T, b: T) => new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime();
  const copy = [...reviews];
  return sort === "recent" ? copy.sort(byRecency) : copy.sort((a, b) => b.likeCount - a.likeCount || byRecency(a, b));
}

export function paginateReviews<T>(
  reviews: readonly T[],
  query: Pick<ReviewQuery, "limit" | "offset">,
): ReviewPage<T> {
  const page = reviews.slice(query.offset, query.offset + query.limit);
  return { page, total: reviews.length, hasMore: query.offset + page.length < reviews.length };
}
