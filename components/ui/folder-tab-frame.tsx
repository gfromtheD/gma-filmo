"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Contorno de la pestaña: esquina redondeada, lomo recto y una caída en diagonal, como la oreja de una carpeta. */
const TAB_PATH = "M0 36 L0 12 Q0 0 12 0 L150 0 Q161 0 168 9 L188 28 Q194 36 206 36 Z";

/**
 * Marco con la «dobladez» clásica de una carpeta: una pestaña del color de la carpeta asoma por arriba a la izquierda y
 * se funde con el borde superior del contenido, en vez de una línea fina. La pestaña sube desde detrás al aparecer.
 */
export function FolderTabFrame({ color, children, className = "" }: { readonly color: string; readonly children: ReactNode; readonly className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={`relative pt-11 ${className}`}>
      <motion.svg aria-hidden="true" viewBox="0 0 206 36" preserveAspectRatio="none"
        initial={reduceMotion ? false : { y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.05 }}
        className="pointer-events-none absolute left-0 top-0 h-11 w-[clamp(170px,36%,250px)]">
        <defs>
          <linearGradient id="folder-tab-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${color} 72%, white)` }} />
            <stop offset="1" style={{ stopColor: color }} />
          </linearGradient>
        </defs>
        <path d={TAB_PATH} fill="url(#folder-tab-fill)" />
        <path d={TAB_PATH} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </motion.svg>
      {children}
    </div>
  );
}
