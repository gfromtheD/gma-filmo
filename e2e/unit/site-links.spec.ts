import { expect, test } from "@playwright/test";
import { getSiteSocials } from "../../lib/site-links";

const BASE = {
  x: "https://x.com/GenArtMal",
  instagram: "https://www.instagram.com/genartmal/",
  tiktok: undefined,
  youtube: undefined,
};

test.describe("getSiteSocials", () => {
  test("salen siempre las cuatro redes, en el mismo orden", () => {
    expect(getSiteSocials(BASE).map((s) => s.key)).toEqual(["x", "instagram", "tiktok", "youtube"]);
  });

  test("sin dirección configurada, TikTok y YouTube salen sin enlace (próximamente)", () => {
    const [x, instagram, tiktok, youtube] = getSiteSocials(BASE);
    expect(x!.href).toBe("https://x.com/GenArtMal");
    expect(instagram!.href).toBe("https://www.instagram.com/genartmal/");
    expect(tiktok!.href).toBeNull();
    expect(youtube!.href).toBeNull();
  });

  test("al configurarlas (usuario o dirección) TikTok y YouTube pasan a ser enlaces", () => {
    const socials = getSiteSocials({ ...BASE, tiktok: "@gmafilmo", youtube: "https://www.youtube.com/@gmafilmo" });
    expect(socials[2]!.href).toBe("https://tiktok.com/@gmafilmo");
    expect(socials[3]!.href).toBe("https://www.youtube.com/@gmafilmo");
  });

  test("un valor de otra web o con esquema peligroso no se enlaza", () => {
    const socials = getSiteSocials({ ...BASE, tiktok: "https://evil.example/@gma", youtube: "javascript:alert(1)" });
    expect(socials[2]!.href).toBeNull();
    expect(socials[3]!.href).toBeNull();
  });

  test("todo enlace es https", () => {
    for (const s of getSiteSocials({ ...BASE, tiktok: "gmafilmo", youtube: "gmafilmo" })) {
      expect(s.href === null || s.href.startsWith("https://")).toBe(true);
    }
  });
});
