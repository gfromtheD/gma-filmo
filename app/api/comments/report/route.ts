import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/comment-report`, 5)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { commentId?: unknown } | null;
  const commentId = Number(body?.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid commentId" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("id, user_id")
    .eq("id", commentId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (!comment) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (comment.user_id === userId) {
    return NextResponse.json({ ok: false, error: "Cannot report own comment" }, { status: 400 });
  }

  const { error } = await admin.from("comment_reports").insert({ comment_id: commentId, reporter_id: userId });
  // Denunciar dos veces el mismo comentario cuenta como éxito (ya está denunciado).
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("[comment-report] insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save report" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
