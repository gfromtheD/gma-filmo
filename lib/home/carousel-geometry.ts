/**
 * Medidas de las filas de la portada (ver `Carousel`) y escala del Top 10.
 *
 * Desde 768 px cada celda reparte lo que queda tras el margen izquierdo entre N tarjetas y un trozo (0,16) de la
 * siguiente: N = 2 en tableta, 3 desde 1000 px y 4 desde 1500 px (medido en Filmin: 438 px de celda a 1440 px).
 * La portada es la celda menos 16 px. Antes de ser fluidas las portadas medían 316 px de ancho; el Top 10 se
 * dibujó entonces con tarjetas de 200×300 (recogida) y 616×300 (activa), más grandes que las demás. Para que
 * conserve esa diferencia, crece exactamente lo mismo que las portadas: `topTenScale`.
 */

/** Trozo de la siguiente tarjeta que asoma al final de la fila. */
export const CAROUSEL_PEEK = 0.16;
/** Espacio que la celda deja a los lados de la portada (8 px por lado). */
export const CAROUSEL_SLOT_INSET = 16;
/** Ancho de la portada de las filas antes de pasar a tamaño fluido (celda de 320 px menos 4 de margen). */
export const REFERENCE_IMAGE_WIDTH = 316;

const TABLET_MIN = 768;
const THREE_COLUMNS_MIN = 1000;
const FOUR_COLUMNS_MIN = 1500;
/** Desde aquí el Top 10 usa su formato de escritorio (200×300 / 616×300). */
const DESKTOP_MIN = 1024;

/** Tarjetas completas visibles según el ancho de la ventana (`null` en móvil, que usa otro formato). */
export function carouselColumns(viewportWidth: number): 2 | 3 | 4 | null {
  if (viewportWidth < TABLET_MIN) return null;
  if (viewportWidth < THREE_COLUMNS_MIN) return 2;
  if (viewportWidth < FOUR_COLUMNS_MIN) return 3;
  return 4;
}

/** Margen izquierdo de la fila: la primera portada queda alineada con la barra del título. */
export function carouselPadLeft(viewportWidth: number): number {
  return viewportWidth >= DESKTOP_MIN ? 56 : 8;
}

/** Ancho de la celda de una fila de la portada, o `null` en móvil. `clientWidth` = ancho visible de la fila. */
export function carouselSlotWidth(clientWidth: number, viewportWidth: number): number | null {
  const columns = carouselColumns(viewportWidth);
  if (columns === null) return null;
  return (clientWidth - carouselPadLeft(viewportWidth)) / (columns + CAROUSEL_PEEK);
}

/**
 * Cuánto ha crecido la portada de las filas respecto a la de antes (316 px). El Top 10 se multiplica por este
 * número en escritorio, así mantiene su diferencia de tamaño con las demás filas. En formato móvil, o sin
 * medida todavía, vale 1.
 */
export function topTenScale(clientWidth: number, viewportWidth: number): number {
  if (viewportWidth < DESKTOP_MIN || clientWidth <= 0) return 1;
  const slot = carouselSlotWidth(clientWidth, viewportWidth);
  return slot === null ? 1 : (slot - CAROUSEL_SLOT_INSET) / REFERENCE_IMAGE_WIDTH;
}
