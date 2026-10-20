import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldNotifyRating, starsToTen } from "@/lib/notifications/rules";

// La tabla notifications aún no está en types/database.ts (migración 20261023_notifications).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const notificationsDb = () => getSupabaseAdminClient() as any;

/**
 * Avisa al creador de que han valorado su obra. Nunca hace fallar la valoración: si algo sale mal (o la tabla
 * todavía no existe) solo se registra en el log.
 */
export async function notifyRating({ peliculaId, raterUserId, raterProfileId, stars }: {
  peliculaId: number; raterUserId: string; raterProfileId: string; stars: number;
}): Promise<void> {
  try {
    const db = notificationsDb();
    const { data: film } = await db.from("peliculas").select("creator_user_id").eq("id", peliculaId).maybeSingle();
    const creatorUserId = (film?.creator_user_id as string | null | undefined) ?? null;
    if (!shouldNotifyRating({ creatorUserId, raterUserId })) return;
    // El creador puede haberlos desactivado en Configuración. Si la columna aún no existe, se avisa (valor por defecto).
    const { data: prefs, error: prefsError } = await db.from("creator_profiles").select("notify_ratings").eq("user_id", creatorUserId).maybeSingle();
    if (!prefsError && prefs?.notify_ratings === false) return;

    const { error } = await db.from("notifications").upsert(
      {
        user_id: creatorUserId,
        kind: "rating",
        pelicula_id: peliculaId,
        actor_user_id: raterUserId,
        actor_profile_id: raterProfileId,
        score: starsToTen(stars),
        created_at: new Date().toISOString(),
        read_at: null,
      },
      { onConflict: "user_id,kind,pelicula_id,actor_user_id,actor_profile_id" },
    );
    if (error) console.error("[notifications] notifyRating", error.code, error.message);
  } catch (error) {
    console.error("[notifications] notifyRating", error);
  }
}
