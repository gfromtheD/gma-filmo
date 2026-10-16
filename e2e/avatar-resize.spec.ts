import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import ts from "typescript";

/**
 * Reducción de las fotos que sube el usuario como avatar. Se ejecuta el código REAL de
 * `lib/profiles/image-resize.ts` dentro del navegador (canvas incluido), sin pasar por la interfaz.
 */
const SOURCE = fs.readFileSync(path.join(process.cwd(), "lib/profiles/image-resize.ts"), "utf8");
const MODULE_CODE = ts
  .transpileModule(SOURCE, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } })
  .outputText.replace(/^export /gm, "");

const MAX_BYTES = 262_144;

test.beforeEach(async ({ page }) => {
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.evaluate((code) => {
    (window as unknown as { resize: (source: Blob | string) => Promise<string> }).resize = new Function(`${code}; return resizeToAvatarDataUrl;`)();
  }, MODULE_CODE);
});

async function makeBigImage(page: import("@playwright/test").Page, width: number, height: number): Promise<void> {
  await page.evaluate(async ({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    // Ruido aleatorio en cada píxel: la imagen de entrada pesa de verdad (varios MB) y no se comprime.
    const pixels = ctx.createImageData(width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = Math.random() * 256;
      pixels.data[i + 1] = Math.random() * 256;
      pixels.data[i + 2] = Math.random() * 256;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    (window as unknown as { big: Blob }).big = blob;
  }, { width, height });
}

test("reduce una foto grande a un avatar cuadrado de 256 px y de poco peso", async ({ page }) => {
  await makeBigImage(page, 1600, 1200);
  const result = await page.evaluate(async () => {
    const w = window as unknown as { resize: (b: Blob) => Promise<string>; big: Blob };
    const output = await w.resize(w.big);
    const image = new Image();
    image.src = output;
    await image.decode();
    return { prefix: output.slice(0, 23), bytes: Math.round((output.length - output.indexOf(",") - 1) * 0.75), width: image.naturalWidth, height: image.naturalHeight, inputBytes: w.big.size };
  });
  expect(result.inputBytes).toBeGreaterThan(MAX_BYTES * 4); // la entrada es pesada
  expect(result.prefix).toMatch(/^data:image\/(webp|jpeg);base64,/);
  expect(result.bytes).toBeLessThanOrEqual(MAX_BYTES);
  expect(result.width).toBe(256);
  expect(result.height).toBe(256);
});

test("recorta al centro: una foto apaisada sale cuadrada sin deformarse", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ff0000"; // laterales rojos
    ctx.fillRect(0, 0, 600, 300);
    ctx.fillStyle = "#0000ff"; // cuadrado central azul de 300×300
    ctx.fillRect(150, 0, 300, 300);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    const output = await (window as unknown as { resize: (b: Blob) => Promise<string> }).resize(blob);
    const image = new Image();
    image.src = output;
    await image.decode();
    const out = document.createElement("canvas");
    out.width = 256;
    out.height = 256;
    const octx = out.getContext("2d")!;
    octx.drawImage(image, 0, 0);
    const corner = octx.getImageData(4, 4, 1, 1).data;
    return { r: corner[0]!, b: corner[2]! };
  });
  expect(result.b).toBeGreaterThan(200); // la esquina es del cuadrado central (azul), no de los laterales rojos
  expect(result.r).toBeLessThan(60);
});

test("también reduce una imagen incrustada (data:) sin usar la red", async ({ page }) => {
  await makeBigImage(page, 1200, 1200);
  const result = await page.evaluate(async () => {
    const w = window as unknown as { resize: (s: string) => Promise<string>; big: Blob };
    const dataUrl: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(w.big);
    });
    const output = await w.resize(dataUrl);
    return { input: dataUrl.length, output: output.length };
  });
  expect(result.output).toBeLessThan(result.input / 3);
});

test("rechaza un archivo que no es una imagen legible", async ({ page }) => {
  const error = await page.evaluate(async () => {
    const w = window as unknown as { resize: (b: Blob) => Promise<string> };
    try {
      await w.resize(new Blob(["esto no es una imagen"], { type: "image/png" }));
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(error).toBe("avatar_unreadable");
});
