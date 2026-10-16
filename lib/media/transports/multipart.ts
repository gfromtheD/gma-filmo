import type { MultipartTransferDescriptor } from '@/types/media-engine';
import type { UploadApi } from './api';

export async function multipartAsset(file: File, sessionId: string, transfer: MultipartTransferDescriptor, signal: AbortSignal,
  api: UploadApi, put: (chunk: Blob, url: string, signal: AbortSignal) => Promise<void>, onProgress: (percent: number) => void): Promise<void> {
  const inspect = async () => api<{ upload: { parts: { number: number; size: number }[]; complete: boolean } }>(`/api/uploads/${sessionId}/parts`, 'POST');
  const first = await inspect(); if (first.upload.complete) { onProgress(100); return; }
  const count = Math.ceil(file.size / transfer.partSize); const confirmed = new Map(first.upload.parts.map(part => [part.number, part.size]));
  const expected = (number: number) => Math.min(transfer.partSize, file.size - (number - 1) * transfer.partSize);
  const missing = Array.from({ length: count }, (_, index) => index + 1).filter(number => confirmed.get(number) !== expected(number));
  let cursor = 0; const sending = new Map<number, number>();
  const report = () => onProgress(Math.min(100, (Array.from(confirmed.values()).reduce((sum, size) => sum + size, 0) +
    Array.from(sending.values()).reduce((sum, size) => sum + size, 0)) / file.size * 100));
  const worker = async () => {
    while (cursor < missing.length) {
      if (signal.aborted) throw new DOMException('Interrumpido', 'AbortError');
      const number = missing[cursor++]!;
      for (let attempt = 0; attempt < 5; attempt++) {
        const part = await api<{ part: { url: string } }>(`/api/uploads/${sessionId}/part`, 'POST', { number, generation: transfer.generation });
        try {
          await put(file.slice((number - 1) * transfer.partSize, number * transfer.partSize), part.part.url, signal);
          confirmed.set(number, expected(number)); report(); break;
        } catch (error) {
          if (signal.aborted) throw error;
          const current = await inspect();
          if (current.upload.parts.some(item => item.number === number && item.size === expected(number))) { confirmed.set(number, expected(number)); report(); break; }
          if (attempt === 4) throw error;
          await new Promise(resolve => setTimeout(resolve, [1000, 2000, 4000, 8000][attempt]!));
        } finally { sending.delete(number); }
      }
    }
  };
  await Promise.all([worker(), worker()]);
  const final = await inspect(); if (!final.upload.complete) throw new Error('MULTIPART_INCOMPLETE'); onProgress(100);
}
