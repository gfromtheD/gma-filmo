import { buildLegacyTitlePayload } from "@/lib/studio/legacy-payload";
import { validateFile, type FileRuleKind } from "@/lib/studio/file-rules";
import { createLazyMediaEngine } from "@/lib/studio-media/lazy-media-engine";
import type { UploadDraft, UploadedAsset, UploadPhase } from "@/lib/studio/upload-draft";

/**
 * EL ENCHUFE entre la interfaz de subida y el motor que aloja y sirve los archivos.
 *
 * La interfaz solo habla con `UploadEngine`. Hoy hay dos implementaciones:
 *  - `localEngine` (por defecto, segura): valida los archivos y simula la subida; no envía nada fuera del navegador.
 *  - `legacyEngine`: usa lo que ya existe (URL prefirmada de R2 + `POST /api/titles`). Solo cubre vídeo, cartel, banner
 *    y subtítulos; el resto se queda en local hasta que llegue el motor definitivo.
 * Cuando llegue el motor nuevo, se escribe otra implementación de esta interfaz y se cambia `getUploadEngine`.
 */

/** Dónde va cada archivo (clave del hueco) y de qué clase es. */
export interface AssetRequest {
  /** Hueco del borrador: `video`, `trailer`, `poster`, `banner`, `extra:0`, `srt:0`, `doc:directionMemory`, `doc:extra:2`. */
  readonly slot: string;
  readonly rule: FileRuleKind;
  readonly file: File;
}

export type SubmitResult =
  | { readonly status: "published"; readonly slug: string; readonly message: string }
  | { readonly status: "queued"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

export interface UploadEngine {
  readonly id: "local" | "legacy" | "media";
  /** `false` mientras el motor real no está enchufado: la interfaz lo avisa al usuario. */
  readonly connected: boolean;
  /**
   * Sube un archivo. `onProgress` informa del porcentaje de subida; `onProcessing` (opcional) avisa de que la subida ha
   * terminado y el servidor está procesando el vídeo (conversión, optimización, versiones HLS…).
   */
  uploadAsset(
    request: AssetRequest, onProgress: (percent: number) => void, signal?: AbortSignal, onProcessing?: () => void,
    /** Cambio de etapa (`checking` → `uploading` → `processing`); `percent` solo en `checking` (avance de la comprobación). */
    onPhase?: (phase: UploadPhase, percent?: number) => void,
  ): Promise<UploadedAsset>;
  submit(draft: UploadDraft): Promise<SubmitResult>;
  /**
   * Tras recargar la página: vuelve a vigilar un archivo que ya se envió y el servidor seguía convirtiendo, hasta que acaba.
   * `null` si el servidor ya no lo tiene. Sin este método (motores sin servidor), ese archivo hay que volver a subirlo.
   */
  resumeProcessing?(slot: string, signal: AbortSignal): Promise<UploadedAsset | null>;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Cancelado", "AbortError")); }, { once: true });
  });

/** Duración simulada del procesado de un vídeo en el motor local. */
const LOCAL_PROCESSING_MS = 3000;

/** Sube «en local»: valida y simula el progreso. El archivo no sale del navegador. */
async function simulateUpload(request: AssetRequest, onProgress: (p: number) => void, signal?: AbortSignal, onProcessing?: () => void): Promise<UploadedAsset> {
  const problem = validateFile(request.rule, request.file);
  if (problem) return { name: request.file.name, sizeBytes: request.file.size, url: null, status: "error", error: problem };
  for (const step of [20, 45, 70, 100]) {
    await wait(request.rule === "video" ? 120 : 40, signal);
    onProgress(step);
  }
  if (request.slot === "video") {
    // el motor real convertirá y optimizará la película: aquí se simula esa espera
    onProcessing?.();
    await wait(LOCAL_PROCESSING_MS, signal);
  }
  return {
    name: request.file.name,
    sizeBytes: request.file.size,
    url: typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(request.file) : null,
    status: "done",
    localOnly: true,
  };
}

export const localEngine: UploadEngine = {
  id: "local",
  connected: false,
  uploadAsset: simulateUpload,
  async submit() {
    await wait(300);
    return { status: "queued", message: "Tu título está listo. Se enviará a revisión en cuanto se conecte el motor de subida." };
  },
};

/** Huecos que el servidor actual sabe alojar y el tipo de activo que usa su URL prefirmada. */
const LEGACY_ASSET_TYPES: Readonly<Record<string, string>> = { video: "main", trailer: "trailer", poster: "poster_v", banner: "poster_h" };
const legacyAssetType = (slot: string) => (slot.startsWith("srt:") ? "subtitles" : LEGACY_ASSET_TYPES[slot]);

async function authHeader(): Promise<Record<string, string>> {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser");
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function putToR2(request: AssetRequest, assetType: string, onProgress: (p: number) => void, signal?: AbortSignal): Promise<UploadedAsset> {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  const contentType = request.file.type || "application/octet-stream";
  const presign = await fetch("/api/upload/presign", {
    method: "POST", signal, headers,
    body: JSON.stringify({ assetType, fileName: request.file.name, fileSize: request.file.size, contentType }),
  });
  if (!presign.ok) {
    const body = (await presign.json().catch(() => ({}))) as { error?: string };
    return { name: request.file.name, sizeBytes: request.file.size, url: null, status: "error", error: body.error ?? `Error ${presign.status}` };
  }
  const { presignedUrl, publicUrl } = (await presign.json()) as { presignedUrl: string; publicUrl: string };
  const ok = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress((e.loaded / e.total) * 100); };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(request.file);
  });
  return ok
    ? { name: request.file.name, sizeBytes: request.file.size, url: publicUrl, status: "done" }
    : { name: request.file.name, sizeBytes: request.file.size, url: null, status: "error", error: "No se pudo subir el archivo. Inténtalo de nuevo." };
}

export const legacyEngine: UploadEngine = {
  id: "legacy",
  connected: true,
  async uploadAsset(request, onProgress, signal) {
    const problem = validateFile(request.rule, request.file);
    if (problem) return { name: request.file.name, sizeBytes: request.file.size, url: null, status: "error", error: problem };
    const assetType = legacyAssetType(request.slot);
    return assetType ? putToR2(request, assetType, onProgress, signal) : simulateUpload(request, onProgress, signal);
  },
  async submit(draft) {
    const payload = buildLegacyTitlePayload(draft);
    if (!payload) return { status: "error", message: "Para publicar con este servidor, el vídeo tiene que estar subido como archivo." };
    try {
      const res = await fetch("/api/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; title?: { slug?: string } };
      if (!res.ok) return { status: "error", message: body.error ?? `Error ${res.status}` };
      return { status: "published", slug: body.title?.slug ?? "", message: "Tu título se ha publicado." };
    } catch {
      return { status: "error", message: "Error de red al enviar el título." };
    }
  },
};

/**
 * Motor activo. Con `NEXT_PUBLIC_UPLOAD_ENGINE_V2=true` y un borrador disponible, el motor multimedia (subidas reales,
 * PeerTube). Con `NEXT_PUBLIC_STUDIO_ENGINE=legacy`, el servidor histórico (R2). Si no, el simulado. Combinación no
 * permitida: motor v2 + `legacy` (el servidor responde 410 a la URL prefirmada): con el motor encendido manda el motor.
 */
export function getUploadEngine(getDraft?: () => UploadDraft): UploadEngine {
  if (process.env.NEXT_PUBLIC_UPLOAD_ENGINE_V2 === "true" && getDraft) return createLazyMediaEngine(getDraft);
  return process.env.NEXT_PUBLIC_STUDIO_ENGINE === "legacy" ? legacyEngine : localEngine;
}
