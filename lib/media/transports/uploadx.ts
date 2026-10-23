import type { UploadxTransferDescriptor } from '@/types/media-engine';

export type UploadxFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface UploadxOptions {
  file: Blob;
  transfer: UploadxTransferDescriptor;
  refresh: () => Promise<UploadxTransferDescriptor>;
  signal: AbortSignal;
  fetcher?: UploadxFetch;
  onProgress?: (confirmedBytes: number, totalBytes: number) => void;
  /** Bytes que probablemente ya han salido del trozo en vuelo (solo para pintar una barra fluida; nunca para reanudar). */
  onEstimate?: (estimatedBytes: number, totalBytes: number) => void;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

/** Velocidad supuesta para el primer trozo (~2 MB/s); después se usa la medida del trozo anterior. */
const INITIAL_BYTES_PER_MS = 2_000;
const ESTIMATE_EVERY_MS = 400;
/** La estimación nunca llega al final del trozo: el 100 % de un trozo lo confirma el servidor. */
const ESTIMATE_CEILING = 0.95;

/** Mientras un trozo viaja, avisa cada poco de cuánto habrá salido según la velocidad medida. Devuelve la función que lo para. */
function estimateInFlight(offset: number, size: number, total: number, bytesPerMs: number,
  onEstimate: UploadxOptions['onEstimate']): () => void {
  if (!onEstimate) return () => undefined;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const sent = Math.min(size * ESTIMATE_CEILING, bytesPerMs * (Date.now() - startedAt));
    onEstimate(offset + Math.floor(sent), total);
  }, ESTIMATE_EVERY_MS);
  return () => clearInterval(timer);
}

function parseOffset(response: Response, previous: number, total: number): number {
  if (response.status === 200) return total;
  if (response.status !== 308) throw new Error(`UPLOADX_HTTP_${response.status}`);
  const range = response.headers.get('range');
  if (!range) return previous;
  const match = /^bytes=0-(0|[1-9]\d*)$/.exec(range);
  if (!match) throw new Error('UPLOADX_RANGE_INVALID');
  const offset = Number(match[1]) + 1;
  if (!Number.isSafeInteger(offset) || offset < previous || offset > total) throw new Error('UPLOADX_OFFSET_INVALID');
  return offset;
}

function abortableWait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Interrumpido', 'AbortError')); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    const abort = () => { clearTimeout(timer); reject(new DOMException('Interrumpido', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Sends bounded, serial uploadx chunks and treats the server-confirmed Range as authoritative. */
export async function uploadx(options: UploadxOptions): Promise<void> {
  const { file, signal } = options;
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? abortableWait;
  let transfer = options.transfer;
  const total = file.size;
  if (!Number.isSafeInteger(total) || total < 1 || total !== transfer.totalBytes || transfer.offset > total) {
    throw new Error('UPLOADX_FILE_IDENTITY_MISMATCH');
  }
  let offset = transfer.offset;
  let finalConfirmed = false;
  let bytesPerMs = INITIAL_BYTES_PER_MS;
  options.onProgress?.(offset, total);
  for (let attempt = 0; offset < total;) {
    if (signal.aborted) throw new DOMException('Interrumpido', 'AbortError');
    if (Date.parse(transfer.expiresAt) <= Date.now()) transfer = await options.refresh();
    const end = Math.min(offset + transfer.chunkSize, total) - 1;
    const sentAt = Date.now();
    const estimate = estimateInFlight(offset, end - offset + 1, total, bytesPerMs, options.onEstimate);
    try {
      const response = await fetcher(transfer.url, {
        method: 'PUT', signal,
        headers: { ...transfer.headers, 'Content-Type': file.type || 'application/octet-stream', 'Content-Range': `bytes ${offset}-${end}/${total}` },
        body: file.slice(offset, end + 1),
      }).finally(estimate);
      bytesPerMs = (end - offset + 1) / Math.max(1, Date.now() - sentAt);
      const confirmed = parseOffset(response, offset, total);
      if (confirmed === offset && response.status !== 200) throw new Error('UPLOADX_OFFSET_NOT_ADVANCED');
      offset = confirmed;
      finalConfirmed = response.status === 200;
      attempt = 0;
      options.onProgress?.(offset, total);
    } catch (error) {
      if (signal.aborted || error instanceof DOMException && error.name === 'AbortError') throw error;
      if (error instanceof Error && /^(UPLOADX_(RANGE_INVALID|OFFSET_INVALID|OFFSET_NOT_ADVANCED|FILE_IDENTITY_MISMATCH|RECOVERY_CONFLICT)|UPLOADX_HTTP_(400|404|409|410|422))$/.test(error.message)) throw error;
      if (attempt >= 4) throw error;
      transfer = await options.refresh();
      if (transfer.totalBytes !== total || transfer.offset < offset) throw new Error('UPLOADX_RECOVERY_CONFLICT');
      offset = transfer.offset;
      options.onProgress?.(offset, total);
      if (offset < total) await wait([1000, 2000, 4000, 8000][attempt]!, signal);
      attempt++;
    }
  }
  if (!finalConfirmed) await confirmFinal(fetcher, transfer, total, signal, options.refresh);
}

/**
 * Every byte is already on the server but no 200 was seen (a resumed or recovered transfer). An empty status probe lets
 * the gateway finish or replay its receipt; anything but 200 means the transfer is not complete.
 */
async function confirmFinal(fetcher: UploadxFetch, current: UploadxTransferDescriptor, total: number, signal: AbortSignal,
  refresh: () => Promise<UploadxTransferDescriptor>): Promise<void> {
  if (signal.aborted) throw new DOMException('Interrumpido', 'AbortError');
  const transfer = Date.parse(current.expiresAt) <= Date.now() ? await refresh() : current;
  const response = await fetcher(transfer.url, { method: 'PUT', signal, headers: { ...transfer.headers, 'Content-Range': `bytes */${total}` } });
  if (response.status !== 200) throw new Error(`UPLOADX_HTTP_${response.status}`);
}
