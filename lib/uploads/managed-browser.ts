'use client';
import { z } from 'zod';
import { transferAsset } from '@/lib/media/transports';
import { uploadMutationEnvelopeSchema, transferDescriptorSchema } from '@/lib/media/contracts';
import type { AssetRole, UploadSessionDTO, MediaAssetDTO, TransferDescriptor } from '@/types/media-engine';
import { hashFile, uploadApi } from './browser';

export const managedDraftSchema = z.object({ id: z.string().uuid(), purpose: z.enum(['title', 'avatar', 'banner']), state: z.enum(['draft', 'published', 'abandoned']),
  revision: z.number().int().nonnegative(), titleId: z.number().nullable(), metadata: z.record(z.string(), z.unknown()), createdAt: z.string(), updatedAt: z.string() }).strict();
export const managedEnvelopeSchema = uploadMutationEnvelopeSchema;
export const managedDraftDetailSchema = z.object({ version: z.literal(1), draft: managedDraftSchema, uploads: z.array(managedEnvelopeSchema) }).strict();
export type ManagedEnvelope = z.infer<typeof managedEnvelopeSchema>;
export type ManagedDraftDetail = z.infer<typeof managedDraftDetailSchema>;
const managedDraftLoads = new Map<string, Promise<ManagedDraftDetail>>();

export function buildMainMediaPublishPayload(detail: ManagedDraftDetail, selectedMediaId: string) {
  const main = detail.uploads.find(item => item.session.role === 'main' && item.asset.mediaId === selectedMediaId);
  if (!main || main.asset.status !== 'ready') throw new Error('UPLOAD_MAIN_NOT_READY');
  if (detail.uploads.some(item => item.asset.status !== 'ready')) throw new Error('UPLOAD_ATTACHMENTS_NOT_READY');
  return { draft_id: detail.draft.id, revision: detail.draft.revision, main_media_id: main.asset.mediaId } as const;
}

export class ManagedUploadFailure extends Error {
  constructor(message: string, readonly envelope: ManagedEnvelope | null = null) { super(message); this.name = 'ManagedUploadFailure'; }
}

async function loadManagedDraft(ownerId: string): Promise<ManagedDraftDetail> {
  const key = `gma-media-draft:v1:${ownerId}`;
  let cached: string | null = null;
  try { cached = window.localStorage.getItem(key); } catch { /* storage can be disabled */ }
  const listed = await uploadApi<{ version: 1; drafts: z.infer<typeof managedDraftSchema>[] }>('/api/upload-drafts');
  let draft = listed.drafts.find(item => item.id === cached && item.purpose === 'title' && item.state === 'draft')
    ?? listed.drafts.find(item => item.purpose === 'title' && item.state === 'draft');
  if (!draft) draft = (await uploadApi<{ version: 1; draft: z.infer<typeof managedDraftSchema> }>('/api/upload-drafts', 'POST', { purpose: 'title' })).draft;
  try { window.localStorage.setItem(key, draft.id); } catch { /* server remains authoritative */ }
  return managedDraftDetailSchema.parse(await uploadApi(`/api/upload-drafts/${draft.id}`));
}

/** Share the first owner-scoped lookup/create so simultaneous Studio effects cannot reserve duplicate drafts. */
export function getManagedDraft(ownerId: string): Promise<ManagedDraftDetail> {
  const pending = managedDraftLoads.get(ownerId);
  if (pending) return pending;
  const task = loadManagedDraft(ownerId);
  managedDraftLoads.set(ownerId, task);
  const clear = () => { if (managedDraftLoads.get(ownerId) === task) managedDraftLoads.delete(ownerId); };
  void task.then(clear, clear);
  return task;
}

export async function saveManagedMetadata(detail: ManagedDraftDetail, metadata: { title: string; synopsis: string | null; year?: string; genre?: string; language?: string }) {
  const updated = await uploadApi<{ version: 1; draft: z.infer<typeof managedDraftSchema> }>(`/api/upload-drafts/${detail.draft.id}`, 'PATCH', {
    revision: detail.draft.revision, metadata,
  });
  return managedDraftSchema.parse(updated.draft);
}

export async function uploadManagedAsset(input: { file: File; role: AssetRole; language?: string; draft: z.infer<typeof managedDraftSchema>; idempotencyKey: string;
  sessionId?: string; signal: AbortSignal; onEnvelope?: (envelope: ManagedEnvelope) => void; onProgress?: (percent: number) => void;
  onState?: (state: string) => void; processingWaitMs?: number }): Promise<ManagedEnvelope> {
  const { file, role, draft, signal } = input;
  if (!Number.isSafeInteger(file.size) || file.size < 1) throw new ManagedUploadFailure('El archivo está vacío o no es válido');
  input.onState?.('Comprobando identidad');
  const sha256 = await hashFile(file, signal);
  let envelope: ManagedEnvelope;
  if (input.sessionId) {
    const previous = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${input.sessionId}`));
    const resumed = await uploadApi(`/api/uploads/${input.sessionId}/resume`, 'POST', {
      sha256, bytes: file.size, revision: previous.session.revision,
    });
    envelope = managedEnvelopeSchema.parse(resumed);
  } else {
    const currentDraftResponse = await uploadApi<{ draft: unknown }>(`/api/upload-drafts/${draft.id}`);
    const currentDraft = managedDraftSchema.parse(currentDraftResponse.draft);
    const reserved = await uploadApi(`/api/uploads`, 'POST', {
      draft_id: draft.id, revision: currentDraft.revision, role, bytes: file.size, sha256,
      file_name: file.name, content_type: file.type || 'application/octet-stream',
      ...(role === 'subtitles' ? { language: input.language ?? 'und' } : {}), idempotency_key: input.idempotencyKey,
    });
    envelope = managedEnvelopeSchema.parse(reserved);
  }
  input.onEnvelope?.(envelope);
  const descriptor = envelope.transfer;
  if (!descriptor) throw new ManagedUploadFailure('El servidor no devolvió un transporte de subida', envelope);
  input.onState?.('Transfiriendo');
  const refresh = async (): Promise<TransferDescriptor> => {
    const refreshed = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${envelope.session.sessionId}/transfer`, 'POST', {
      generation: envelope.session.transferGeneration,
    }));
    envelope = refreshed; input.onEnvelope?.(refreshed);
    if (!refreshed.transfer) throw new Error('UPLOAD_TRANSFER_EXPIRED');
    return transferDescriptorSchema.parse(refreshed.transfer);
  };
  if (descriptor.protocol === 'uploadx' || descriptor.protocol === 'put' || descriptor.protocol === 'multipart' || descriptor.protocol === 'tus') {
    await transferAsset({ file, sessionId: envelope.session.sessionId, descriptor, signal, api: uploadApi, refresh,
      onProgress: input.onProgress ?? (() => undefined) });
  }
  if (signal.aborted) throw new DOMException('Interrumpido', 'AbortError');
  input.onState?.('Validando y procesando');
  await uploadApi(`/api/uploads/${envelope.session.sessionId}/complete`, 'POST', { generation: envelope.session.transferGeneration });
  const deadline = Date.now() + (input.processingWaitMs ?? 90_000);
  while (Date.now() < deadline) {
    if (signal.aborted) throw new DOMException('Interrumpido', 'AbortError');
    envelope = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${envelope.session.sessionId}`));
    input.onEnvelope?.(envelope);
    if (envelope.asset.status === 'ready') { input.onProgress?.(100); return envelope; }
    if (envelope.asset.status === 'failed' || envelope.asset.status === 'rejected') {
      throw new ManagedUploadFailure(envelope.asset.error?.code ?? 'El procesamiento no ha terminado correctamente', envelope);
    }
    if (['cancelling', 'cancelled', 'expired'].includes(envelope.session.state) || ['deleting', 'deleted'].includes(envelope.asset.status)) {
      throw new ManagedUploadFailure('La subida se ha cancelado', envelope);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new ManagedUploadFailure('El procesamiento continúa. Puedes volver a Studio para recuperar el estado.', envelope);
}

export function managedIdentity(envelope: ManagedEnvelope): Pick<UploadSessionDTO, 'sessionId' | 'mediaId'> & Pick<MediaAssetDTO, 'status'> {
  return { sessionId: envelope.session.sessionId, mediaId: envelope.asset.mediaId, status: envelope.asset.status };
}
