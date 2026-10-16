/**
 * Precarga de imágenes para el hero: antes de fundir hacia una portada nueva se espera a que esté cargada, para que no
 * aparezca de golpe cuando termina de descargarse a mitad (o después) del fundido. Una misma imagen se pide una sola
 * vez; si tarda demasiado o falla, se sigue igualmente para no dejar el hero colgado.
 */
export type ImageLoader = (url: string) => Promise<void>;

/** Cuánto se espera como máximo a una imagen antes de cambiar de portada de todos modos. */
export const IMAGE_READY_TIMEOUT_MS = 1500;

const requests = new Map<string, Promise<void>>();

/** Carga en el navegador y espera a que la imagen esté lista (también si falla: no bloquea). */
function browserLoader(url: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      // `decode()` evita el parpadeo del primer pintado; si no está disponible o falla, ya está cargada.
      (typeof image.decode === "function" ? image.decode() : Promise.resolve()).then(() => resolve(), () => resolve());
    };
    image.onerror = () => resolve();
    image.src = url;
  });
}

/** Empieza a cargar la imagen (si no estaba pedida ya) y devuelve la promesa compartida. */
export function preloadImage(url: string | undefined, load: ImageLoader = browserLoader): Promise<void> {
  if (!url) return Promise.resolve();
  const existing = requests.get(url);
  if (existing) return existing;
  const request = load(url);
  requests.set(url, request);
  return request;
}

/** Se cumple cuando la imagen está lista, o pasado `timeoutMs`, lo que ocurra antes. */
export function whenImageReady(
  url: string | undefined,
  timeoutMs: number = IMAGE_READY_TIMEOUT_MS,
  load: ImageLoader = browserLoader,
): Promise<void> {
  if (!url) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    preloadImage(url, load).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
