import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimitCheck } from "@/lib/api/rate-limit";

/**
 * Límites por usuario y minuto. Guardar títulos deprisa es un uso normal (explorar el catálogo y marcar varios),
 * así que se dejan holgados: protegen de abusos, no de usuarios entusiastas.
 */
const WRITE_LIMIT_PER_MINUTE = 120;
const READ_LIMIT_PER_MINUTE = 120;

function tooManyRequests(retryAfterSeconds: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}

const MutateSchema = z.object({
  peliculaId: z.number().int().positive(),
  profileId:  z.string().max(64).default(""),
});

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const read = rateLimitCheck(`${userId}/watchlist/read`, READ_LIMIT_PER_MINUTE);
  if (!read.allowed) return tooManyRequests(read.retryAfterSeconds, { error: "Too many requests" });

  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";

  const { data, error } = await getSupabaseAdminClient()
    .from("watchlist")
    .select("pelicula_id")
    .eq("user_id",    userId)
    .eq("profile_id", profileId);

  if (error) {
    console.error("[api/watchlist GET]", error.code, error.message);
    return NextResponse.json({ ids: [], error: error.message });
  }
  return NextResponse.json({ ids: (data ?? []).map((r) => r.pelicula_id as number) });
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const write = rateLimitCheck(`${userId}/watchlist/write`, WRITE_LIMIT_PER_MINUTE);
  if (!write.allowed) return tooManyRequests(write.retryAfterSeconds, { ok: false, error: "Too many requests" });

  const parsed = MutateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  const { peliculaId, profileId } = parsed.data;

  const { error } = await getSupabaseAdminClient()
    .from("watchlist")
    .upsert(
      { user_id: userId, profile_id: profileId, pelicula_id: peliculaId },
      { onConflict: "user_id,profile_id,pelicula_id" },
    );

  if (error) {
    console.error("[api/watchlist POST]", error.code, error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const write = rateLimitCheck(`${userId}/watchlist/write`, WRITE_LIMIT_PER_MINUTE);
  if (!write.allowed) return tooManyRequests(write.retryAfterSeconds, { ok: false, error: "Too many requests" });

  const parsed = MutateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  const { peliculaId, profileId } = parsed.data;

  const { error } = await getSupabaseAdminClient()
    .from("watchlist")
    .delete()
    .eq("user_id",    userId)
    .eq("profile_id", profileId)
    .eq("pelicula_id", peliculaId);

  if (error) {
    console.error("[api/watchlist DELETE]", error.code, error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
