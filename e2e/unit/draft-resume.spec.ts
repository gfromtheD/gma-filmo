import { expect, test } from "@playwright/test";
import { emptyDraft, processingAssets, type UploadDraft, type UploadedAsset } from "../../lib/studio/upload-draft";
import { DRAFT_STORAGE_KEY, loadDraft, type DraftStorage } from "../../lib/studio/draft-storage";

const asset = (over: Partial<UploadedAsset>): UploadedAsset => ({ name: "peli.mp4", sizeBytes: 1, url: null, status: "processing", ...over });
const stored = (draft: UploadDraft): DraftStorage => ({
  getItem: (k) => (k === DRAFT_STORAGE_KEY ? JSON.stringify(draft) : null), setItem: () => undefined, removeItem: () => undefined,
});

test.describe("recargar con un vídeo convirtiéndose", () => {
  test("el vídeo ya enviado sigue «procesando»: lo está convirtiendo el servidor, no hay que subirlo otra vez", () => {
    const video = loadDraft(stored({ ...emptyDraft(), video: { file: asset({ phase: "processing", progress: 40 }) } })).video.file;
    expect(video?.status).toBe("processing");
    expect(video?.error).toBeUndefined();
  });

  test("una transferencia a medias sí pide volver a elegir el archivo", () => {
    const video = loadDraft(stored({ ...emptyDraft(), video: { file: asset({ status: "uploading", progress: 40 }) } })).video.file;
    expect(video?.status).toBe("error");
    expect(video?.error).toContain("Vuelve a subir");
  });

  test("lista los huecos que el servidor sigue convirtiendo", () => {
    const draft: UploadDraft = {
      ...emptyDraft(),
      video: { file: asset({}) },
      trailer: { file: asset({ name: "trailer.mp4", status: "done", url: "/api/media/t" }) },
      extras: [{ id: "e1", kind: "video", file: asset({ name: "making.mp4" }) }],
    };
    expect(processingAssets(draft).map(([slot]) => slot)).toEqual(["video", "extra:e1"]);
  });
});
