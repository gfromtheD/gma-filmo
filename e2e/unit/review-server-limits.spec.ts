import { test, expect } from "@playwright/test";
import { emptyDraft, reviewDraft, type UploadDraft } from "../../lib/studio/upload-draft";

const flat = (draft: UploadDraft) => reviewDraft(draft).flatMap((step) => step.missing);

test.describe("la revisión avisa de lo que el servidor rechazaría", () => {
  test("un título original de más de 160 caracteres se señala con su número", () => {
    const draft = { ...emptyDraft(), originalTitle: "x".repeat(228) };
    expect(flat(draft).some((m) => m.includes("Título original") && m.includes("228"))).toBe(true);
  });

  test("un título original de 160 caracteres es válido", () => {
    const draft = { ...emptyDraft(), originalTitle: "x".repeat(160) };
    expect(flat(draft).some((m) => m.includes("Título original"))).toBe(false);
  });

  test("una sinopsis larga por encima del límite se señala", () => {
    const draft = { ...emptyDraft(), synopsisLong: "x".repeat(10_001) };
    expect(flat(draft).some((m) => m.startsWith("Sinopsis larga de"))).toBe(true);
  });

  test("un nombre del equipo demasiado largo se señala", () => {
    const draft = { ...emptyDraft(), team: [{ name: "n".repeat(121), role: "Director/a" }] };
    expect(flat(draft).some((m) => m.includes("demasiado largo"))).toBe(true);
  });
});
