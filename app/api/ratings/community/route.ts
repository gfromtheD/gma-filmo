import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

const MAX_REVIEWS = 5;

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

  // All ratings + all likes for this film in parallel
  const [{ data: ratings, error }, { data: allLikes }] = await Promise.all([
    admin
      .from("ratings")
      .select("user_id, score, comment, rated_at")
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
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0 });
  }
  if (!ratings?.length) {
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0 });
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

  // Resolve display names
  const userIds = [...new Set(ratings.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) nameMap.set(p.id, p.display_name);

  // Build reviews: only those with a comment, sorted by likes then recency, max 5
  const reviews = ratings
    .filter((r) => r.comment?.trim())
    .map((r) => ({
      userId:      r.user_id,
      displayName: nameMap.get(r.user_id) ?? "Usuario",
      score:       Math.round(r.score * 2),
      comment:     r.comment,
      ratedAt:     r.rated_at,
      likeCount:   likeCountMap.get(r.user_id) ?? 0,
      likedByMe:   myLikedSet.has(r.user_id),
    }))
    .sort((a, b) =>
      b.likeCount - a.likeCount ||
      new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime(),
    )
    .slice(0, MAX_REVIEWS);

  const avgRaw   = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  const avgScore = Math.round(avgRaw * 2 * 10) / 10;

  return NextResponse.json({ reviews, avgScore, voteCount: ratings.length });
}
