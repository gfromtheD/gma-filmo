import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

type LikeRow = { user_id: string };

export async function GET(request: Request) {
  const peliculaId = new URL(request.url).searchParams.get("peliculaId");
  if (!peliculaId || isNaN(Number(peliculaId))) return NextResponse.json([]);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/comments-get`, 60)) return NextResponse.json([], { status: 429 });

  const admin  = getSupabaseAdminClient();
  const pid    = Number(peliculaId);
  const userId = await getUserId(request);

  const { data: all } = await admin
    .from("comments")
    .select("*, comment_likes(user_id)")
    .eq("pelicula_id", pid)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (!all?.length) return NextResponse.json([]);

  const topLevel = all
    .filter((c) => c.parent_id === null)
    .map((c) => ({
      ...c,
      liked_by_me:   (c.comment_likes as LikeRow[]).some((l) => l.user_id === userId),
      comment_likes: undefined,
      replies: all
        .filter((r) => r.parent_id === c.id)
        .map((r) => ({
          ...r,
          liked_by_me:   (r.comment_likes as LikeRow[]).some((l) => l.user_id === userId),
          comment_likes: undefined,
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }))
    .sort((a, b) =>
      b.like_count - a.like_count ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  return NextResponse.json(topLevel);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/comments-post`, 10)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    peliculaId:    number;
    content:       string;
    timestampRef?: number | null;
    parentId?:     number | null;
  };
  const { peliculaId, content, timestampRef, parentId } = body;

  if (!peliculaId || !content?.trim()) {
    return NextResponse.json({ error: "peliculaId and content required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_color")
    .eq("id", userId)
    .single();

  const { data, error } = await admin
    .from("comments")
    .insert({
      pelicula_id:   peliculaId,
      user_id:       userId,
      display_name:  profile?.display_name ?? "Usuario",
      avatar_color:  profile?.avatar_color ?? null,
      parent_id:     parentId ?? null,
      content:       content.trim().slice(0, 1000),
      timestamp_ref: typeof timestampRef === "number" ? timestampRef : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, liked_by_me: false, replies: [] });
}
