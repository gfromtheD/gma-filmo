import { unstable_cache } from "next/cache";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import { rowToExtra, sortExtras, type ExtraRow } from "@/lib/extras/extras";
import type { MovieExtra } from "@/types/catalog";

export const EXTRA_COLUMNS =
  "id, pelicula_id, title, description, kind, provider, video_url, media_ref, poster_url, duration_seconds, file_size_bytes, sort_order, status";

/** Extras publicados de un título, ya ordenados. Nunca lanza: ante cualquier fallo devuelve []. */
export async function fetchPublishedExtras(peliculaId: number): Promise<MovieExtra[]> {
  try {
    const { data, error } = await getSupabasePublicClient()
      .from("pelicula_extras")
      .select(EXTRA_COLUMNS)
      .eq("pelicula_id", peliculaId)
      .eq("status", "published");

    // Sin la tabla (migración aún sin aplicar) o con un error, la ficha sigue funcionando sin extras.
    if (error || !data) {
      if (error) console.error("[extras] read error:", error.code, error.message);
      return [];
    }
    return sortExtras(data as ExtraRow[])
      .map(rowToExtra)
      .filter((extra): extra is MovieExtra => extra !== null);
  } catch (error) {
    console.error("[extras] unexpected read error:", error);
    return [];
  }
}

export const getExtrasByPeliculaId = unstable_cache(fetchPublishedExtras, ["extras-by-pelicula"], {
  revalidate: 3600,
  tags: ["extras"],
});
