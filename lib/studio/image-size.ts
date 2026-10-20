import type { PixelSize } from "@/lib/studio/file-rules";

/** Mide una imagen en el navegador; `null` si no se puede leer (archivo dañado o formato que el navegador no abre). */
export async function readImageSize(file: Blob): Promise<PixelSize | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
