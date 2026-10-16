import { Upload } from 'tus-js-client';
import type { TusTransferDescriptor } from '@/types/media-engine';

export function tusAsset(file: File, transfer: TusTransferDescriptor, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new Upload(file, { uploadUrl: transfer.url, chunkSize: transfer.chunkSize, parallelUploads: 1,
      retryDelays: [0, 1000, 3000, 5000, 10000], storeFingerprintForResuming: false,
      onProgress: (sent, total) => onProgress(total > 0 ? sent / total * 100 : 0),
      onError: (error) => finish(error), onSuccess: () => finish() });
    const abort = () => { void upload.abort(false); finish(new DOMException('Interrumpido', 'AbortError')); };
    const finish = (error?: Error) => { signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true }); upload.start();
  });
}
