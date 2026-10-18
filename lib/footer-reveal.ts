/**
 * Lógica del pie «de cortina» en dos fases (ver `RevealFooter`). Funciones puras: el componente solo mide y las usa.
 *
 * El pie queda fijo al fondo de la ventana y la página lo va destapando de abajo arriba al llegar al final del
 * scroll. Primero asoma la franja inferior (año, legal y redes: la «primera fase») y, si se sigue bajando, el resto.
 * Para que nunca se quede a medias, al dejar de hacer scroll se completa la fase en la que se esté.
 */

export type ScrollDirection = "down" | "up";

/** Margen en píxeles para dar una fase por alcanzada. */
const EPSILON = 2;

/** Cuántos píxeles del pie se ven ahora: 0 = nada, `footerHeight` = entero. `zoneTop`: arriba de su hueco, en la ventana. */
export function revealedAmount({ viewportHeight, zoneTop, footerHeight }: {
  viewportHeight: number; zoneTop: number; footerHeight: number;
}): number {
  return Math.min(footerHeight, Math.max(0, viewportHeight - zoneTop));
}

/**
 * ¿Se usa el efecto de cortina? Solo si el pie cabe en la ventana, el usuario no pidió menos movimiento y el pie no
 * asoma a medias nada más cargar (página justo más larga que la ventana): en esos casos es un pie normal.
 * `zoneDocumentTop`: dónde empieza el hueco del pie, contado desde arriba de la página.
 */
export function isRevealActive({ viewportHeight, footerHeight, zoneDocumentTop, prefersReducedMotion }: {
  viewportHeight: number; footerHeight: number; zoneDocumentTop: number; prefersReducedMotion: boolean;
}): boolean {
  if (prefersReducedMotion || footerHeight > viewportHeight) return false;
  const visibleAtTop = viewportHeight - zoneDocumentTop;
  const isPartlyVisibleAtTop = visibleAtTop > EPSILON && visibleAtTop < footerHeight - EPSILON;
  return !isPartlyVisibleAtTop;
}

/**
 * A qué cantidad visible hay que ajustar el pie cuando se deja de hacer scroll, o `null` si ya está en una fase
 * (nada, la franja o entero). Se avanza en el sentido del scroll: bajando se completa la fase siguiente; subiendo,
 * se vuelve a la anterior. `peek`: lo que mide la primera fase; si es igual a `full` no hay fase extra.
 */
export function snapTarget({ amount, peek, full, direction }: {
  amount: number; peek: number; full: number; direction: ScrollDirection;
}): number | null {
  const stages = peek >= full - EPSILON ? [0, full] : [0, peek, full];
  if (stages.some((stage) => Math.abs(stage - amount) <= EPSILON)) return null;
  if (direction === "down") return stages.find((stage) => stage > amount) ?? null;
  return [...stages].reverse().find((stage) => stage < amount) ?? null;
}
