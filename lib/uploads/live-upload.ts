import type { ManagedEnvelope } from "./managed-browser";

/**
 * El servidor devuelve TODAS las subidas que ha tenido el borrador, también las canceladas o sustituidas (siguen en la
 * lista con su archivo «borrado»). Solo cuentan las que siguen en uso: si no, una subida cancelada impediría enviar el título.
 */
export function isLiveUpload(item: ManagedEnvelope): boolean {
  return !["cancelling", "cancelled"].includes(item.session.state) && !["deleting", "deleted"].includes(item.asset.status);
}
