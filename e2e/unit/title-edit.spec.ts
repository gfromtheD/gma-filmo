import { expect, test } from "@playwright/test";
import { editLanguageOptions, editMetadata, editProblem, editYearOptions } from "../../lib/studio/title-edit";

const form = (over: Partial<Parameters<typeof editMetadata>[0]> = {}) => ({ title: "Yasha", description: "Una historia", language: "español", year: "1990", ...over });

test.describe("editar metadatos de un título publicado", () => {
  test("el año propio del título siempre se puede elegir, aunque sea antiguo", () => {
    const years = editYearOptions("1990");
    expect(years[0]).toBe(String(new Date().getFullYear()));
    expect(years).toContain("1990");
    expect(editYearOptions("1850")).toContain("1850");
  });

  test("el idioma actual se conserva aunque no esté en la lista", () => {
    expect(editLanguageOptions("español")).toContain("español");
    expect(editLanguageOptions("Sin diálogo")[0]).toBe("Sin diálogo");
    expect(editLanguageOptions("").includes("")).toBe(false);
  });

  test("se envía lo que acepta el servidor: título y sinopsis recortados, año de 4 cifras, idioma si hay", () => {
    expect(editMetadata(form({ title: "  Yasha  ", description: "  " }))).toEqual({ title: "Yasha", synopsis: null, year: "1990", language: "español" });
    expect(editMetadata(form({ year: "", language: "" }))).toEqual({ title: "Yasha", synopsis: "Una historia" });
  });

  test("un título vacío o demasiado largo no se envía", () => {
    expect(editProblem(form({ title: "   " }))).toContain("título");
    expect(editProblem(form({ title: "x".repeat(161) }))).toContain("160");
    expect(editProblem(form())).toBeNull();
  });
});
