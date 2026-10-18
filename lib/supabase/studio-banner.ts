import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { pickStudioBanner, type StudioCreatorRow } from "@/lib/studio-creator-banner";

/**
 * Banner que el creador subió en Mi Estudio para su página pública, buscado entre las cuentas que subieron las obras de
 * esa página. Solo servidor (usa la clave de servicio para leer perfiles ajenos). Si algo falla, o si la columna
 * `banner_url` todavía no existe, devuelve null y la página sigue con su portada de siempre.
 */
export async function getStudioBanner(creatorName: string, filmSlugs: readonly string[]): Promise<string | null> {
  if (!filmSlugs.length) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data: films } = await admin.from("peliculas").select("creator_user_id").in("slug", [...filmSlugs]).not("creator_user_id", "is", null);
    const userIds = [...new Set((films ?? []).map((f) => f.creator_user_id).filter((id): id is string => Boolean(id)))];
    if (!userIds.length) return null;
    const { data: rows, error } = await admin.from("creator_profiles").select("creator_name, studio_name, banner_url").in("user_id", userIds);
    if (error || !rows) return null;
    return pickStudioBanner(creatorName, rows as StudioCreatorRow[]);
  } catch {
    return null;
  }
}
