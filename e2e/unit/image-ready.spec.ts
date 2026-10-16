import { expect, test } from "@playwright/test";
import { preloadImage, whenImageReady } from "../../lib/home/image-ready";

/** Espera a que una imagen esté cargada antes de fundir hacia ella (sin quedarse colgado si tarda o falla). */
function controllableLoader() {
  const calls: string[] = [];
  let release: () => void = () => undefined;
  const load = (url: string) => {
    calls.push(url);
    return new Promise<void>((resolve) => { release = resolve; });
  };
  return { load, calls, release: () => release() };
}

test.describe("whenImageReady", () => {
  test("sin dirección (portada hecha con degradado) no espera nada", async () => {
    await expect(whenImageReady(undefined)).resolves.toBeUndefined();
  });

  test("espera a que la imagen cargue", async () => {
    const { load, release } = controllableLoader();
    let done = false;
    const pending = whenImageReady("/img/a.jpg", 1000, load).then(() => { done = true; });
    await new Promise((r) => setTimeout(r, 30));
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });

  test("si tarda demasiado, sigue igualmente (no se queda colgado)", async () => {
    const { load } = controllableLoader();
    const started = Date.now();
    await whenImageReady("/img/slow.jpg", 80, load);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(70);
    expect(elapsed).toBeLessThan(500);
  });

  test("la misma imagen solo se pide una vez (la precarga se aprovecha)", async () => {
    const { load, calls, release } = controllableLoader();
    const first = preloadImage("/img/b.jpg", load);
    const second = whenImageReady("/img/b.jpg", 1000, load);
    release();
    await Promise.all([first, second]);
    expect(calls).toEqual(["/img/b.jpg"]);
  });

  test("una imagen ya cargada responde al instante", async () => {
    const { load, release } = controllableLoader();
    const first = preloadImage("/img/c.jpg", load);
    release();
    await first;
    const started = Date.now();
    await whenImageReady("/img/c.jpg", 1000, load);
    expect(Date.now() - started).toBeLessThan(50);
  });
});
