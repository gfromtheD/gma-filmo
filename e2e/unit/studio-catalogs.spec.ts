import { expect, test } from "@playwright/test";
import {
  AGE_RATINGS, CATEGORIES, CREW_ROLES, CREW_ROLE_GROUPS, GENRES, IMAGE_SLOTS, LIMITS, THEMES,
} from "../../lib/studio/catalogs";
import { COUNTRY_CODES, LANGUAGE_CODES, countryName, languageName, listCountries, listLanguages } from "../../lib/studio/geo";

const unique = (list: readonly string[]) => new Set(list).size === list.length;

test.describe("catálogos de la subida", () => {
  test("tamaños de las listas y sin repetidos", () => {
    expect(CATEGORIES).toHaveLength(8);
    expect(AGE_RATINGS).toHaveLength(7);
    expect(GENRES).toHaveLength(43);
    expect(THEMES).toHaveLength(126);
    expect(CREW_ROLES.length).toBeGreaterThanOrEqual(10);
    expect(CREW_ROLES.length).toBeLessThanOrEqual(20); // solo los roles principales, no los créditos completos
    for (const [name, list] of Object.entries({ CATEGORIES, AGE_RATINGS, GENRES, THEMES, CREW_ROLES })) {
      expect(unique(list), `${name} tiene repetidos`).toBe(true);
    }
  });

  test("los roles quedan agrupados por departamento y la lista plana los reúne todos", () => {
    expect(CREW_ROLE_GROUPS.length).toBeGreaterThanOrEqual(3);
    expect(CREW_ROLES).toHaveLength(CREW_ROLE_GROUPS.reduce((n, g) => n + g.roles.length, 0));
    expect(CREW_ROLES).toContain("Director de fotografía");
    expect(CREW_ROLES).toContain("Otro");
  });

  test("imágenes: cartel y banner obligatorios, con medidas", () => {
    expect(IMAGE_SLOTS.map((s) => s.id)).toEqual(["poster", "banner"]);
    expect(IMAGE_SLOTS.filter((s) => s.required).map((s) => s.id)).toEqual(["poster", "banner"]);
    const poster = IMAGE_SLOTS.find((s) => s.id === "poster")!;
    expect([poster.width, poster.height]).toEqual([595, 842]);
    const banner = IMAGE_SLOTS.find((s) => s.id === "banner")!;
    expect([banner.width, banner.height]).toEqual([1920, 1080]);
  });

  test("límites", () => {
    expect(LIMITS.imageBytes).toBe(10 * 1024 * 1024);
    expect(LIMITS.shortSynopsisChars).toBe(250);
  });
});

test.describe("países e idiomas", () => {
  test("códigos únicos y en mayúsculas/minúsculas correctas", () => {
    expect(unique(COUNTRY_CODES)).toBe(true);
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(240);
    expect(unique(LANGUAGE_CODES)).toBe(true);
    expect(LANGUAGE_CODES).toContain("es");
    expect(LANGUAGE_CODES).toContain("und");
  });

  test("los nombres salen en español", () => {
    expect(countryName("ES")).toBe("España");
    expect(countryName("DE")).toBe("Alemania");
    expect(languageName("es")).toMatch(/espa/i);
    expect(languageName("und")).toBe("Otro");
  });

  test("las listas van ordenadas por nombre y «Otro» cierra la de idiomas", () => {
    const countries = listCountries();
    const names = countries.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("es").compare));
    expect(countries.find((c) => c.code === "ES")?.name).toBe("España");
    const languages = listLanguages();
    expect(languages.at(-1)).toEqual({ code: "und", name: "Otro" });
    expect(languages.length).toBeGreaterThan(100);
  });
});
