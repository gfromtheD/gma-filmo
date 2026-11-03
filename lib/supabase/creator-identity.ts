import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { CREATOR_PROFILES_TAG } from "@/lib/studio-creator-banner";
import type { AccountCreator, AccountCreatorRow } from "@/lib/creator-identity";

type Result<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>;
/** `slug` y `gestionado` no están en los tipos generados de Supabase (migraciones 20261120 y 20261109). */
type Untyped = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => { maybeSingle: () => Result<unknown> };
      not: (k: string, op: string, v: null) => Result<{ user_id: string; slug: string; creator_name: string | null }[]>;
    };
  };
};

/** Solo servidor: `creator_profiles` no es de lectura pública, así que se lee con la clave de servicio y se devuelve lo mínimo. */
const ROW_COLUMNS = "user_id, slug, creator_name, studio_name, banner_url, avatar_url, bio, location, social_links, gestionado, donacion_paypal, donacion_patreon, donacion_bitcoin";

/** La ficha de creador que posee ese slug, o null. Nunca lanza: ante un fallo la página cae al catálogo histórico. */
export async function getAccountCreatorBySlug(slug: string): Promise<AccountCreatorRow | null> {
  try {
    const { data, error } = await (getSupabaseAdminClient() as unknown as Untyped)
      .from("creator_profiles").select(ROW_COLUMNS).eq("slug", slug).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as AccountCreatorRow | null) ?? null;
  } catch (error) {
    console.error("[creator-identity] account read error:", error);
    return null;
  }
}

/** Slugs de las obras publicadas por esa cuenta. */
export async function getOwnedFilmSlugs(userId: string): Promise<Set<string>> {
  try {
    const { data, error } = await getSupabaseAdminClient().from("peliculas").select("slug")
      .eq("creator_user_id", userId).or("status.eq.published,status.is.null");
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((row) => row.slug));
  } catch (error) {
    console.error("[creator-identity] owned films error:", error);
    return new Set();
  }
}

const fetchAccountCreatorsCached = unstable_cache(
  async (): Promise<[string, AccountCreator][]> => {
    const { data, error } = await (getSupabaseAdminClient() as unknown as Untyped)
      .from("creator_profiles").select("user_id, slug, creator_name").not("slug", "is", null);
    if (error) throw new Error(error.message);
    return (data ?? []).filter((row) => row.creator_name?.trim())
      .map((row): [string, AccountCreator] => [row.user_id, { userId: row.user_id, slug: row.slug, name: row.creator_name!.trim() }]);
  },
  ["account-creators-v1"],
  { revalidate: 3600, tags: [CREATOR_PROFILES_TAG, "peliculas"] },
);

/** Cuentas creadoras por id, para enlazar los créditos de sus obras. Si falla, los créditos siguen sin enlace de cuenta. */
export async function fetchAccountCreators(): Promise<Map<string, AccountCreator>> {
  try {
    return new Map(await fetchAccountCreatorsCached());
  } catch (error) {
    console.error("[creator-identity] account map error:", error);
    return new Map();
  }
}
