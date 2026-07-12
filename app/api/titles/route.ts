import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getUserId } from "@/lib/api/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { CREATOR_GENRES } from "@/lib/genres";

function durationToMinutes(s: string): number {
  if (!s) return 0;
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m(?:in)?/i);
  if (h || m) return (h ? parseInt(h[1]!) * 60 : 0) + (m ? parseInt(m[1]!) : 0);
  const plain = s.match(/^(\d+)$/);
  return plain ? parseInt(plain[1]!) : 0;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    title, synopsis, year, duration, language, genre,
    r2VideoUrl, r2PosterUrl, r2SubtitleUrl, fileSizeBytes,
  } = body as {
    title: string; synopsis?: string; year?: string; duration?: string;
    genre?: string; language?: string;
    r2VideoUrl: string; r2PosterUrl?: string; r2SubtitleUrl?: string;
    fileSizeBytes?: number;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }
  if (!r2VideoUrl) {
    return NextResponse.json({ error: "La URL del vídeo es obligatoria" }, { status: 400 });
  }

  // Auto-classify: < 40 min = Cortometraje, ≥ 40 min = Película
  const durationMins = durationToMinutes(duration ?? "");
  const mediaFormat = durationMins >= 40 ? "Película" : "Cortometraje";

  const supabase = getSupabaseAdminClient();

  // Género narrativo: validado server-side contra una allowlist explícita.
  // El cliente nunca envía un collection_id — solo la etiqueta, que se resuelve aquí.
  let genreColeccionId: number | null = null;
  if (genre) {
    const match = CREATOR_GENRES.find(g => g.label === genre);
    if (!match) {
      return NextResponse.json({ error: "Género no válido" }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: col } = await (supabase as any)
      .from("colecciones")
      .select("id")
      .eq("slug", match.slug)
      .maybeSingle();
    genreColeccionId = (col as { id: number } | null)?.id ?? null;
  }

  // Get creator display name
  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("creator_name")
    .eq("user_id", userId)
    .maybeSingle();

  // Make unique slug
  let slug = slugify(title);
  const { data: collision } = await supabase.from("peliculas").select("id").eq("slug", slug).maybeSingle();
  if (collision) slug = `${slug}-${Date.now()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const { data, error } = await supabaseAny.rpc("publish_creator_pelicula", {
    p_slug:               slug,
    p_title:              title.trim(),
    p_synopsis:           synopsis?.trim() || null,
    p_year:                year || null,
    p_duration:            duration?.trim() || null,
    p_author:              (profile as { creator_name?: string } | null)?.creator_name ?? "GMA Creator",
    p_r2_video_url:        r2VideoUrl,
    p_r2_poster_url:       r2PosterUrl || null,
    p_r2_subtitle_url:     r2SubtitleUrl || null,
    p_creator_user_id:     userId,
    p_media_format:        mediaFormat,
    p_language:            language || null,
    p_file_size_bytes:     fileSizeBytes ?? 0,
    p_genre_coleccion_id:  genreColeccionId,
  });

  if (error) {
    console.error("[titles] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("peliculas");

  return NextResponse.json({ title: data }, { status: 201 });
}
