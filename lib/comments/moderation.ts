/**
 * Moderación ligera de comentarios (sin dependencias de red ni de React): lo que el creador de una obra puede hacer con las
 * denuncias de los comentarios de esa obra. La usan la API (`/api/creator/moderation`) y Mi Estudio.
 */

export type ModerationAction = "dismiss" | "hide";

export interface ModerationBody {
  readonly commentId: number;
  readonly action: ModerationAction;
}

/** Valida el cuerpo de `POST /api/creator/moderation`; `null` si no es válido. */
export function parseModerationBody(body: unknown): ModerationBody | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { commentId, action } = body as Record<string, unknown>;
  if (typeof commentId !== "number" || !Number.isInteger(commentId) || commentId <= 0) return null;
  if (action !== "dismiss" && action !== "hide") return null;
  return { commentId, action };
}

/** Una fila de `comment_reports` con el comentario denunciado (tal y como la devuelve Supabase). */
export interface ReportRow {
  readonly comment_id: number;
  readonly created_at: string;
  readonly comments: {
    readonly id: number;
    readonly content: string;
    readonly pelicula_id: number;
    readonly display_name: string;
    readonly is_deleted: boolean;
  } | null;
}

/** Un comentario con denuncias pendientes, listo para que el creador decida. */
export interface ModerationItem {
  readonly commentId: number;
  readonly content: string;
  readonly authorName: string;
  readonly peliculaId: number;
  readonly reportCount: number;
  readonly lastReportAt: string;
}

/**
 * Agrupa las denuncias pendientes por comentario. Se descartan las de comentarios ya borrados u ocultos. Primero los más
 * denunciados; a igualdad, el denunciado más recientemente.
 */
export function groupReports(rows: readonly ReportRow[]): ModerationItem[] {
  const byComment = new Map<number, ModerationItem>();
  for (const row of rows) {
    const comment = row.comments;
    if (!comment || comment.is_deleted) continue;
    const current = byComment.get(comment.id);
    byComment.set(comment.id, {
      commentId: comment.id,
      content: comment.content,
      authorName: comment.display_name,
      peliculaId: comment.pelicula_id,
      reportCount: (current?.reportCount ?? 0) + 1,
      lastReportAt: current && current.lastReportAt > row.created_at ? current.lastReportAt : row.created_at,
    });
  }
  return [...byComment.values()].sort((a, b) => b.reportCount - a.reportCount || b.lastReportAt.localeCompare(a.lastReportAt));
}

/** Estado en que quedan las denuncias de un comentario según la decisión del creador. */
export function reportStatusFor(action: ModerationAction): "dismissed" | "reviewed" {
  return action === "dismiss" ? "dismissed" : "reviewed";
}
