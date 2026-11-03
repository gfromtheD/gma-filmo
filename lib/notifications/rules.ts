/** Reglas y textos de las notificaciones, compartidos por el servidor y el menú de cuenta. */

export type NotificationKind = "rating" | "reply" | "thread";

/** Quién recibe aviso cuando alguien responde a un comentario. */
export interface CommentAudience {
  /** Cuenta de quien escribe la respuesta. */
  readonly actorUserId: string;
  /** Autor del comentario al que se responde (si es una respuesta directa a un comentario principal, es el autor del hilo). */
  readonly replyTargetUserId: string;
  /** Autor del comentario principal del hilo. */
  readonly threadOwnerUserId: string;
}

/**
 * Destinatarios de una respuesta: quien recibe la respuesta (`reply`) y, si es otra persona, quien abrió el hilo (`thread`).
 * Nunca la propia cuenta de quien responde; sin duplicados.
 */
export function commentNotificationTargets({ actorUserId, replyTargetUserId, threadOwnerUserId }: CommentAudience): { userId: string; kind: "reply" | "thread" }[] {
  const targets: { userId: string; kind: "reply" | "thread" }[] = [];
  if (replyTargetUserId !== actorUserId) targets.push({ userId: replyTargetUserId, kind: "reply" });
  if (threadOwnerUserId !== actorUserId && threadOwnerUserId !== replyTargetUserId) targets.push({ userId: threadOwnerUserId, kind: "thread" });
  return targets;
}

/** Se avisa al creador de la obra, salvo que la valore él mismo o la obra no tenga creador (catálogo editorial). */
export function shouldNotifyRating({ creatorUserId, raterUserId }: { creatorUserId: string | null; raterUserId: string }): boolean {
  return Boolean(creatorUserId) && creatorUserId !== raterUserId;
}

/** Las valoraciones se guardan de 0 a 5 (medias estrellas); en la app se muestran del 1 al 10. */
export function starsToTen(stars: number): number {
  return Math.min(10, Math.max(1, Math.round(stars * 2)));
}

export function notificationText({ kind, score, title, actorName }: { kind: NotificationKind; score: number | null; title: string; actorName?: string }): string {
  const who = actorName?.trim() || "Alguien";
  if (kind === "reply") return `${who} ha respondido a tu comentario en «${title}»`;
  if (kind === "thread") return `${who} ha respondido en un hilo tuyo en «${title}»`;
  return score ? `Han valorado «${title}» con un ${score}` : `Han valorado «${title}»`;
}

/** «ahora», «hace 5 min», «hace 3 h», «hace 2 d» o la fecha corta si pasa de una semana. */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(timestamp).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
