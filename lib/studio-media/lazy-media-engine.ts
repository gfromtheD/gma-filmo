/**
 * `UploadEngine` que carga el motor multimedia (cliente de subidas, hash SHA-256, transportes) solo cuando se usa por
 * primera vez, para que las páginas con el motor apagado no arrastren ese código. Es la pieza que `getUploadEngine`
 * devuelve con `NEXT_PUBLIC_UPLOAD_ENGINE_V2=true`.
 */
import type { AssetRequest, SubmitResult, UploadEngine } from '@/lib/studio/engine';
import type { UploadDraft, UploadedAsset } from '@/lib/studio/upload-draft';
import type { MediaUploadEngine } from './media-engine';

export function createLazyMediaEngine(getDraft: () => UploadDraft): UploadEngine & Pick<MediaUploadEngine, 'cancelAsset' | 'pauseAsset' | 'retryAsset' | 'saveFicha'> {
  let loaded: Promise<MediaUploadEngine> | null = null;
  const engine = () => (loaded ??= (async () => {
    const [{ createMediaEngine, browserMediaEngineDeps }] = await Promise.all([import('./media-engine')]);
    return createMediaEngine(await browserMediaEngineDeps(), { getDraft, publishMode: publishMode() });
  })().catch((error) => { loaded = null; throw error; }));

  return {
    id: 'media',
    connected: true,
    uploadAsset: async (request: AssetRequest, onProgress, signal, onProcessing, onPhase): Promise<UploadedAsset> =>
      (await engine()).uploadAsset(request, onProgress, signal, onProcessing, onPhase),
    submit: async (draft: UploadDraft): Promise<SubmitResult> => (await engine()).submit(draft),
    cancelAsset: async (slot) => (await engine()).cancelAsset(slot),
    pauseAsset: async (slot) => (await engine()).pauseAsset(slot),
    retryAsset: async (slot) => (await engine()).retryAsset(slot),
    saveFicha: async (draft) => (await engine()).saveFicha(draft),
  };
}

/** `NEXT_PUBLIC_STUDIO_PUBLISH=direct` publica al enviar; por defecto el título queda guardado sin publicar (revisión editorial pendiente). */
function publishMode(): 'hold' | 'direct' {
  return process.env.NEXT_PUBLIC_STUDIO_PUBLISH === 'direct' ? 'direct' : 'hold';
}
