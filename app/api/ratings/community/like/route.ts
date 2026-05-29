import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

const Schema = z.object({
  reviewerUserId: z.string().uuid(),
  peliculaId:     z.number().int().positive(),
});

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/review-like`, 30)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const { reviewerUserId, peliculaId } = parsed.data;

  if (reviewerUserId === userId) {
    return NextResponse.json({ ok: false, error: "Cannot like own review" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from("review_likes")
    .select("id")
    .eq("liker_user_id",    userId)
    .eq("reviewer_user_id", reviewerUserId)
    .eq("pelicula_id",      peliculaId)
    .maybeSingle();

  if (existing) {
    await admin.from("review_likes").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, liked: false });
  }

  await admin.from("review_likes").insert({
    liker_user_id:    userId,
    reviewer_user_id: reviewerUserId,
    pelicula_id:      peliculaId,
  });
  return NextResponse.json({ ok: true, liked: true });
}
