import { expect, test } from "@playwright/test";
import { LIST_NAME_MAX, MAX_LISTS_PER_PROFILE, listNameError, normalizeListName } from "../../lib/lists/rules";

test.describe("listas de Mi lista", () => {
  test("limpia espacios sobrantes del nombre", () => {
    expect(normalizeListName("  Para   ver  con amigos ")).toBe("Para ver con amigos");
  });

  test("no deja nombres vacíos ni demasiado largos", () => {
    expect(listNameError("   ")).toBe("Ponle un nombre a la lista.");
    expect(listNameError("a".repeat(LIST_NAME_MAX + 1))).toMatch(String(LIST_NAME_MAX));
    expect(listNameError("Animación")).toBeNull();
  });

  test("no deja repetir el nombre de otra lista (sin distinguir mayúsculas ni tildes)", () => {
    expect(listNameError("animacion", ["Animación"])).toBe("Ya tienes una lista con ese nombre.");
  });

  test("hay un tope de listas por perfil", () => {
    expect(MAX_LISTS_PER_PROFILE).toBeGreaterThan(0);
  });
});
