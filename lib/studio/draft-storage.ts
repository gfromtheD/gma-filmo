import { emptyDraft, type UploadDraft, type UploadedAsset } from "@/lib/studio/upload-draft";

/** Lo mínimo de `localStorage` que se necesita (permite probarlo sin navegador). */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DRAFT_STORAGE_KEY = "gma-studio-upload-draft";

/** Un archivo que se guardó con un enlace temporal del navegador (`blob:`) o a medio subir ya no existe al volver. */
function reviveAsset<T extends UploadedAsset | null | undefined>(stored: T): T {
  if (!stored) return stored;
  // La vista previa local (`blob:`) muere al recargar: se vuelve a la imagen del servidor.
  const asset = stored.previewUrl ? { ...stored, previewUrl: undefined } : stored;
  const lost = asset.url?.startsWith("blob:") ?? false;
  const interrupted = asset.status === "uploading" || asset.status === "processing" || asset.status === "pending";
  if (!lost && !interrupted) return asset as T;
  return { ...asset, url: null, status: "error", progress: undefined, error: "Vuelve a subir este archivo." } as T;
}

function reviveDraft(draft: UploadDraft): UploadDraft {
  const images = Object.fromEntries(Object.entries(draft.images).map(([id, asset]) => [id, reviveAsset(asset)])) as UploadDraft["images"];
  return {
    ...draft,
    video: { file: reviveAsset(draft.video.file) },
    trailer: { file: reviveAsset(draft.trailer.file) },
    extras: draft.extras.map((e) => ({ ...e, file: reviveAsset(e.file) })),
    srtSubtitles: draft.srtSubtitles.map((srt) => ({ ...srt, file: reviveAsset(srt.file) })),
    images,
  };
}

/** Lee el borrador guardado; si no hay, está corrupto o es de otra versión, devuelve uno vacío. */
export function loadDraft(storage: DraftStorage): UploadDraft {
  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<UploadDraft> | null;
    if (!parsed || parsed.version !== 7) return emptyDraft();
    return reviveDraft({ ...emptyDraft(), ...parsed } as UploadDraft);
  } catch {
    return emptyDraft();
  }
}

/** Guarda el borrador; si el navegador lo impide (lleno, modo privado) se ignora sin romper la página. */
export function saveDraft(storage: DraftStorage, draft: UploadDraft): void {
  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* sin almacenamiento disponible: el borrador sigue en memoria */
  }
}

export function clearDraft(storage: DraftStorage): void {
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* nada que borrar */
  }
}
