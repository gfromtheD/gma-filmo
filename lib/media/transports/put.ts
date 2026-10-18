import type { PutTransferDescriptor } from '@/types/media-engine';

export async function putAsset(file: Blob, transfer: Pick<PutTransferDescriptor, 'url' | 'headers'>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Interrumpido', 'AbortError');
  const response = await fetch(transfer.url, { method: 'PUT', signal, headers: transfer.headers, body: file });
  if (!response.ok) throw new Error(`PUT_HTTP_${response.status}`);
}
