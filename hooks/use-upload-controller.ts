'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadApi } from '@/lib/uploads/browser';
import { getManagedDraft, managedDraftDetailSchema, managedEnvelopeSchema, saveManagedMetadata, uploadManagedAsset,
  type ManagedDraftDetail, type ManagedEnvelope } from '@/lib/uploads/managed-browser';
import type { AssetRole } from '@/types/media-engine';

export interface UploadController {
  ownerId: string;
  detail: ManagedDraftDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<ManagedDraftDetail | null>;
  saveMetadata: (metadata: { title: string; synopsis: string | null; year?: string; genre?: string; language?: string }) => Promise<void>;
  upload: (input: { file: File; role: AssetRole; language?: string; idempotencyKey: string; sessionId?: string; signal: AbortSignal;
    onEnvelope?: (envelope: ManagedEnvelope) => void; onProgress?: (percent: number) => void; onState?: (state: string) => void }) => Promise<ManagedEnvelope>;
  cancel: (sessionId: string) => Promise<void>;
  pause: (sessionId: string) => Promise<void>;
  setLanguage: (sessionId: string, language: string) => Promise<void>;
  reorder: (sessionId: string, position: number) => Promise<void>;
  retry: (envelope: ManagedEnvelope) => Promise<ManagedEnvelope>;
  abandon: () => Promise<void>;
  adoptEnvelope: (envelope: ManagedEnvelope) => void;
}

export function useUploadController(ownerId: string): UploadController {
  const [detail, setDetail] = useState<ManagedDraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ownerRef = useRef(ownerId); ownerRef.current = ownerId;
  const detailRef = useRef(detail); detailRef.current = detail;
  const mutationChain = useRef(Promise.resolve());
  const serializeMutation = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationChain.current.then(operation);
    mutationChain.current = result.then(() => undefined, () => undefined);
    return result;
  };
  const updateEnvelope = useCallback((envelope: ManagedEnvelope) => {
    const current = detailRef.current;
    if (!current || current.draft.id !== envelope.session.draftId || ownerRef.current !== ownerId) return;
    const uploads = current.uploads.filter(item => item.session.sessionId !== envelope.session.sessionId).concat(envelope);
    const next = managedDraftDetailSchema.parse({ ...current, draft: { ...current.draft, revision: Math.max(current.draft.revision, envelope.draftRevision) }, uploads });
    detailRef.current = next;
    setDetail(next);
  }, [ownerId]);
  const refresh = useCallback(async () => {
    if (!ownerId) { setLoading(false); return null; }
    try {
      const next = await getManagedDraft(ownerId);
      if (ownerRef.current === ownerId) {
        const current = detailRef.current;
        if (!current || current.draft.id !== next.draft.id || current.draft.revision <= next.draft.revision) {
          const accepted = current && JSON.stringify(current) === JSON.stringify(next) ? current : next;
          detailRef.current = accepted;
          setDetail(accepted);
        }
        setError(null);
      }
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo recuperar el borrador';
      if (ownerRef.current === ownerId) setError(message);
      return null;
    } finally { if (ownerRef.current === ownerId) setLoading(false); }
  }, [ownerId]);
  useEffect(() => {
    if (!ownerId) { setDetail(null); setLoading(false); return; }
    let active = true;
    detailRef.current = null; setDetail(null); setLoading(true); setError(null); mutationChain.current = Promise.resolve();
    void refresh();
    const timer = window.setInterval(() => { if (active) void refresh(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [ownerId, refresh]);
  const saveMetadataForDraft = useCallback((metadata: { title: string; synopsis: string | null; year?: string; genre?: string; language?: string }) => {
    return serializeMutation(async () => {
      const current = detailRef.current;
      if (!current || ownerRef.current !== ownerId) return;
      const draft = await saveManagedMetadata(current, metadata);
      const latest = detailRef.current;
      if (latest?.draft.id === draft.id && ownerRef.current === ownerId) {
        const updated = { ...latest, draft };
        detailRef.current = updated;
        setDetail(updated);
      }
    });
  }, [ownerId]);
  const upload = useCallback(async (input: { file: File; role: AssetRole; language?: string; idempotencyKey: string; sessionId?: string; signal: AbortSignal;
    onEnvelope?: (envelope: ManagedEnvelope) => void; onProgress?: (percent: number) => void; onState?: (state: string) => void }) => {
    const current = detailRef.current ?? await refresh();
    if (!current || ownerRef.current !== ownerId) throw new Error('UPLOAD_DRAFT_UNAVAILABLE');
    await mutationChain.current;
    const latest = detailRef.current ?? current;
    const envelope = await uploadManagedAsset({ ...input, draft: latest.draft, onEnvelope: result => {
      updateEnvelope(result); input.onEnvelope?.(result);
    } });
    updateEnvelope(envelope);
    return envelope;
  }, [ownerId, refresh, updateEnvelope]);
  const cancel = useCallback((sessionId: string) => serializeMutation(async () => {
    const current = detailRef.current?.uploads.find(item => item.session.sessionId === sessionId);
    if (!current) return;
    const result = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${sessionId}/cancel`, 'POST', { revision: current.session.revision }));
    updateEnvelope(result);
  }), [updateEnvelope]);
  const pause = useCallback((sessionId: string) => serializeMutation(async () => {
    const current = detailRef.current?.uploads.find(item => item.session.sessionId === sessionId);
    if (!current) return;
    const result = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${sessionId}/pause`, 'POST', { revision: current.session.revision }));
    updateEnvelope(result);
  }), [updateEnvelope]);
  const setLanguage = useCallback((sessionId: string, language: string) => serializeMutation(async () => {
    const current = detailRef.current?.uploads.find(item => item.session.sessionId === sessionId);
    if (!current) return;
    const result = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${sessionId}/language`, 'POST', { revision: current.draftRevision, language }));
    updateEnvelope(result);
  }), [updateEnvelope]);
  const reorder = useCallback((sessionId: string, position: number) => serializeMutation(async () => {
    const current = detailRef.current;
    const item = current?.uploads.find(envelope => envelope.session.sessionId === sessionId);
    if (!current || !item) return;
    const result = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${sessionId}/reorder`, 'POST', {
      draft_id: current.draft.id, revision: current.draft.revision, position,
    }));
    updateEnvelope(result);
  }), [updateEnvelope]);
  const retry = useCallback((envelope: ManagedEnvelope) => serializeMutation(async () => {
    const result = managedEnvelopeSchema.parse(await uploadApi(`/api/uploads/${envelope.session.sessionId}/retry`, 'POST', {
      revision: envelope.session.revision, asset_revision: envelope.asset.revision, idempotency_key: crypto.randomUUID(),
    }));
    updateEnvelope(result); return result;
  }), [updateEnvelope]);
  const abandon = useCallback(() => serializeMutation(async () => {
    const current = detailRef.current; if (!current) return;
    await uploadApi(`/api/upload-drafts/${current.draft.id}`, 'DELETE');
    try { window.localStorage.removeItem(`gma-media-draft:v1:${ownerId}`); } catch { /* optional cache */ }
    detailRef.current = null;
    setDetail(null);
  }), [ownerId]);
  return { ownerId, detail, loading, error, refresh, saveMetadata: saveMetadataForDraft, upload, cancel, pause, setLanguage, reorder, retry, abandon, adoptEnvelope: updateEnvelope };
}
