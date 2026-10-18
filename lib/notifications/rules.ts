/** Reglas y textos de las notificaciones, compartidos por el servidor y el menú de cuenta. */

export type NotificationKind = "rating";

/** Se avisa al creador de la obra, salvo que la valore él mismo o la obra no tenga creador (catálogo editorial). */
export function shouldNotifyRating({ creatorUserId, raterUserId }: { creatorUserId: string | null; raterUserId: string }): boolean {
  return Boolean(creatorUserId) && creatorUserId !== raterUserId;
}

/** Las valoraciones se guardan de 0 a 5 (medias estrellas); en la app se muestran del 1 al 10. */
export function starsToTen(stars: number): number {
  return Math.min(10, Math.max(1, Math.round(stars * 2)));
}

export function notificationText({ kind, score, title }: { kind: NotificationKind; score: number | null; title: string }): string {
  if (kind === "rating") return score ? `Han valorado «${title}» con un ${score}` : `Han valorado «${title}»`;
  return title;
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
