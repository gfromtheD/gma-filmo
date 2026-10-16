import { expect, test } from "@playwright/test";
import {
  UPLOAD_STEPS,
  emptyDraft,
  isReadyToSubmit,
  reviewDraft,
  type UploadDraft,
  type UploadedAsset,
} from "../../lib/studio/upload-draft";

const done = (name: string, sizeBytes = 1_000_000): UploadedAsset => ({ name, sizeBytes, url: `https://cdn.test/${name}`, status: "done" });

/** Un borrador completo y válido, para ir rompiéndolo campo a campo. */
function fullDraft(): UploadDraft {
  const d = emptyDraft();
  return {
    ...d,
    video: { file: done("peli.mp4") },
    title: "Nieve", originalTitle: "Snow", durationMinutes: 12, productionCountry: "ES", releaseYear: 2025,
    categories: ["Animación"], language: "es",
    images: { poster: done("p.jpg"), banner: done("b.jpg") },
    synopsisShort: "Una historia breve.", synopsisLong: "Una historia algo más larga que la corta.",
    team: [{ name: "Ana Pérez", role: "Director/a" }],
    ai: { used: false, note: "" },
    acceptedTerms: true,
  };
}

const step = (draft: UploadDraft, id: string) => reviewDraft(draft).find((s) => s.id === id)!;

test.describe("pasos de la subida", () => {
  test("son los 3 pasos de la pasarela, en orden", () => {
    expect(UPLOAD_STEPS.map((s) => s.id)).toEqual([
      "video", "ficha", "datos",
    ]);
  });
});

test.describe("borrador vacío", () => {
  test("no se puede enviar y los pasos obligatorios están incompletos", () => {
    const draft = emptyDraft();
    expect(isReadyToSubmit(draft)).toBe(false);
    for (const id of ["video", "ficha", "datos"]) {
      expect(step(draft, id).status, id).toBe("incomplete");
    }
  });
});

test.describe("borrador completo", () => {
  test("se puede enviar y todos los pasos obligatorios están completos", () => {
    const draft = fullDraft();
    expect(reviewDraft(draft).filter((s) => s.status === "incomplete")).toEqual([]);
    expect(isReadyToSubmit(draft)).toBe(true);
  });
});

test.describe("qué falta, paso a paso", () => {
  test("vídeo: hace falta el archivo, subido por completo", () => {
    const d = fullDraft();
    expect(step({ ...d, video: { file: null } }, "video").status).toBe("incomplete");
    // un vídeo que ya se subió pero el servidor aún procesa tampoco cuenta como completo
    const processing = step({ ...d, video: { file: { name: "a.mp4", sizeBytes: 1, url: null, status: "processing" } } }, "video");
    expect(processing.status).toBe("incomplete");
    expect(processing.missing.join(" ")).toContain("procesando");
    // un archivo que aún se está subiendo no cuenta como completo
    expect(step({ ...d, video: { file: { name: "a.mp4", sizeBytes: 1, url: null, status: "uploading", progress: 40 } } }, "video").status).toBe("incomplete");
  });

  test("ficha: título y ambas sinopsis son obligatorios", () => {
    const d = fullDraft();
    const cases: [string, Partial<UploadDraft>][] = [
      ["título", { title: "  " }],
      ["sinopsis corta", { synopsisShort: "" }], ["sinopsis larga", { synopsisLong: "" }],
    ];
    for (const [label, patch] of cases) {
      const s = step({ ...d, ...patch }, "ficha");
      expect(s.status, label).toBe("incomplete");
      expect(s.missing.join(" ").toLowerCase(), label).toContain(label.split(" ")[0]!);
    }
  });

  test("el título original es opcional", () => {
    expect(step({ ...fullDraft(), originalTitle: "" }, "ficha").status).toBe("complete");
  });

  test("ficha: la sinopsis corta admite 250 caracteres como máximo", () => {
    const d = fullDraft();
    expect(step({ ...d, synopsisShort: "a".repeat(251) }, "ficha").status).toBe("incomplete");
    expect(step({ ...d, synopsisShort: "a".repeat(250) }, "ficha").status).toBe("complete");
  });

  test("ficha: cartel y banner son obligatorios y no pueden tener errores de subida", () => {
    const d = fullDraft();
    expect(step({ ...d, images: { ...d.images, poster: null } }, "ficha").missing).toContain("Cartel");
    expect(step({ ...d, images: { ...d.images, banner: null } }, "ficha").missing).toContain("Banner");
    expect(step({ ...d, images: { ...d.images, banner: { name: "x", sizeBytes: 5, url: null, status: "error", error: "pesa mucho" } } }, "ficha").status).toBe("incomplete");
  });

  test("ficha: el tráiler y los extras son opcionales, pero lo que se añade debe estar bien", () => {
    const d = fullDraft();
    expect(step({ ...d, trailer: { file: null } }, "ficha").status).toBe("complete");
    expect(step({ ...d, trailer: { file: done("t.mp4") } }, "ficha").status).toBe("complete");
    expect(step({ ...d, trailer: { file: { name: "t.mp4", sizeBytes: 1, url: null, status: "error", error: "no es un vídeo" } } }, "ficha").status).toBe("incomplete");
    expect(step({ ...d, extras: [{ kind: "fotograma", file: null }] }, "ficha").status).toBe("incomplete");
    expect(step({ ...d, extras: [{ kind: "fotograma", file: done("f.jpg") }, { kind: "video", file: done("e.mp4") }] }, "ficha").status).toBe("complete");
    expect(step({ ...d, extras: [{ kind: "poster", file: { name: "x", sizeBytes: 5, url: null, status: "error", error: "solo imágenes" } }] }, "ficha").status).toBe("incomplete");
  });

  test("datos: duración, año de estreno, categoría e idioma son obligatorios; el país es opcional", () => {
    const d = fullDraft();
    const cases: [string, Partial<UploadDraft>][] = [
      ["duración", { durationMinutes: 0 }], ["año", { releaseYear: null }],
      ["categoría", { categories: [] }], ["idioma", { language: "" }],
    ];
    expect(step({ ...d, productionCountry: "" }, "datos").status).toBe("complete");
    expect(step({ ...d, releaseYear: 1700 }, "datos").status).toBe("incomplete");
    expect(step({ ...d, releaseYear: new Date().getFullYear() + 10 }, "datos").status).toBe("incomplete");
    for (const [label, patch] of cases) {
      const s = step({ ...d, ...patch }, "datos");
      expect(s.status, label).toBe("incomplete");
      expect(s.missing.join(" ").toLowerCase(), label).toContain(label.split(" ")[0]!);
    }
  });

  test("datos: los subtítulos .srt necesitan idioma y archivo, con un máximo de 5", () => {
    const d = fullDraft();
    expect(step({ ...d, srtSubtitles: [{ language: "", file: done("a.srt") }] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, srtSubtitles: [{ language: "en", file: null }] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, srtSubtitles: [{ language: "en", file: done("a.srt") }] }, "datos").status).toBe("complete");
    const six = Array.from({ length: 6 }, () => ({ language: "en", file: done("a.srt") }));
    expect(step({ ...d, srtSubtitles: six }, "datos").status).toBe("incomplete");
  });

  test("datos: hace falta al menos una persona con el papel de director/a; cada una, nombre y papel", () => {
    const d = fullDraft();
    expect(step({ ...d, team: [] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, team: [{ name: "Luis Gil", role: "Guionista" }] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, team: [{ name: "  ", role: "Director/a" }] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, team: [...d.team, { name: "Luis Gil", role: "" }] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, team: [...d.team, { name: "Luis Gil", role: "Guionista" }] }, "datos").status).toBe("complete");
  });

  test("premios y selecciones: opcionales, pero cada uno necesita su festival", () => {
    const d = fullDraft();
    expect(step({ ...d, awards: [] }, "datos").status).toBe("complete");
    expect(step({ ...d, awards: [{ festival: "", award: "Mejor corto" }] }, "datos").status).toBe("incomplete");
    expect(step({ ...d, awards: [{ festival: "Festival de Málaga", award: "" }] }, "datos").status).toBe("complete");
  });

  test("el aviso de IA no bloquea el envío, se marque o no", () => {
    const d = fullDraft();
    expect(isReadyToSubmit({ ...d, ai: { used: true, note: "" } })).toBe(true);
    expect(isReadyToSubmit({ ...d, ai: { used: true, note: "Voz sintética en el narrador." } })).toBe(true);
  });

  test("enviar exige todos los pasos completos y haber aceptado los términos", () => {
    const d = fullDraft();
    expect(isReadyToSubmit(d)).toBe(true);
    expect(isReadyToSubmit({ ...d, acceptedTerms: false })).toBe(false);
    expect(isReadyToSubmit({ ...d, title: "" })).toBe(false);
  });
});

test.describe("el borrador no se modifica al revisarlo", () => {
  test("reviewDraft es puro", () => {
    const d = fullDraft();
    const snapshot = JSON.stringify(d);
    reviewDraft(d);
    isReadyToSubmit(d);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});

import { getAsset, setAsset } from "../../lib/studio/upload-draft";

test.describe("huecos de archivo", () => {
  const asset = (name: string): UploadedAsset => ({ name, sizeBytes: 1, url: `https://cdn.test/${name}`, status: "done" });

  test("coloca y recupera un archivo en cada tipo de hueco, sin modificar el borrador original", () => {
    const base = emptyDraft();
    const snapshot = JSON.stringify(base);
    const withSrt = { ...base, srtSubtitles: [{ language: "es", file: null }, { language: "en", file: null }] };
    const withExtras = { ...base, extras: [{ kind: "fotograma" as const, file: null }, { kind: "video" as const, file: null }] };
    const cases: [string, UploadDraft][] = [
      ["video", base], ["trailer", base], ["poster", base], ["banner", base], ["extra:1", withExtras], ["srt:1", withSrt],
    ];
    for (const [slot, draft] of cases) {
      const next = setAsset(draft, slot, asset(`${slot}.x`));
      expect(getAsset(next, slot)?.name, slot).toBe(`${slot}.x`);
      expect(getAsset(draft, slot), `${slot} original`).toBeNull();
    }
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  test("quitar un archivo deja el hueco vacío; el vídeo vuelve a quedar sin archivo", () => {
    const d = setAsset(emptyDraft(), "video", asset("v.mp4"));
    expect(d.video.file?.name).toBe("v.mp4");
    const removed = setAsset(d, "video", null);
    expect(removed.video.file).toBeNull();
    expect(getAsset(removed, "video")).toBeNull();
  });

  test("un hueco desconocido no cambia nada", () => {
    const d = emptyDraft();
    expect(setAsset(d, "nada", asset("x"))).toBe(d);
    expect(getAsset(d, "nada")).toBeNull();
  });

});
