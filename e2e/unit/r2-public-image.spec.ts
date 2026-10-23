import { expect, test } from "@playwright/test";
import { cachedImageUrl } from "../../lib/r2/public-image";

const R2 = "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev";

test.describe("imágenes públicas de R2 por la caché de Vercel", () => {
  test("una portada de r2.dev pasa por /r2/", () => {
    expect(cachedImageUrl(`${R2}/peliculas/the-match/poster.jpg`)).toBe("/r2/peliculas/the-match/poster.jpg");
  });

  test("los vídeos históricos y lo que no es de R2 no cambian", () => {
    expect(cachedImageUrl(`${R2}/peliculas/the-match/video.mp4`)).toBe(`${R2}/peliculas/the-match/video.mp4`);
    expect(cachedImageUrl("/api/media/abc")).toBe("/api/media/abc");
    expect(cachedImageUrl(null)).toBeNull();
    expect(cachedImageUrl(undefined)).toBeUndefined();
  });
});
