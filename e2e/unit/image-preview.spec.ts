import { expect, test } from "@playwright/test";
import { emptyDraft, previewSrc, type UploadedAsset } from "../../lib/studio/upload-draft";
import { DRAFT_STORAGE_KEY, loadDraft, type DraftStorage } from "../../lib/studio/draft-storage";

const asset = (over: Partial<UploadedAsset>): UploadedAsset => ({ name: "cartel.jpg", sizeBytes: 1, url: null, status: "uploading", ...over });

test.describe("vista previa de imágenes", () => {
  test("se ve en cuanto se elige, sin esperar al servidor", () => {
    expect(previewSrc(asset({ previewUrl: "blob:local", progress: 10 }))).toBe("blob:local");
  });

  test("al terminar sigue la local; sin ella, la del servidor", () => {
    expect(previewSrc(asset({ status: "done", url: "/api/media/x", previewUrl: "blob:local" }))).toBe("blob:local");
    expect(previewSrc(asset({ status: "done", url: "/api/media/x" }))).toBe("/api/media/x");
  });

  test("un archivo con error no enseña imagen", () => {
    expect(previewSrc(asset({ status: "error", previewUrl: "blob:local" }))).toBeNull();
  });

  test("al recargar, la vista local se descarta y queda la del servidor", () => {
    const saved = { ...emptyDraft(), images: { ...emptyDraft().images, poster: asset({ status: "done", url: "/api/media/x", previewUrl: "blob:local" }) } };
    const storage: DraftStorage = { getItem: (k) => (k === DRAFT_STORAGE_KEY ? JSON.stringify(saved) : null), setItem: () => undefined, removeItem: () => undefined };
    const poster = loadDraft(storage).images.poster;
    expect(poster?.previewUrl).toBeUndefined();
    expect(previewSrc(poster)).toBe("/api/media/x");
  });
});
