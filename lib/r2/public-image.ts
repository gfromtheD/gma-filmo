/**
 * Portadas y fotos públicas de R2 servidas a través de `/r2/…` (reescritura de `next.config.mjs`), que la red de Vercel guarda
 * en caché: R2 recibe una petición por imagen al día en vez de una por espectador. El acceso directo `pub-….r2.dev` no es
 * para producción: Cloudflare le aplica un límite variable y con mucho público devuelve 429 (pruebas de carga del 23-10-2026).
 * Solo imágenes: los MP4 históricos siguen yendo directos (por Vercel gastarían su cupo de tráfico).
 * Cuando haya dominio propio con R2 en él, esto se sustituye por ese dominio.
 */
const R2_PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev").replace(/\/+$/, "");
const IMAGE_PATH = /\.(?:jpe?g|png|webp|avif|gif)$/i;

export function cachedImageUrl<T extends string | null | undefined>(url: T): T {
  if (!url || !url.startsWith(`${R2_PUBLIC_ORIGIN}/`)) return url;
  const path = url.slice(R2_PUBLIC_ORIGIN.length + 1);
  return (IMAGE_PATH.test(path.split("?")[0]!) ? `/r2/${path}` : url) as T;
}
