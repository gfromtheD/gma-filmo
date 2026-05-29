import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rate-limit";

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

  const { data: ratings, error } = await admin
    .from("ratings")
    .select("user_id, score, comment, rated_at")
    .eq("pelicula_id", Number(peliculaId))
    .gt("score", 0)
    .order("rated_at", { ascending: false });

  if (error) {
    console.error("[api/ratings/community GET]", error.code, error.message);
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0 });
  }
  if (!ratings?.length) {
    return NextResponse.json({ reviews: [], avgScore: null, voteCount: 0 });
  }

  const userIds = [...new Set(ratings.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) nameMap.set(p.id, p.display_name);

  const reviews = ratings
    .filter((r) => r.comment?.trim())
    .map((r) => ({
      displayName: nameMap.get(r.user_id) ?? "Usuario",
      score:       Math.round(r.score * 2),
      comment:     r.comment,
      ratedAt:     r.rated_at,
    }));

  const avgRaw   = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  const avgScore = Math.round(avgRaw * 2 * 10) / 10;

  return NextResponse.json({ reviews, avgScore, voteCount: ratings.length });
}
