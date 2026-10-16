"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFooterHiddenStore } from "@/store/use-footer-hidden-store";

interface RevealFooterProps {
  readonly children: ReactNode;
  /** Clases del bloque que contiene el pie (por ejemplo, el espacio para la barra inferior móvil). */
  readonly innerClassName?: string;
}

/**
 * Pie «de cortina»: el contenido queda fijo al fondo de la ventana y el recorte del contenedor (que sí se desplaza
 * con la página) lo va destapando al llegar al final del scroll. No usa ninguna librería: solo `position: fixed` +
 * `clip-path`, que recorta también a los descendientes fijos.
 *
 * El efecto solo se activa cuando cabe entero en la ventana y el usuario no pidió menos movimiento; en cualquier
 * otro caso (también antes de hidratar) es un pie normal, dentro del flujo de la página.
 */
export function RevealFooter({ children, innerClassName = "" }: RevealFooterProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [isReveal, setIsReveal] = useState(false);
  // Se vuelve a medir cada vez que el pie reaparece: mientras estuvo oculto no existía el elemento.
  const isHidden = useFooterHiddenStore((state) => state.isHidden);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const measured = Math.ceil(inner.getBoundingClientRect().height);
      setHeight(measured);
      setIsReveal(!reducedMotion.matches && measured <= window.innerHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    window.addEventListener("resize", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, [isHidden]);

  if (isHidden) return null;

  return (
    <div
      data-footer-reveal={isReveal ? "on" : "off"}
      className="relative z-[1] mt-16"
      style={isReveal ? { height, clipPath: "inset(0)" } : undefined}
    >
      <div ref={innerRef} className={`bg-gma-bg/90 ${isReveal ? "fixed inset-x-0 bottom-0" : ""} ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
