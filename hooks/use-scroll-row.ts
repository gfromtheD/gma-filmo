"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface ScrollRow {
  readonly ref: RefObject<HTMLDivElement>;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly scrollByPage: (direction: -1 | 1) => void;
}

/** Estado de los extremos de una fila con scroll horizontal y desplazamiento por páginas. */
export function useScrollRow(): ScrollRow {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [update]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }, []);

  return { ref, atStart: edges.atStart, atEnd: edges.atEnd, scrollByPage };
}
