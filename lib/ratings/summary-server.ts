import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { attachCommunityScores, summarizeRatings, type CommunityScoreSummary, type RatingRow } from "@/lib/ratings/summary";

/** Solo servidor. Lee todas las valoraciones (por páginas, la API devuelve 1.000 como máximo) y calcula las medias. */
const PAGE_SIZE = 1000;

async function fetchAllRatings(): Promise<RatingRow[]> {
  const admin = getSupabaseAdminClient();
  const rows: RatingRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("ratings")
      .select("pelicula_id, score")
      .gt("score", 0)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[ratings summary]", error.code, error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

const getSummariesCached = unstable_cache(
  async (): Promise<[number, CommunityScoreSummary][]> => [...summarizeRatings(await fetchAllRatings())],
  ["community-rating-summaries"],
  { revalidate: 120, tags: ["ratings"] },
);

/**
 * Añade a cada título su nota media (`communityScore`) si ya tiene valoraciones. Se recalcula cada 2 minutos, así
 * una película recién valorada empieza a mostrar su nota sin tocar nada. Si falla la lectura, el catálogo sigue
 * funcionando sin notas.
 */
export async function withCommunityScores<T extends { readonly numericId: number }>(items: readonly T[]) {
  try {
    return attachCommunityScores(items, new Map(await getSummariesCached()));
  } catch (error) {
    console.error("[ratings summary]", error);
    return attachCommunityScores(items, new Map());
  }
}
