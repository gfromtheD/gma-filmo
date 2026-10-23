/**
 * Token de la pasarela (`?cap=…`) de una dirección de entrega, o `null` si no lleva.
 * Las imágenes y subtítulos del motor se sirven por una ruta propia relativa (`/api/media/<id>`): no pasan por la pasarela
 * ni llevan token, así que no hay nada que registrar. Sin esta distinción, `new URL('/api/media/…')` lanzaba «Invalid URL»
 * y tumbaba la reproducción de cualquier título con póster o banner del motor.
 */
export function gatewayCapToken(url: string): string | null {
  if (url.startsWith('/')) return null;
  return new URL(url).searchParams.get('cap');
}
