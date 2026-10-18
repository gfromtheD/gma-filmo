"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isRevealActive, revealedAmount, snapTarget, type ScrollDirection } from "@/lib/footer-reveal";
import { useFooterHiddenStore } from "@/store/use-footer-hidden-store";

interface RevealFooterProps {
  readonly children: ReactNode;
  /** Clases del bloque que contiene el pie (por ejemplo, el espacio para la barra inferior móvil). */
  readonly innerClassName?: string;
}

/** Tiempo sin hacer scroll antes de completar la fase en la que se haya quedado el pie. */
const SETTLE_MS = 160;

/**
 * Pie «de cortina» en dos fases: el contenido queda fijo al fondo de la ventana y el recorte del contenedor (que sí
 * se desplaza con la página) lo va destapando al llegar al final del scroll. No usa librerías: `position: fixed` +
 * `clip-path`, que recorta también a los descendientes fijos.
 *
 * Como se destapa de abajo arriba, primero asoma la franja inferior del pie (la «primera fase»: lo que marque
 * `data-footer-expanded` queda por encima y es la segunda). Al dejar de hacer scroll se completa la fase en la que se
 * esté, en el sentido del movimiento, para que nunca se vea el pie cortado a medias: se ve la franja entera y, si el
 * usuario sigue bajando, el resto.
 *
 * El efecto solo se activa si el pie cabe en la ventana, el usuario no pidió menos movimiento y el pie no asoma a
 * medias nada más cargar; en cualquier otro caso (también antes de hidratar) es un pie normal, dentro del flujo.
 */
export function RevealFooter({ children, innerClassName = "" }: RevealFooterProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [peek, setPeek] = useState(0);
  const [isReveal, setIsReveal] = useState(false);
  // Última medida, para los manejadores de scroll (que no se vuelven a crear en cada render).
  const metrics = useRef({ full: 0, peek: 0 });
  // Se vuelve a medir cada vez que el pie reaparece: mientras estuvo oculto no existía el elemento.
  const isHidden = useFooterHiddenStore((state) => state.isHidden);

  useEffect(() => {
    const inner = innerRef.current;
    const zone = zoneRef.current;
    if (!inner || !zone) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const full = Math.ceil(inner.getBoundingClientRect().height);
      const expanded = inner.querySelector<HTMLElement>("[data-footer-expanded]");
      const firstPhase = expanded ? Math.max(0, full - Math.ceil(expanded.getBoundingClientRect().height)) : full;
      metrics.current = { full, peek: firstPhase };
      setHeight(full);
      setPeek(firstPhase);
      setIsReveal(isRevealActive({
        viewportHeight: window.innerHeight,
        footerHeight: full,
        zoneDocumentTop: zone.getBoundingClientRect().top + window.scrollY,
        prefersReducedMotion: reducedMotion.matches,
      }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    observer.observe(document.body); // si el contenido de la página crece o se encoge, cambia dónde cae el pie
    window.addEventListener("resize", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, [isHidden]);

  // Completar la fase al dejar de hacer scroll + llevar el foco del teclado a un pie que aún está tapado.
  useEffect(() => {
    const inner = innerRef.current;
    const zone = zoneRef.current;
    if (!isReveal || !inner || !zone) return;
    let lastY = window.scrollY;
    let direction: ScrollDirection = "down";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = () => {
      const { full, peek: firstPhase } = metrics.current;
      const amount = revealedAmount({ viewportHeight: window.innerHeight, zoneTop: zone.getBoundingClientRect().top, footerHeight: full });
      const target = snapTarget({ amount, peek: firstPhase, full, direction });
      if (target !== null) window.scrollTo({ top: window.scrollY + (target - amount), behavior: "smooth" });
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) direction = y > lastY ? "down" : "up";
      lastY = y;
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    // Un enlace del pie al que se llega con el teclado debe verse: si estaba tapado, se baja del todo (el pie es fijo y
    // no arrastra el scroll). Con el ratón no hace falta: solo se puede pulsar lo que ya se ve.
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as HTMLElement).matches(":focus-visible")) window.scrollTo({ top: document.documentElement.scrollHeight });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    inner.addEventListener("focusin", onFocusIn);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      inner.removeEventListener("focusin", onFocusIn);
    };
  }, [isReveal, isHidden]);

  if (isHidden) return null;

  return (
    <div
      ref={zoneRef}
      data-footer-reveal={isReveal ? "on" : "off"}
      data-footer-peek={peek}
      className="relative z-[1] mt-16"
      style={isReveal ? { height, clipPath: "inset(0)" } : undefined}
    >
      <div ref={innerRef} className={`bg-gma-bg/90 ${isReveal ? "fixed inset-x-0 bottom-0" : ""} ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
