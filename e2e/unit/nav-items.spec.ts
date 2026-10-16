import { expect, test } from "@playwright/test";
import { getNavItems } from "../../lib/layout/nav-items";

/** Menú de secciones de la cabecera: Mi Espacio ya no está (se abre desde el icono de guardados). */
test.describe("getNavItems", () => {
  test("para cualquier visitante o usuario: Home, Películas y Cortos", () => {
    expect(getNavItems(false).map((i) => i.id)).toEqual(["home", "movies", "cortos"]);
  });

  test("solo los creadores ven además «Mi Estudio», al final y como enlace normal", () => {
    const items = getNavItems(true);
    expect(items.map((i) => i.id)).toEqual(["home", "movies", "cortos", "studio"]);
    const studio = items.at(-1)!;
    expect(studio.label).toBe("Mi Estudio");
    expect(studio.href).toBe("/mi-estudio");
    expect(studio.match).toBe("/mi-estudio");
  });

  test("ninguna entrada del menú lleva a Mi Espacio", () => {
    for (const isCreator of [false, true]) {
      for (const item of getNavItems(isCreator)) {
        expect(item.href).not.toBe("/mi-espacio");
        expect(item.label).not.toBe("Mi Espacio");
      }
    }
  });
});
