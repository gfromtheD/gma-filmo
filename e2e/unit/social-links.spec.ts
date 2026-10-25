import { expect, test } from "@playwright/test";
import { socialUrl } from "../../lib/social-links";

test.describe("enlaces de Letterboxd", () => {
  test("Letterboxd acepta el usuario o su URL", () => {
    expect(socialUrl("letterboxd", "marta")).toBe("https://letterboxd.com/marta");
    expect(socialUrl("letterboxd", "https://letterboxd.com/marta/")).toBe("https://letterboxd.com/marta/");
  });

  test("rechaza enlaces de otra web", () => {
    expect(socialUrl("letterboxd", "https://evil.com/marta")).toBeNull();
  });
});

test.describe("enlaces de IMDb", () => {
  test("acepta el código de la persona (nm…) o la URL de su ficha", () => {
    expect(socialUrl("imdb", "nm0655043")).toBe("https://www.imdb.com/name/nm0655043/");
    expect(socialUrl("imdb", "https://www.imdb.com/es-es/name/nm0655043/?ref_=nv_sr")).toBe("https://www.imdb.com/es-es/name/nm0655043/?ref_=nv_sr");
    expect(socialUrl("imdb", "https://m.imdb.com/name/nm0655043")).toBe("https://m.imdb.com/name/nm0655043");
  });

  test("rechaza otra web o algo que no es un código de IMDb", () => {
    expect(socialUrl("imdb", "https://evil.com/name/nm0655043")).toBeNull();
    expect(socialUrl("imdb", "pablo pares")).toBeNull();
    expect(socialUrl("imdb", "tt0123456")).toBeNull();
  });
});
