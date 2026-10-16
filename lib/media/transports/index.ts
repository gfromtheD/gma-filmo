import type { TransferDescriptor } from '@/types/media-engine';
import { multipartAsset } from './multipart';
import { putAsset } from './put';
import { tusAsset } from './tus';
import { uploadx } from './uploadx';
import type { UploadApi } from './api';

export async function transferAsset(input: { file: File; sessionId: string; descriptor: TransferDescriptor; signal: AbortSignal;
  api: UploadApi; refresh: () => Promise<TransferDescriptor>; onProgress: (percent: number) => void }): Promise<void> {
  const { file, sessionId, descriptor, signal, api, refresh, onProgress } = input;
  switch (descriptor.protocol) {
    case 'put': await putAsset(file, descriptor, signal); onProgress(100); return;
    case 'multipart': await multipartAsset(file, sessionId, descriptor, signal, api, (chunk, url, abort) => putAsset(chunk, { url, headers: {} }, abort), onProgress); return;
    case 'tus': await tusAsset(file, descriptor, signal, onProgress); return;
    case 'uploadx': await uploadx({ file, transfer: descriptor, refresh: async () => {
      const next = await refresh(); if (next.protocol !== 'uploadx') throw new Error('UPLOAD_PROTOCOL_CHANGED'); return next;
    }, signal, onProgress: (confirmed, total) => onProgress(total ? confirmed / total * 100 : 0) }); return;
  }
}
