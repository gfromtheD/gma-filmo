import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { pickStudioProfile, type StudioCreatorRow, type StudioProfileOverlay } from "@/lib/studio-creator-banner";

/**
 * Ficha que el creador (o el equipo, si el perfil está gestionado) rellenó en Mi Estudio para su página pública, buscada
 * entre las cuentas que subieron las obras de esa página. Solo servidor (usa la clave de servicio para leer perfiles ajenos).
 * Si algo falla devuelve null y la página sigue con lo del catálogo.
 */
export async function getStudioProfile(creatorName: string, filmSlugs: readonly string[]): Promise<StudioProfileOverlay | null> {
  if (!filmSlugs.length) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data: films } = await admin.from("peliculas").select("creator_user_id").in("slug", [...filmSlugs]).not("creator_user_id", "is", null);
    const userIds = [...new Set((films ?? []).map((f) => f.creator_user_id).filter((id): id is string => Boolean(id)))];
    if (!userIds.length) return null;
    const { data: rows, error } = await admin.from("creator_profiles")
      .select("creator_name, studio_name, banner_url, avatar_url, bio, location, social_links, gestionado").in("user_id", userIds);
    if (error || !rows) return null;
    // `gestionado` aún no está en los tipos generados de Supabase (migración 20261109).
    return pickStudioProfile(creatorName, rows as unknown as StudioCreatorRow[]);
  } catch {
    return null;
  }
}
