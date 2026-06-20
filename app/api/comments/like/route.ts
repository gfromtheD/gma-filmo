import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/comment-like`, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await request.json() as { commentId: number };
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: c } = await admin
    .from("comments")
    .select("like_count")
    .eq("id", commentId)
    .single();

  if (existing) {
    await admin.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
    await admin.from("comments").update({ like_count: Math.max(0, (c?.like_count ?? 1) - 1) }).eq("id", commentId);
    return NextResponse.json({ liked: false });
  } else {
    await admin.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
    await admin.from("comments").update({ like_count: (c?.like_count ?? 0) + 1 }).eq("id", commentId);
    return NextResponse.json({ liked: true });
  }
}
