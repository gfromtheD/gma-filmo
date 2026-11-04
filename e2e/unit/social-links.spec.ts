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

test.describe("formatos admitidos por red", () => {
  test("usuario o @usuario se convierte en el enlace de cada red", () => {
    expect(socialUrl("youtube", "@gma")).toBe("https://youtube.com/@gma");
    expect(socialUrl("tiktok", "gma")).toBe("https://tiktok.com/@gma");
    expect(socialUrl("threads", "@gma")).toBe("https://threads.net/@gma");
    expect(socialUrl("x", "@gma")).toBe("https://x.com/gma");
    expect(socialUrl("facebook", "gma.filmo")).toBe("https://facebook.com/gma.filmo");
    expect(socialUrl("vimeo", "gma")).toBe("https://vimeo.com/gma");
    expect(socialUrl("instagram", "gma.filmo")).toBe("https://instagram.com/gma.filmo");
  });

  test("YouTube admite todas las rutas de canal", () => {
    for (const url of ["https://www.youtube.com/@gma", "https://www.youtube.com/channel/UC123", "https://www.youtube.com/c/gma", "https://youtu.be/abc", "youtube.com/@gma/videos"]) {
      expect(socialUrl("youtube", url), url).not.toBeNull();
    }
  });

  test("los enlaces copiados del móvil valen", () => {
    for (const [platform, url] of [["facebook", "https://m.facebook.com/gma"], ["facebook", "https://www.facebook.com/profile.php?id=123"], ["tiktok", "https://vm.tiktok.com/abc/"],
      ["x", "https://mobile.twitter.com/gma"], ["youtube", "https://m.youtube.com/@gma"], ["threads", "https://www.threads.com/@gma"]] as const) {
      expect(socialUrl(platform, url), url).toBe(url);
    }
  });

  test("un dominio que solo se parece a la red no pasa", () => {
    for (const [platform, url] of [["facebook", "https://facebook.com.evil.com/gma"], ["facebook", "https://evilfacebook.com/gma"], ["youtube", "https://youtube.com@evil.com/x"], ["x", "javascript:alert(1)"], ["instagram", "juan perez"]] as const) {
      expect(socialUrl(platform, url), url).toBeNull();
    }
  });

  test("la web propia admite dominio solo o URL, y vacío no genera enlace", () => {
    expect(socialUrl("website", "gmafilmo.com")).toBe("https://gmafilmo.com/");
    expect(socialUrl("website", "ftp://x.com")).toBeNull();
    expect(socialUrl("instagram", "   ")).toBeNull();
  });
});
