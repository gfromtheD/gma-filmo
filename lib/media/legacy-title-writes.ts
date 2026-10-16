import {NextResponse} from 'next/server';
import {revalidateTag} from 'next/cache';
import {getSupabaseAdminClient} from '@/lib/supabase/admin';
import {CREATOR_GENRES} from '@/lib/genres';
import type {MediaReadClient,MediaRepositoryClient} from './repository';
import {z} from 'zod';
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

export async function publishLegacyTitle(userId:string,body:unknown) {
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
    const { data: col } = await (supabase as unknown as MediaReadClient)
      .from("colecciones")
      .select("id")
      .eq("slug", match.slug)
      .maybeSingle();
    genreColeccionId = col ? z.object({id:z.number()}).parse(col).id : null;
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

  const supabaseRpc = supabase as unknown as MediaRepositoryClient;
  const { data, error } = await supabaseRpc.rpc("publish_creator_pelicula", {
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

  const created=Array.isArray(data)?data[0]:data;
  if(!created)return NextResponse.json({error:'UPLOAD_DATABASE_UNAVAILABLE'},{status:503});
  return NextResponse.json({ title: created }, { status: 201 });
}

type LegacyDeleteClient = {
  from(table: 'peliculas'): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> } };
    delete(): { eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }> };
  };
};

/**
 * Borrado histórico de un título (comportamiento de Windows previo al motor, `057dbd4`): comprueba propiedad
 * con `creator_user_id` y borra la fila. Solo se usa con el motor v2 apagado; con el motor encendido el borrado
 * pasa por `TitleService.lifecycle('delete')` (asíncrono, con limpieza de medios y cuota).
 */
export async function deleteLegacyTitle(userId: string, slug: string,
  client: LegacyDeleteClient = getSupabaseAdminClient() as unknown as LegacyDeleteClient): Promise<{ status: number; body: Record<string, unknown> }> {
  const { data: row, error: findErr } = await client.from('peliculas').select('id, creator_user_id').eq('slug', slug).maybeSingle();
  if (findErr || !row) return { status: 404, body: { error: 'Título no encontrado' } };
  if ((row as { creator_user_id: string | null }).creator_user_id !== userId) {
    return { status: 403, body: { error: 'No tienes permiso para eliminar este título' } };
  }
  const { error: delErr } = await client.from('peliculas').delete().eq('slug', slug);
  if (delErr) return { status: 500, body: { error: delErr.message } };
  return { status: 200, body: { ok: true } };
}
