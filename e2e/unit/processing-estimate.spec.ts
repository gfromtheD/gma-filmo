import { test, expect } from "@playwright/test";
import { PROCESSING_SPEED, keepProcessingClock, processingEstimate } from "../../lib/studio/processing-estimate";
import { setAsset, emptyDraft, type UploadedAsset } from "../../lib/studio/upload-draft";

const movie = (status: UploadedAsset["status"], extra: Partial<UploadedAsset> = {}): UploadedAsset => ({
  name: "peli.mp4", sizeBytes: 1000, url: null, status, ...extra,
});

test.describe("processingEstimate", () => {
  test("a mitad del tiempo previsto marca el 50 % y la mitad restante", () => {
    const total = 3600 / PROCESSING_SPEED;
    const estimate = processingEstimate(3600, 1000, 1000 + (total / 2) * 1000);
    expect(estimate?.percent).toBe(50);
    expect(Math.round(estimate!.remainingSeconds)).toBe(Math.round(total / 2));
  });
  test("pasado el tiempo previsto se queda en el 95 % y sin tiempo restante", () => {
    expect(processingEstimate(600, 1000, 10_000_000)).toEqual({ percent: 95, remainingSeconds: 0 });
  });
  test("sin duración o sin hora de inicio no estima", () => {
    expect(processingEstimate(undefined, 1, 2)).toBeNull();
    expect(processingEstimate(600, undefined, 2)).toBeNull();
  });
});

test.describe("keepProcessingClock", () => {
  test("al pasar a procesar apunta la hora y conserva la duración leída al elegir el archivo", () => {
    const next = keepProcessingClock(movie("uploading", { mediaSeconds: 5000 }), movie("processing"), 42);
    expect(next).toMatchObject({ processingSince: 42, mediaSeconds: 5000 });
  });
  test("si el servidor vuelve a decir que procesa, la hora de inicio no se reinicia", () => {
    const next = keepProcessingClock(movie("processing", { processingSince: 10, mediaSeconds: 5000 }), movie("processing"), 999);
    expect(next.processingSince).toBe(10);
  });
  test("un archivo distinto empieza su propia cuenta", () => {
    const next = keepProcessingClock(movie("processing", { processingSince: 10, mediaSeconds: 5000 }), { ...movie("processing"), name: "otra.mp4" }, 999);
    expect(next).toMatchObject({ processingSince: 999, mediaSeconds: undefined });
  });
  test("setAsset aplica el reloj al hueco del vídeo", () => {
    const draft = setAsset(setAsset(emptyDraft(), "video", movie("uploading", { mediaSeconds: 100 })), "video", movie("processing"));
    expect(draft.video.file?.processingSince).toBeGreaterThan(0);
    expect(draft.video.file?.mediaSeconds).toBe(100);
  });
});
