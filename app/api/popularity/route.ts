import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePopularity, type PopularityRow } from "@/lib/recommendation/popularity";

const DAYS = 7;

/** Popularidad real de los últimos 7 días (personas distintas por título). Se recalcula cada 10 minutos. */
const getPopularity = unstable_cache(
  async (): Promise<[number, number][]> => {
    const { data, error } = await (getSupabaseAdminClient().rpc as unknown as (fn: string, args: object) => PromiseLike<{ data: PopularityRow[] | null; error: { message: string } | null }>)(
      "gma_popular_titles", { p_days: DAYS },
    );
    if (error || !data) throw new Error(error?.message ?? "sin datos");
    return [...normalizePopularity(data)];
  },
  ["popularity-7d"],
  { revalidate: 600 },
);

/** Lectura pública (no lleva datos personales). Si falla, devuelve una lista vacía y el motor usa la posición. */
export async function GET() {
  try {
    return NextResponse.json({ popularity: await getPopularity() });
  } catch (error) {
    console.error("[api/popularity]", error);
    return NextResponse.json({ popularity: [] });
  }
}
