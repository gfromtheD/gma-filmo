import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { loadAuthors } from "@/lib/profiles/author-lookup";
import { authorKey } from "@/lib/profiles/author-avatar";
import { paginateReviews, parseReviewQuery, sortReviews } from "@/lib/ratings/review-query";

export async function GET(request: Request) {
  const peliculaId = new URL(request.url).searchParams.get("peliculaId");
  if (!peliculaId || isNaN(Number(peliculaId))) {
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/community`, 60)) {
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0 }, { status: 429 });
  }

  const admin = getSupabaseAdminClient();
  const pid   = Number(peliculaId);
  // Parámetros opcionales (limit, offset, sort). Sin ellos: 5 reseñas, orden "top" (comportamiento histórico).
  const query = parseReviewQuery(new URL(request.url).searchParams);

  // All ratings + all likes for this film in parallel
  const [{ data: ratings, error }, { data: allLikes }] = await Promise.all([
    admin
      .from("ratings")
      .select("user_id, profile_id, score, comment, rated_at")
      .eq("pelicula_id", pid)
      .gt("score", 0)
      .order("rated_at", { ascending: false }),
    admin
      .from("review_likes")
      .select("reviewer_user_id, liker_user_id")
      .eq("pelicula_id", pid),
  ]);

  if (error) {
    console.error("[api/ratings/community GET]", error.code, error.message);
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0, total: 0, hasMore: false });
  }
  if (!ratings?.length) {
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0, total: 0, hasMore: false });
  }

  // Build like count map and current-user like set
  const likeCountMap = new Map<string, number>();
  for (const l of allLikes ?? []) {
    likeCountMap.set(l.reviewer_user_id, (likeCountMap.get(l.reviewer_user_id) ?? 0) + 1);
  }

  const currentUserId = await getUserId(request);
  const myLikedSet    = new Set<string>();
  if (currentUserId) {
    for (const l of allLikes ?? []) {
      if (l.liker_user_id === currentUserId) myLikedSet.add(l.reviewer_user_id);
    }
  }

  // Nombre, foto o icono y color actuales del perfil con el que valoró cada autor.
  const authors = await loadAuthors(ratings);

  // Build reviews: only those with a comment (orden y paginación según la consulta)
  const withComment = ratings
    .filter((r) => r.comment?.trim())
    .map((r) => {
      const author = authors[authorKey(r.user_id, r.profile_id)];
      return {
        userId:       r.user_id,
        profileId:    r.profile_id ?? "",
        displayName:  author?.displayName ?? "Usuario",
        avatarUrl:    author?.avatarUrl ?? null,
        avatarIconId: author?.avatarIconId ?? null,
        avatarColor:  author?.avatarColor ?? null,
        score:        Math.round(r.score * 2),
        comment:      r.comment,
        ratedAt:      r.rated_at,
        likeCount:    likeCountMap.get(r.user_id) ?? 0,
        likedByMe:    myLikedSet.has(r.user_id),
      };
    });
  const { page: reviews, total, hasMore } = paginateReviews(sortReviews(withComment, query.sort), query);

  const avgRaw   = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  const avgScore = Math.round(avgRaw * 2 * 10) / 10;

  return NextResponse.json({ reviews, avgScore, voteCount: ratings.length, total, hasMore });
}
