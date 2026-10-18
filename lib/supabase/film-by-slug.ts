import { unstable_cache } from "next/cache";
import { getSupabasePublicClient } from "@/lib/supabase/public";

/**
 * Etiqueta de la caché de títulos. Publicar, editar y borrar un título la invalidan (`revalidateTag("peliculas")` en
 * `app/api/titles`), así que todo lo que se lea del catálogo tiene que llevarla.
 */
export const FILMS_CACHE_TAG = "peliculas";

/** Un título que no existe, no está publicado o no se pudo leer: se señala con un error para que no se guarde en caché. */
class FilmRowMissingError extends Error {}

const readFilmRow = unstable_cache(
  async (slug: string, select: string): Promise<unknown> => {
    const { data, error } = await getSupabasePublicClient()
      .from("peliculas")
      .select(select)
      .or("status.eq.published,status.is.null")
      .eq("slug", slug)
      .single();
    if (error || !data) throw new FilmRowMissingError(slug);
    return data;
  },
  ["pelicula-por-slug-v1"],
  { revalidate: 3600, tags: [FILMS_CACHE_TAG] },
);

/**
 * Fila de un título publicado por su dirección (slug), o `null` si no existe. La lectura se guarda en caché con la
 * etiqueta de títulos, así que al despublicar o borrar deja de servirse al momento. Los fallos y los títulos que no
 * existen no se guardan: la próxima visita lo vuelve a intentar.
 */
export async function cachedFilmRowBySlug<T>(slug: string, select: string): Promise<T | null> {
  try {
    return (await readFilmRow(slug, select)) as T;
  } catch (error) {
    if (error instanceof FilmRowMissingError) return null;
    throw error;
  }
}
