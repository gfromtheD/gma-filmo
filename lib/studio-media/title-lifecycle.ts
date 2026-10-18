/**
 * Acciones de «Mis títulos» sobre el backend (publicar/retirar/republicar/borrar/editar), sin tocar la presentación.
 * Con el motor apagado solo existe el borrado histórico (DELETE sin cuerpo); el resto lanza `TITLE_ACTION_UNAVAILABLE`
 * para que la interfaz siga mostrando su aviso actual en vez de fingir que guardó algo.
 *
 * Revisiones: las acciones de ciclo de vida usan `mediaRevision` del título (GET /api/titles/:slug) y una clave de
 * idempotencia nueva por intención del usuario. Un 409 significa que el título cambió: hay que recargar, no reintentar a ciegas.
 */
import type { EngineMetadata } from './mapping';

export interface TitleSummary { readonly id: number; readonly slug: string; readonly status: string; readonly mediaRevision: number; readonly deletionState: 'none' | 'pending' | 'done' }

export interface TitleLifecycleDeps {
  api<T>(path: string, method?: string, body?: unknown): Promise<T>;
  engineEnabled: boolean;
  newKey(): string;
}

export class TitleActionUnavailable extends Error {
  constructor(action: string) { super(`TITLE_ACTION_UNAVAILABLE:${action}`); this.name = 'TitleActionUnavailable'; }
}

export function createTitleLifecycle(deps: TitleLifecycleDeps) {
  const path = (slug: string, suffix = '') => `/api/titles/${encodeURIComponent(slug)}${suffix}`;
  const requireEngine = (action: string) => { if (!deps.engineEnabled) throw new TitleActionUnavailable(action); };
  return {
    async detail(slug: string): Promise<TitleSummary> {
      requireEngine('detail');
      return (await deps.api<{ title: TitleSummary }>(path(slug))).title;
    },
    async unpublish(slug: string, revision: number): Promise<TitleSummary> {
      requireEngine('unpublish');
      return (await deps.api<{ title: TitleSummary }>(path(slug, '/unpublish'), 'POST', { revision, idempotency_key: deps.newKey() })).title;
    },
    async republish(slug: string, revision: number): Promise<TitleSummary> {
      requireEngine('republish');
      return (await deps.api<{ title: TitleSummary }>(path(slug, '/republish'), 'POST', { revision, idempotency_key: deps.newKey() })).title;
    },
    async editMetadata(slug: string, revision: number, metadata: EngineMetadata): Promise<TitleSummary> {
      requireEngine('edit');
      return (await deps.api<{ title: TitleSummary }>(path(slug), 'PATCH', { revision, metadata })).title;
    },
    /** Motor encendido: borrado asíncrono (202, `deletionState: pending`). Apagado: borrado histórico inmediato. */
    async remove(slug: string, revision?: number): Promise<{ accepted: boolean; deletionState: 'pending' | 'done' }> {
      if (!deps.engineEnabled) { await deps.api(path(slug), 'DELETE'); return { accepted: true, deletionState: 'done' }; }
      if (revision === undefined) throw new Error('TITLE_REVISION_REQUIRED');
      const result = await deps.api<{ title: TitleSummary; accepted: boolean }>(path(slug), 'DELETE', { revision, idempotency_key: deps.newKey() });
      return { accepted: result.accepted, deletionState: result.title.deletionState === 'done' ? 'done' : 'pending' };
    },
  };
}
