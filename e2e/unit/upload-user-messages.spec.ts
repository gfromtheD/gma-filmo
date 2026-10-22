import { test, expect } from "@playwright/test";
import { uploadUserMessage } from "../../lib/uploads/user-messages";

test.describe("uploadUserMessage", () => {
  test("traduce los códigos del servidor a español", () => {
    expect(uploadUserMessage("UPLOAD_REVISION_CONFLICT")).toMatch(/otro cambio a la vez/);
    expect(uploadUserMessage("UPLOAD_QUOTA_EXCEEDED")).toMatch(/espacio/);
    expect(uploadUserMessage("MEDIA_PROCESSING_FAILED")).toMatch(/procesar/);
  });

  test("encuentra el código aunque venga dentro de una frase", () => {
    expect(uploadUserMessage("Error: UPLOAD_SLOT_OCCUPIED (409)")).toMatch(/hueco/);
  });

  test("un código desconocido no se enseña en crudo", () => {
    const text = uploadUserMessage("UPLOAD_ALGO_NUEVO");
    expect(text).not.toMatch(/UPLOAD_/);
    expect(text).toMatch(/Inténtalo de nuevo/);
  });

  test("un mensaje ya escrito en español se respeta", () => {
    expect(uploadUserMessage("Algún archivo todavía se está procesando.")).toBe("Algún archivo todavía se está procesando.");
  });

  test("un valor vacío da el mensaje genérico", () => {
    expect(uploadUserMessage("")).toMatch(/Inténtalo de nuevo/);
    expect(uploadUserMessage(undefined)).toMatch(/Inténtalo de nuevo/);
  });
});

test.describe("uploadUserMessage con campos rechazados", () => {
  test("dice qué campos corregir en vez de un aviso genérico", () => {
    const text = uploadUserMessage("UPLOAD_INVALID_INPUT", ["originalTitle", "ficha.team"]);
    expect(text).toContain("Título original");
    expect(text).not.toMatch(/UPLOAD_/);
  });

  test("sin campos conocidos vuelve al mensaje general", () => {
    expect(uploadUserMessage("UPLOAD_INVALID_INPUT", ["algoDesconocido"])).toMatch(/Falta algún dato/);
    expect(uploadUserMessage("UPLOAD_INVALID_INPUT")).toMatch(/Falta algún dato/);
  });
});
