import { expect, test } from "@playwright/test";
import { CHUNK_RECOVERY_SCRIPT, installChunkRecovery } from "../../lib/chunk-recovery";

type Listener = (event: unknown) => void;

/** Una ventana mínima: lo que el guardián usa (dirección, historial, sessionStorage y eventos). */
function fakeWindow(href: string, storage: Record<string, string> = {}) {
  const listeners: Record<string, Listener[]> = {};
  const replaced: string[] = [];
  const win = {
    location: { href, replace: (url: string) => { replaced.push(url); } },
    history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => { win.location.href = new URL(url, href).toString(); } },
    sessionStorage: { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v; } },
    addEventListener: (type: string, fn: Listener) => { (listeners[type] ??= []).push(fn); },
  };
  const fire = (type: string, event: unknown) => (listeners[type] ?? []).forEach((fn) => fn(event));
  return { win, replaced, fire, storage };
}

const chunkError = (src: string) => ({ target: { tagName: "SCRIPT", src } });

test.describe("pestaña abierta durante un despliegue", () => {
  test("si no carga un archivo propio de la web, recarga una vez con una dirección nueva", () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/mi-estudio");
    installChunkRecovery(w.win as never);
    w.fire("error", chunkError("https://gma-filmo.vercel.app/_next/static/chunks/app/page-viejo.js"));
    w.fire("error", chunkError("https://gma-filmo.vercel.app/_next/static/chunks/7530-viejo.js"));
    expect(w.replaced).toHaveLength(1);
    expect(w.replaced[0]).toMatch(/^https:\/\/gma-filmo\.vercel\.app\/mi-estudio\?__v=\d+$/);
  });

  test("un fallo de un script ajeno (YouTube) no recarga nada", () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/inicio");
    installChunkRecovery(w.win as never);
    w.fire("error", chunkError("https://www.youtube.com/iframe_api"));
    w.fire("error", { target: { tagName: "IMG", src: "https://gma-filmo.vercel.app/_next/static/media/x.png" } });
    expect(w.replaced).toHaveLength(0);
  });

  test("un trozo de código que no llega (ChunkLoadError) también recarga", () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/ver/x");
    installChunkRecovery(w.win as never);
    w.fire("unhandledrejection", { reason: Object.assign(new Error("Loading chunk 123 failed."), { name: "ChunkLoadError" }) });
    expect(w.replaced).toHaveLength(1);
  });

  test("tras la recarga se limpia la dirección y, si vuelve a fallar, no entra en bucle", () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/mi-estudio?tab=1&__v=123#arriba");
    installChunkRecovery(w.win as never);
    expect(w.win.location.href).toBe("https://gma-filmo.vercel.app/mi-estudio?tab=1#arriba");
    w.fire("error", chunkError("https://gma-filmo.vercel.app/_next/static/chunks/main.js"));
    expect(w.replaced).toHaveLength(0);
  });

  test("si ya se recargó hace menos de un minuto, no lo intenta otra vez", () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/mi-estudio", { "gma-recarga-version": String(Date.now() - 5_000) });
    installChunkRecovery(w.win as never);
    w.fire("error", chunkError("https://gma-filmo.vercel.app/_next/static/chunks/main.js"));
    expect(w.replaced).toHaveLength(0);
  });

  test("si el fallo llegó antes que el guardián, al terminar de cargar sin que la app arranque también recarga", async () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/mi-estudio");
    installChunkRecovery(w.win as never);
    w.fire("load", {});
    await new Promise((r) => setTimeout(r, 10));
    expect(w.replaced).toHaveLength(1);
  });

  test("con la app arrancada, terminar de cargar no recarga nada", async () => {
    const w = fakeWindow("https://gma-filmo.vercel.app/mi-estudio");
    installChunkRecovery(w.win as never);
    Object.assign(w.win, { next: { version: "14.2.35" } });
    w.fire("load", {});
    await new Promise((r) => setTimeout(r, 10));
    expect(w.replaced).toHaveLength(0);
  });

  test("el guardián del HTML es la misma función, lista para ejecutarse", () => {
    expect(CHUNK_RECOVERY_SCRIPT).toContain("_next");
    expect(CHUNK_RECOVERY_SCRIPT.trim().endsWith("(window);")).toBe(true);
  });
});
