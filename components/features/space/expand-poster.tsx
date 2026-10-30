"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PosterArt } from "@/components/ui/poster-art";
import type { MovieMedia } from "@/types/catalog";

const OPEN_DELAY_MS = 140;
const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

/**
 * Portada vertical que, al pasar el cursor, se abre hacia los lados hasta su versión horizontal (la de las películas).
 * La versión vertical se funde con la horizontal mientras se ensancha, y se desplaza lo justo para no salirse de la
 * lista. Solo con ratón: en pantallas táctiles se queda vertical. Con «reducir movimiento» no se expande.
 */
export function ExpandPoster({ item }: { readonly item: MovieMedia }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState<{ width: number; wide: number; shift: number } | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function show() {
    if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const bounds = el.closest("ul")?.getBoundingClientRect();
      const wide = Math.round((box.height * 16) / 9);
      const centered = -(wide - box.width) / 2;
      // Centrada sobre su sitio, pero sin salirse por los lados de la lista.
      const min = bounds ? bounds.left - box.left : centered;
      const max = bounds ? bounds.right - box.left - wide : centered;
      setOpen({ width: box.width, wide, shift: Math.min(Math.max(centered, min), Math.max(min, max)) });
    }, OPEN_DELAY_MS);
  }
  function hide() {
    clearTimeout(timer.current);
    setOpen(null);
  }

  const portrait = item.portraitImageUrl ?? item.imageUrl;
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className="relative block rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <span className="block overflow-hidden rounded-[10px]">
        <PosterArt style={item.style} title={item.title} kind="movie" ratio="portrait" imageUrl={portrait} />
      </span>
      <AnimatePresence>
        {open && (
          <motion.span key="amplia" aria-hidden="true"
            initial={{ width: open.width, x: 0 }} animate={{ width: open.wide, x: open.shift }} exit={{ width: open.width, x: 0, transition: { duration: 0.18 } }}
            transition={SPRING}
            className="pointer-events-none absolute left-0 top-0 z-30 block h-full overflow-hidden rounded-[10px] shadow-[0_30px_60px_-16px_rgba(0,0,0,0.95)] ring-1 ring-white/25">
            <motion.span className="absolute inset-0 block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <PosterArt fill style={item.style} title="" kind="movie" ratio="landscape" imageUrl={item.imageUrl} />
            </motion.span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
