import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { attachCommunityScores, summariesFromAggregates, summarizeRatings, type CommunityScoreSummary, type RatingAggregateRow, type RatingRow } from "@/lib/ratings/summary";

/**
 * Solo servidor. Las medias las agrega la base (`community_rating_summaries()`, migración 20261115). Si esa función aún no
 * existe o falla, se leen todas las valoraciones por páginas (la API devuelve 1.000 como máximo) y se calculan aquí.
 */
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

async function fetchSummaries(): Promise<Map<number, CommunityScoreSummary>> {
  const { data, error } = await getSupabaseAdminClient().rpc("community_rating_summaries");
  if (!error && Array.isArray(data)) return summariesFromAggregates(data as unknown as RatingAggregateRow[]);
  console.error("[ratings summary] sin agregado en la base, se calcula en el servidor:", error?.code, error?.message);
  return summarizeRatings(await fetchAllRatings());
}

const getSummariesCached = unstable_cache(
  async (): Promise<[number, CommunityScoreSummary][]> => [...(await fetchSummaries())],
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
