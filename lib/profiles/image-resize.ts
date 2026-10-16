/**
 * Reduce una imagen subida por el usuario al tamaño de un avatar (recorte cuadrado centrado, 256 px,
 * WebP o JPEG) y la devuelve como «data:image/…». Así lo que se guarda en la base de datos pesa decenas
 * de KB y no megas. Solo navegador (usa canvas). No usa `fetch`: la política de seguridad no permite
 * pedir `data:` URLs; se decodifica con un elemento de imagen (permitido por `img-src`).
 */

const AVATAR_SIZE = 256;
/** ≈ 250 KB una vez decodificado (la base64 ocupa ~4/3). Coincide con `MAX_AVATAR_BYTES`. */
const MAX_DATA_URL_CHARS = 340_000;
const QUALITIES = [0.85, 0.7, 0.55] as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("avatar_unreadable"));
    image.src = src;
  });
}

/** `Blob` (archivo elegido) o «data:image/…» → imagen reducida. Lanza `avatar_unreadable` o `avatar_too_large`. */
export async function resizeToAvatarDataUrl(source: Blob | string): Promise<string> {
  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  try {
    const image = await loadImage(objectUrl ?? (source as string));
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (side === 0) throw new Error("avatar_unreadable");

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("avatar_unreadable");
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    context.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    for (const quality of QUALITIES) {
      const webp = canvas.toDataURL("image/webp", quality);
      const output = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
      if (output.length <= MAX_DATA_URL_CHARS) return output;
    }
    throw new Error("avatar_too_large");
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
