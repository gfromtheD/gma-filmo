/**
 * `mediaEngine`: implementación de la interfaz de subida de Mi Estudio (`UploadEngine`, `lib/studio/engine.ts`) sobre el
 * motor multimedia recuperado del Mac (`lib/uploads/managed-browser.ts`, APIs `/api/upload-drafts`, `/api/uploads`, `/api/titles`).
 *
 * Principio de autoridad:
 *  - Servidor: borrador, sesiones, archivos, revisiones, cuotas, permisos y publicación.
 *  - Navegador: el `UploadDraft` de la pasarela es caché de edición; se sincroniza con `submit()`/`saveFicha()`.
 *
 * Diferencias con `localEngine`/`legacyEngine` que la interfaz debe conocer (ver COORDINACION-BACKEND.md):
 *  - `id` es `"media"`: hay que ampliar el tipo `UploadEngine["id"]` en `lib/studio/engine.ts`.
 *  - Necesita el borrador actual (`getDraft`) para saber el tipo de cada extra y el idioma de cada SRT.
 *  - Abortar la señal solo detiene el navegador: la sesión queda en el servidor y se puede reanudar. Para quitar un archivo
 *    de verdad (liberar cuota) hay que llamar a `cancelAsset(slot)`.
 *  - `submit()` no publica por defecto (`publishMode: 'hold'`): deja el borrador completo en el servidor. La publicación
 *    directa existe (`'direct'`) pero activarla es una decisión de producto (revisión editorial).
 *
 * Todas las dependencias de red se inyectan (`MediaEngineDeps`) para probarlo sin navegador.
 */
import type { AssetRequest, SubmitResult, UploadEngine } from '@/lib/studio/engine';
import type { UploadDraft, UploadedAsset, UploadPhase } from '@/lib/studio/upload-draft';
import type { AssetRole } from '@/types/media-engine';
import type { ManagedDraftDetail, ManagedEnvelope } from '@/lib/uploads/managed-browser';
import { isLiveUpload } from '@/lib/uploads/live-upload';
import { engineMetadata, fichaFromDraft, mapSlot, serverLimitProblem, type EngineMetadata } from './mapping';

export type MediaUploadedAsset = UploadedAsset & {
  readonly sessionId?: string;
  readonly mediaId?: string;
  readonly role?: AssetRole;
};

export interface MediaEngineDeps {
  ownerId(): Promise<string>;
  getDraft(ownerId: string): Promise<ManagedDraftDetail>;
  uploadAsset(input: {
    file: File; role: AssetRole; language?: string; draft: ManagedDraftDetail['draft']; idempotencyKey: string; sessionId?: string;
    signal: AbortSignal; onEnvelope?: (e: ManagedEnvelope) => void; onProgress?: (p: number) => void; onState?: (s: string) => void;
    onHashProgress?: (fraction: number) => void; processingWaitMs?: number;
  }): Promise<ManagedEnvelope>;
  saveMetadata(detail: ManagedDraftDetail, metadata: EngineMetadata): Promise<ManagedDraftDetail['draft']>;
  api<T>(path: string, method?: string, body?: unknown): Promise<T>;
  newKey(): string;
  languageLabel?(code: string): string;
}

export type PublishMode = 'hold' | 'direct';

export interface MediaUploadEngine extends Omit<UploadEngine, 'id'> {
  readonly id: 'media';
  /** Cancela la sesión en el servidor (libera la reserva de cuota). Usar al quitar un archivo, no al salir de la página. */
  cancelAsset(slot: string): Promise<void>;
  /** Pausa en el servidor una transferencia en curso. */
  pauseAsset(slot: string): Promise<void>;
  /** Reintenta un procesamiento fallido y reintentable (máximo 3, sin cobrar cuota otra vez). */
  retryAsset(slot: string): Promise<MediaUploadedAsset>;
  /** Guarda la ficha completa (todos los campos que el borrador del motor no admite). */
  saveFicha(draft: UploadDraft): Promise<{ revision: number }>;
}

// Textos con los que el cliente de subidas (managed-browser.ts) anuncia cada etapa.
const CHECKING = 'Comprobando identidad';
const TRANSFERRING = 'Transfiriendo';
const VALIDATING = 'Validando y procesando';
/** Roles de vídeo: se convierten en el servidor y una obra larga tarda mucho más que los 90 s que se esperan por defecto. */
const LONG_PROCESSING_ROLES: ReadonlySet<string> = new Set(['main', 'trailer', 'extras', 'intro']);
const LONG_PROCESSING_WAIT_MS = 6 * 60 * 60 * 1000;
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

function toAsset(file: { name: string; size: number }, envelope: ManagedEnvelope): MediaUploadedAsset {
  const base = { name: file.name, sizeBytes: file.size, sessionId: envelope.session.sessionId, mediaId: envelope.asset.mediaId, role: envelope.session.role };
  const status = envelope.asset.status;
  if (status === 'ready') return { ...base, url: envelope.asset.deliveryUrl ?? `/api/media/${envelope.asset.mediaId}`, status: 'done' };
  if (status === 'failed' || status === 'rejected') {
    return { ...base, url: null, status: 'error', error: envelope.asset.error?.retryable ? 'El procesamiento falló. Puedes reintentarlo.' : 'El archivo no ha superado la validación.' };
  }
  return { ...base, url: null, status: 'processing', progress: envelope.asset.processingProgress ?? undefined };
}

export function createMediaEngine(deps: MediaEngineDeps, options: { getDraft: () => UploadDraft; publishMode?: PublishMode }): MediaUploadEngine {
  const sessions = new Map<string, ManagedEnvelope>();
  let fichaRevision: number | null = null;

  async function serverDraft(): Promise<ManagedDraftDetail> {
    return deps.getDraft(await deps.ownerId());
  }

  /**
   * El servidor es quien sabe qué subida ocupa cada hueco del borrador; esta página solo lo recuerda mientras no se recarga
   * (`sessions`). Si una subida anterior quedó atascada, fallida o es de antes de recargar, reservar de nuevo el hueco daría
   * `UPLOAD_SLOT_OCCUPIED`. Quien vuelve a subir un archivo a un hueco quiere sustituir lo que había: se cancela esa subida
   * (el servidor libera el hueco al instante) y se vuelve a leer el borrador. Los extras tienen hueco propio por subida.
   */
  async function releaseOccupiedSlot(detail: ManagedDraftDetail, role: AssetRole, language: string | undefined, keepSessionId?: string): Promise<ManagedDraftDetail> {
    if (role === 'extras' || role === 'extra_image') return detail;
    const serverSlot = role === 'subtitles' ? `subtitles:${language || 'und'}` : role;
    const stale = detail.uploads.filter(u => u.session.slot === serverSlot && u.session.sessionId !== keepSessionId && !['cancelling', 'cancelled'].includes(u.session.state));
    if (stale.length === 0) return detail;
    for (const u of stale) await deps.api(`/api/uploads/${u.session.sessionId}/cancel`, 'POST', { revision: u.session.revision });
    return serverDraft();
  }

  async function uploadAsset(request: AssetRequest, onProgress: (p: number) => void, signal?: AbortSignal, onProcessing?: () => void, onPhase?: (phase: UploadPhase, percent?: number) => void): Promise<MediaUploadedAsset> {
    const { file, slot } = request;
    const fail = (error: string): MediaUploadedAsset => ({ name: file.name, sizeBytes: file.size, url: null, status: 'error', error });
    const mapping = mapSlot(options.getDraft(), slot);
    if (!mapping.supported) return fail(mapping.reason);
    const limit = serverLimitProblem(mapping.role, file.size);
    if (limit) return fail(limit);
    const previous = sessions.get(slot);
    // Reanudar solo si la sesión anterior de este hueco sigue viva y es del mismo rol.
    const resumable = previous && previous.session.role === mapping.role && ['uploading', 'paused'].includes(previous.session.state) ? previous : null;
    const controller = new AbortController();
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    if (signal?.aborted) controller.abort();
    try {
      const detail = await releaseOccupiedSlot(await serverDraft(), mapping.role, mapping.language, resumable?.session.sessionId);
      const envelope = await deps.uploadAsset({
        file, role: mapping.role, ...(mapping.language ? { language: mapping.language } : {}), draft: detail.draft,
        idempotencyKey: deps.newKey(),
        ...(resumable ? { sessionId: resumable.session.sessionId } : {}),
        signal: controller.signal,
        onEnvelope: e => { sessions.set(slot, e); },
        onProgress,
        onState: state => {
          if (state === CHECKING) onPhase?.('checking', 0);
          else if (state === TRANSFERRING) onPhase?.('uploading', 0);
          else if (state === VALIDATING) { onPhase?.('processing'); onProcessing?.(); }
        },
        onHashProgress: fraction => onPhase?.('checking', Math.round(fraction * 100)),
        // Un vídeo largo tarda en convertirse mucho más que los 90 s por defecto: se espera con calma y la página sigue mostrando «procesando».
        ...(LONG_PROCESSING_ROLES.has(mapping.role) ? { processingWaitMs: LONG_PROCESSING_WAIT_MS } : {}),
      });
      sessions.set(slot, envelope);
      return toAsset(file, envelope);
    } catch (error) {
      if (isAbort(error)) throw error;
      const envelope = (error as { envelope?: ManagedEnvelope | null }).envelope;
      if (envelope) { sessions.set(slot, envelope); return toAsset(file, envelope); }
      return fail(error instanceof Error ? error.message : 'No se pudo subir el archivo.');
    }
  }

  async function sessionAction(slot: string, action: 'cancel' | 'pause'): Promise<void> {
    const current = sessions.get(slot);
    if (!current) return;
    const result = await deps.api<ManagedEnvelope>(`/api/uploads/${current.session.sessionId}/${action}`, 'POST', { revision: current.session.revision });
    sessions.set(slot, result);
    if (action === 'cancel') sessions.delete(slot);
  }

  async function saveFicha(draft: UploadDraft): Promise<{ revision: number }> {
    const detail = await serverDraft();
    if (fichaRevision === null) {
      const current = await deps.api<{ ficha: { revision: number } | null }>(`/api/upload-drafts/${detail.draft.id}/ficha`);
      fichaRevision = current.ficha?.revision ?? 0;
    }
    const mediaIdForSlot = (slot: string) => sessions.get(slot)?.asset.mediaId ?? null;
    const body = { revision: fichaRevision, ...fichaFromDraft(draft, mediaIdForSlot) };
    const saved = await deps.api<{ ficha: { revision: number } }>(`/api/upload-drafts/${detail.draft.id}/ficha`, 'PUT', body);
    fichaRevision = saved.ficha.revision;
    return { revision: saved.ficha.revision };
  }

  async function submit(draft: UploadDraft): Promise<SubmitResult> {
    try {
      const detail = await serverDraft();
      const updated = await deps.saveMetadata(detail, engineMetadata(draft, deps.languageLabel));
      await saveFicha(draft);
      if ((options.publishMode ?? 'hold') === 'hold') {
        return { status: 'queued', message: 'Tu título y todos sus archivos están guardados. Se publicará cuando se active la publicación.' };
      }
      const fresh = await serverDraft();
      const live = fresh.uploads.filter(isLiveUpload); // las canceladas o sustituidas siguen en la lista del servidor, pero ya no cuentan
      const main = live.find(u => u.session.role === 'main' && u.asset.status === 'ready');
      if (!main) return { status: 'error', message: 'La película todavía no está lista.' };
      if (live.some(u => u.asset.status !== 'ready')) return { status: 'error', message: 'Algún archivo todavía se está procesando.' };
      const published = await deps.api<{ title: { slug: string } }>('/api/titles', 'POST', {
        draft_id: fresh.draft.id, revision: Math.max(updated.revision, fresh.draft.revision), main_media_id: main.asset.mediaId,
      });
      return { status: 'published', slug: published.title.slug, message: 'Tu título se ha publicado.' };
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo enviar el título.' };
    }
  }

  return {
    id: 'media',
    connected: true,
    uploadAsset,
    submit,
    saveFicha,
    cancelAsset: slot => sessionAction(slot, 'cancel'),
    pauseAsset: slot => sessionAction(slot, 'pause'),
    async retryAsset(slot) {
      const current = sessions.get(slot);
      if (!current) throw new Error('No hay ningún archivo que reintentar en este hueco.');
      const result = await deps.api<ManagedEnvelope>(`/api/uploads/${current.session.sessionId}/retry`, 'POST', {
        revision: current.session.revision, asset_revision: current.asset.revision, idempotency_key: deps.newKey(),
      });
      sessions.set(slot, result);
      return toAsset({ name: '', size: 0 }, result);
    },
  };
}

/** Dependencias reales (navegador). Se cargan bajo demanda para no arrastrar el cliente de subidas a otras páginas. */
export async function browserMediaEngineDeps(): Promise<MediaEngineDeps> {
  const [{ getManagedDraft, uploadManagedAsset, saveManagedMetadata }, { uploadApi }, { getSupabaseBrowserClient }, { languageName }] = await Promise.all([
    import('@/lib/uploads/managed-browser'), import('@/lib/uploads/browser'), import('@/lib/supabase/browser'), import('@/lib/studio/geo'),
  ]);
  return {
    async ownerId() {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session) throw new Error('Inicia sesión para subir contenido');
      return session.user.id;
    },
    getDraft: getManagedDraft,
    uploadAsset: input => uploadManagedAsset(input),
    async saveMetadata(detail, metadata) { return saveManagedMetadata(detail, metadata); },
    api: (path, method, body) => uploadApi(path, method, body),
    newKey: () => crypto.randomUUID(),
    languageLabel: code => languageName(code),
  };
}
