import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

const Schema = z.object({
  peliculaId:   z.number().int().positive(),
  proposedText: z.string().min(20).max(2000),
});

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/synopsis-proposal`, 5)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const { peliculaId, proposedText } = parsed.data;

  const { error } = await getSupabaseAdminClient()
    .from("synopsis_proposals")
    .insert({ user_id: userId, pelicula_id: peliculaId, proposed_text: proposedText });

  if (error) {
    console.error("[api/synopsis-proposals POST]", error.code, error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
