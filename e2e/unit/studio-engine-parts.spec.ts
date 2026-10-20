import { expect, test } from "@playwright/test";
import { validateFile, imageSizeAdvice, imageContentProblem, sniffImageType } from "../../lib/studio/file-rules";
import { loadDraft, saveDraft, clearDraft, DRAFT_STORAGE_KEY, type DraftStorage } from "../../lib/studio/draft-storage";
import { buildLegacyTitlePayload } from "../../lib/studio/legacy-payload";
import { emptyDraft, type UploadDraft } from "../../lib/studio/upload-draft";

const MB = 1024 * 1024;
const file = (name: string, size: number, type: string) => ({ name, size, type });

test.describe("reglas de archivos", () => {
  test("imágenes: JPG, PNG, WebP o AVIF de hasta 10 MB", () => {
    expect(validateFile("image", file("a.jpg", 2 * MB, "image/jpeg"))).toBeNull();
    expect(validateFile("image", file("a.png", 10 * MB, "image/png"))).toBeNull();
    expect(validateFile("image", file("a.webp", MB, "image/webp"))).toBeNull();
    expect(validateFile("image", file("a.avif", MB, "image/avif"))).toBeNull();
    expect(validateFile("image", file("a.avif", MB, ""))).toBeNull(); // sin tipo: se confía en la extensión y luego en el contenido
    expect(validateFile("image", file("a.gif", MB, "image/gif"))).toMatch(/GIF/);
    expect(validateFile("image", file("a.bmp", MB, "image/bmp"))).toMatch(/JPG, PNG, WebP o AVIF/);
    expect(validateFile("image", file("a.jpg", 10 * MB + 1, "image/jpeg"))).toMatch(/10 MB/);
  });

  test("imágenes: el formato real se reconoce por el contenido", () => {
    const bytes = (...values: number[]) => Uint8Array.from([...values, ...new Array(32).fill(0)]);
    const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
    expect(sniffImageType(bytes(0, 0, 0, 28, ...ascii("ftypavif")))).toBe("image/avif");
    expect(sniffImageType(bytes(...ascii("GIF89a")))).toBeNull(); // un GIF, aunque se llame .jpg
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  test("imágenes: medidas que no valen se rechazan con la medida esperada", () => {
    const expected = { width: 1920, height: 1080 };
    expect(imageContentProblem("image/jpeg", { width: 1920, height: 1080 }, expected)).toBeNull();
    expect(imageContentProblem("image/png", { width: 5000, height: 5000 }, expected)).toBeNull(); // 25 Mpx justos
    expect(imageContentProblem("image/png", { width: 6000, height: 5000 }, expected)).toMatch(/30,0 megapíxeles[\s\S]*1920 × 1080/);
    expect(imageContentProblem(null, { width: 100, height: 100 }, expected)).toMatch(/JPG, PNG, WebP o AVIF/);
    expect(imageContentProblem("image/jpeg", null, expected)).toMatch(/dañado[\s\S]*1920 × 1080/);
  });

  test("subtítulos: archivos .srt pequeños", () => {
    expect(validateFile("subtitle", file("es.srt", 40_000, ""))).toBeNull();
    expect(validateFile("subtitle", file("es.txt", 40_000, "text/plain"))).toMatch(/\.srt/);
    expect(validateFile("subtitle", file("es.srt", 6 * MB, ""))).toMatch(/5 MB/);
  });

  test("vídeo: tiene que ser un vídeo y no pasar de 4 GB", () => {
    expect(validateFile("video", file("peli.mp4", 800 * MB, "video/mp4"))).toBeNull();
    expect(validateFile("video", file("peli.mov", 800 * MB, ""))).toBeNull(); // sin tipo: se confía en la extensión
    expect(validateFile("video", file("foto.jpg", MB, "image/jpeg"))).toMatch(/vídeo/i);
    expect(validateFile("video", file("peli.mp4", 5 * 1024 * MB, "video/mp4"))).toMatch(/4 GB/);
    expect(validateFile("video", file("vacío.mp4", 0, "video/mp4"))).toMatch(/vacío/i);
  });

  test("consejo de tamaño de imagen: avisa pero no bloquea", () => {
    expect(imageSizeAdvice({ width: 595, height: 842 }, { width: 595, height: 842 })).toBeNull();
    expect(imageSizeAdvice({ width: 1920, height: 1080 }, { width: 1920, height: 1080 })).toBeNull();
    expect(imageSizeAdvice({ width: 800, height: 600 }, { width: 1920, height: 1080 })).toMatch(/1920/);
    // proporción distinta aunque sea grande
    expect(imageSizeAdvice({ width: 3000, height: 3000 }, { width: 595, height: 842 })).toMatch(/proporción/i);
    // mayor y con la misma proporción: bien
    expect(imageSizeAdvice({ width: 3840, height: 2160 }, { width: 1920, height: 1080 })).toBeNull();
  });
});

/** Almacenamiento falso con la misma forma que localStorage. */
function fakeStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test.describe("borrador en el navegador", () => {
  test("si no hay nada guardado, devuelve un borrador vacío", () => {
    expect(loadDraft(fakeStorage())).toEqual(emptyDraft());
  });

  test("guarda y recupera el borrador", () => {
    const storage = fakeStorage();
    const draft: UploadDraft = { ...emptyDraft(), title: "Nieve", categories: ["Animación"] };
    saveDraft(storage, draft);
    expect(loadDraft(storage)).toEqual(draft);
  });

  test("los archivos que solo existían como enlace temporal del navegador piden volver a subirse", () => {
    const storage = fakeStorage();
    const draft: UploadDraft = {
      ...emptyDraft(),
      images: { ...emptyDraft().images, poster: { name: "p.jpg", sizeBytes: 5, url: "blob:http://localhost/abc", status: "done" } },
    };
    saveDraft(storage, draft);
    const loaded = loadDraft(storage);
    expect(loaded.images.poster).toMatchObject({ name: "p.jpg", url: null, status: "error" });
    expect(loaded.images.poster?.error).toMatch(/subir/i);
  });

  test("los archivos ya alojados (con dirección real) se conservan", () => {
    const storage = fakeStorage();
    const asset = { name: "p.jpg", sizeBytes: 5, url: "https://cdn.test/p.jpg", status: "done" as const };
    saveDraft(storage, { ...emptyDraft(), images: { ...emptyDraft().images, poster: asset } });
    expect(loadDraft(storage).images.poster).toEqual(asset);
  });

  test("lo que se estaba subiendo al cerrar se marca como interrumpido", () => {
    const storage = fakeStorage();
    saveDraft(storage, { ...emptyDraft(), video: { file: { name: "v.mp4", sizeBytes: 9, url: null, status: "uploading", progress: 33 } } });
    expect(loadDraft(storage).video.file).toMatchObject({ status: "error" });
    // un vídeo que se estaba procesando al cerrar la página tampoco se puede dar por bueno
    saveDraft(storage, { ...emptyDraft(), video: { file: { name: "v.mp4", sizeBytes: 9, url: null, status: "processing" } } });
    expect(loadDraft(storage).video.file).toMatchObject({ status: "error" });
  });

  test("un guardado corrupto o de otra versión no rompe nada: borrador vacío", () => {
    const storage = fakeStorage();
    storage.setItem(DRAFT_STORAGE_KEY, "{no es json");
    expect(loadDraft(storage)).toEqual(emptyDraft());
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: 99, title: "x" }));
    expect(loadDraft(storage)).toEqual(emptyDraft());
  });

  test("clearDraft borra el borrador", () => {
    const storage = fakeStorage();
    saveDraft(storage, { ...emptyDraft(), title: "A" });
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual(emptyDraft());
  });

  test("si el almacenamiento falla (lleno o bloqueado) no lanza errores", () => {
    const broken: DraftStorage = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("lleno"); }, removeItem: () => { throw new Error("x"); } };
    expect(() => saveDraft(broken, emptyDraft())).not.toThrow();
    expect(loadDraft(broken)).toEqual(emptyDraft());
    expect(() => clearDraft(broken)).not.toThrow();
  });
});

test.describe("conversión al formato actual de «/api/titles»", () => {
  const done = (url: string) => ({ name: "x", sizeBytes: 1, url, status: "done" as const });
  const base = (): UploadDraft => ({
    ...emptyDraft(),
    title: "  Nieve ", durationMinutes: 12, releaseYear: 2025, language: "es", synopsisShort: "Corta.", synopsisLong: "Larga.",
    categories: ["Animación"], genres: ["Drama", "Comedia"],
    video: { file: done("https://cdn.test/v.mp4") },
    images: { ...emptyDraft().images, poster: done("https://cdn.test/p.jpg"), banner: done("https://cdn.test/b.jpg") },
    srtSubtitles: [{ language: "es", file: done("https://cdn.test/es.srt") }],
  });

  test("traduce lo que ya admite el servidor", () => {
    const payload = buildLegacyTitlePayload(base());
    expect(payload).toMatchObject({
      title: "Nieve", synopsis: "Larga.", year: "2025", duration: "12 min", language: "Español",
      r2VideoUrl: "https://cdn.test/v.mp4", r2PosterUrl: "https://cdn.test/p.jpg", r2SubtitleUrl: "https://cdn.test/es.srt",
    });
  });

  test("el género es el primero que el servidor reconoce (si lo hay)", () => {
    expect(buildLegacyTitlePayload(base())?.genre).toBe("Drama");
    expect(buildLegacyTitlePayload({ ...base(), genres: ["Zombis"], categories: ["Terror"] })?.genre).toBe("Terror");
    expect(buildLegacyTitlePayload({ ...base(), genres: ["Zombis"], categories: ["Otros"] })?.genre).toBeUndefined();
  });

  test("sin vídeo alojado no hay carga útil (no se puede publicar)", () => {
    expect(buildLegacyTitlePayload({ ...base(), video: { file: null } })).toBeNull();
  });

  test("usa la imagen horizontal como cartel si no hay cartel vertical", () => {
    const d = base();
    expect(buildLegacyTitlePayload({ ...d, images: { ...d.images, poster: null } })?.r2PosterUrl).toBe("https://cdn.test/b.jpg");
  });
});
