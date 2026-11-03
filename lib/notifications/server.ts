import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { commentNotificationTargets, shouldNotifyRating, starsToTen } from "@/lib/notifications/rules";

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
      { onConflict: "user_id,kind,pelicula_id,actor_user_id,actor_profile_id,comment_id" },
    );
    if (error) console.error("[notifications] notifyRating", error.code, error.message);
  } catch (error) {
    console.error("[notifications] notifyRating", error);
  }
}

/**
 * Avisa de que han respondido a un comentario: a quien recibe la respuesta y, si es otra persona, a quien abrió el hilo.
 * Nunca hace fallar la publicación del comentario: si algo sale mal (o la migración aún no está aplicada) solo se registra.
 */
export async function notifyCommentReply({ commentId, peliculaId, actorUserId, actorProfileId, actorName, replyTargetUserId, threadOwnerUserId }: {
  commentId: number; peliculaId: number; actorUserId: string; actorProfileId: string; actorName: string;
  replyTargetUserId: string; threadOwnerUserId: string;
}): Promise<void> {
  try {
    const targets = commentNotificationTargets({ actorUserId, replyTargetUserId, threadOwnerUserId });
    if (targets.length === 0) return;
    const now = new Date().toISOString();
    const rows = targets.map(({ userId, kind }) => ({
      user_id: userId, kind, pelicula_id: peliculaId, actor_user_id: actorUserId, actor_profile_id: actorProfileId,
      comment_id: commentId, actor_name: actorName.slice(0, 60), created_at: now, read_at: null,
    }));
    const { error } = await notificationsDb().from("notifications").upsert(rows, { onConflict: "user_id,kind,pelicula_id,actor_user_id,actor_profile_id,comment_id" });
    if (error) console.error("[notifications] notifyCommentReply", error.code, error.message);
  } catch (error) {
    console.error("[notifications] notifyCommentReply", error);
  }
}
