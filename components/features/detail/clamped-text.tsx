"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Alto reservado para la fila del botón «Más / Menos» (el botón mide 24 px más 8 px de margen superior). */
const TOGGLE_SPACE = 32;
const MIN_LINES = 3;

interface ClampedTextProps {
  readonly text: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /**
   * Alto máximo que debe tener la tarjeta que contiene el texto mientras está plegada.
   * `null` = sin límite (pantallas estrechas, donde las tarjetas van apiladas).
   */
  readonly targetHeight: number | null;
  readonly className?: string;
}

/** Altura que ocupa todo lo de la tarjeta que no es el texto (título, aviso, formulario y márgenes). */
function cardChrome(text: HTMLElement, card: HTMLElement, toggle: HTMLElement | null): number {
  const cardBox = card.getBoundingClientRect();
  const above = text.getBoundingClientRect().top - cardBox.top;
  let below = parseFloat(getComputedStyle(card).paddingBottom) || 0;
  for (let node = text.nextElementSibling; node; node = node.nextElementSibling) {
    if (node === toggle) continue;
    const style = getComputedStyle(node);
    below += node.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
  }
  return above + below;
}

/**
 * Texto que, si no cabe en la altura objetivo de su tarjeta, se corta con «…» y ofrece «Más»
 * para desplegarlo (y «Menos» para volver a plegarlo).
 */
export function ClampedText({ text, expanded, onToggle, targetHeight, className = "" }: ClampedTextProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<number | null>(null);

  useLayoutEffect(() => {
    function measure() {
      const el = textRef.current;
      const card = el?.closest<HTMLElement>("[data-detail-card]");
      if (!el || !card) return;

      if (targetHeight === null) {
        setLines(null);
        return;
      }
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 25;
      const chrome = cardChrome(el, card, toggleRef.current);
      const fits = chrome + el.scrollHeight <= targetHeight + 1;
      setLines(fits ? null : Math.max(MIN_LINES, Math.floor((targetHeight - chrome - TOGGLE_SPACE) / lineHeight)));
    }

    if (expanded) {
      setLines(null);
      return;
    }
    measure();
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
    // `lines` no entra en las dependencias: se recalcula solo cuando cambia el entorno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, expanded, targetHeight]);

  const isClamped = lines !== null && !expanded;
  const clampStyle = isClamped
    ? { display: "-webkit-box", WebkitBoxOrient: "vertical" as const, WebkitLineClamp: lines, overflow: "hidden" }
    : undefined;

  return (
    <>
      <p ref={textRef} style={clampStyle} className={className}>{text}</p>
      {(isClamped || (expanded && targetHeight !== null)) && (
        <div ref={toggleRef} className="h-8 pt-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="rounded-sm text-[13px] font-semibold text-[#22B16B] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {expanded ? "Menos" : "Más"}
          </button>
        </div>
      )}
    </>
  );
}
