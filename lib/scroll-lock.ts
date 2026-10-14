/**
 * Bloqueo del scroll de la página mientras hay un modal abierto.
 *
 * Se aplica sobre <html> y NO sobre <body>: con `overflow: hidden` en <body> este pasa a ser un contenedor
 * de scroll y la cabecera pegajosa (position: sticky) salta al principio del documento y desaparece,
 * dejando la pantalla bloqueada a media altura. Con <html> el scroll se detiene y la cabecera no se mueve.
 * Admite varios modales a la vez (solo se desbloquea al cerrar el último).
 */
let activeLocks = 0;
let previousOverflow = "";

/** Bloquea el scroll y devuelve la función que lo libera (se puede llamar más de una vez sin efecto). */
export function lockPageScroll(): () => void {
  const root = document.documentElement;
  if (activeLocks === 0) {
    previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
  }
  activeLocks += 1;

  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    activeLocks -= 1;
    if (activeLocks === 0) root.style.overflow = previousOverflow;
  };
}
