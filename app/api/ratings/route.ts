import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

const PostSchema = z.object({
  peliculaId: z.number().int().positive(),
  score:      z.number().min(0).max(5),
  comment:    z.string().max(2000).default(""),
  profileId:  z.string().max(64).default(""),
});

const DeleteSchema = z.object({
  peliculaId: z.number().int().positive(),
  profileId:  z.string().max(64).default(""),
});

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/ratings/read`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";

  const { data, error } = await getSupabaseAdminClient()
    .from("ratings")
    .select("pelicula_id, score, comment, rated_at, profile_id")
    .eq("user_id",    userId)
    .eq("profile_id", profileId);

  if (error) {
    console.error("[api/ratings GET]", error.code, error.message);
    return NextResponse.json({ entries: [], error: error.message });
  }
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/ratings/write`, 20)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const parsed = PostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  const { peliculaId, score, comment, profileId } = parsed.data;

  const { error } = await getSupabaseAdminClient()
    .from("ratings")
    .upsert(
      {
        user_id:    userId,
        profile_id: profileId,
        pelicula_id: peliculaId,
        score,
        comment,
        rated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,profile_id,pelicula_id" },
    );

  if (error) {
    console.error("[api/ratings POST]", error.code, error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/ratings/write`, 20)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  const { peliculaId, profileId } = parsed.data;

  const { error } = await getSupabaseAdminClient()
    .from("ratings")
    .delete()
    .eq("user_id",    userId)
    .eq("profile_id", profileId)
    .eq("pelicula_id", peliculaId);

  if (error) {
    console.error("[api/ratings DELETE]", error.code, error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
