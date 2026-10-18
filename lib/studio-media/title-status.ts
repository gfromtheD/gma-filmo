/**
 * Estado de un título tal como lo ve el propietario en Studio, derivado de `peliculas.status` y
 * `peliculas.media_delete_state` (motor multimedia). Recuperado del Mac (`studio-status.ts`).
 *
 * Incluye estados que la interfaz de Windows todavía no muestra (`retirado`, `borrado_pendiente`, `eliminado`):
 * es una decisión de producto pendiente cómo presentarlos, así que este tipo NO sustituye a `TitleStatus`
 * de `components/features/studio/studio-types.ts`.
 */
export type EngineTitleStatus = 'publicado' | 'revision' | 'borrador' | 'rechazado' | 'retirado' | 'borrado_pendiente' | 'eliminado';

export function toStudioTitleStatus(status: string | null, deletionState: string | null | undefined,
  diagnose: (value: string) => void = () => undefined): EngineTitleStatus {
  if (deletionState === 'pending') return 'borrado_pendiente';
  if (deletionState === 'done') return 'eliminado';
  if (status === null || status === 'published') return 'publicado';
  if (status === 'unpublished') return 'retirado';
  if (status === 'draft' || status === 'borrador') return 'borrador';
  if (status === 'review' || status === 'revision') return 'revision';
  if (status === 'rejected' || status === 'rechazado') return 'rechazado';
  diagnose(status);
  return 'revision';
}
