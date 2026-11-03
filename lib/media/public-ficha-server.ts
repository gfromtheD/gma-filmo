import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { toPublicFicha, type PublicFicha } from "@/lib/media/public-ficha";

/**
 * Solo servidor. `pelicula_ficha` no tiene lectura pública (RLS cerrada): la lee el servidor y entrega solo lo que
 * `toPublicFicha` deja pasar. Nunca hace fallar la página: sin ficha (títulos anteriores a la pasarela nueva) o ante un
 * error, devuelve `null` y la ficha pública se ve como siempre.
 */
async function fetchPublicFicha(peliculaId: number): Promise<PublicFicha | null> {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("pelicula_ficha")
      .select("ficha")
      .eq("pelicula_id", peliculaId)
      .maybeSingle();
    if (error || !data) return null;
    return toPublicFicha(data.ficha);
  } catch (error) {
    console.error("[public ficha]", error);
    return null;
  }
}

export const getPublicFicha = (peliculaId: number): Promise<PublicFicha | null> =>
  unstable_cache(() => fetchPublicFicha(peliculaId), ["public-ficha", String(peliculaId)], { revalidate: 300, tags: ["peliculas"] })();
