"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * Pantalla de carga de la caja de subida mientras el motor procesa el vídeo (conversión, optimización, versiones HLS…).
 * Una «cubeta» de cristal en la que va cayendo, una a una, la tarea que se está haciendo. Sustituye a la barra de carga:
 * la caja representa el trabajo desde que empieza la subida hasta que el vídeo está listo. Adaptada del componente
 * Bucket (21st.dev): se quitaron los iconos de terceros y la mayoría de filtros SVG, y se ajustó al tema oscuro de GMA.
 *
 * Las tareas son un texto orientativo que va rotando: no miden el avance real del motor.
 */

interface Stage {
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
}

const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "size-5" } as const;

const UPLOADING_STAGE: Stage = {
  title: "Subiendo tu vídeo",
  description: "Enviándolo a nuestros servidores",
  icon: <svg {...ICON_PROPS}><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></svg>,
};

/** Tareas del procesado: van rotando mientras el servidor trabaja. */
const PROCESSING_STAGES: readonly Stage[] = [
  {
    title: "Convirtiendo tu vídeo",
    description: "Lo preparamos para cualquier dispositivo",
    icon: <svg {...ICON_PROPS}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" /></svg>,
  },
  {
    title: "Optimizando",
    description: "Menos peso sin perder calidad",
    icon: <svg {...ICON_PROPS}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>,
  },
  {
    title: "Creando calidades",
    description: "Una versión para cada velocidad de conexión",
    icon: <svg {...ICON_PROPS}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>,
  },
  {
    title: "Casi listo",
    description: "Comprobando que todo se reproduce bien",
    icon: <svg {...ICON_PROPS}><path d="M20 6 9 17l-5-5" /></svg>,
  },
];

const ROTATE_MS = 2600;
const EASE = [0.455, 0.03, 0.515, 0.955] as const;

/** Verdadero en pantallas estrechas: la cubeta es más pequeña y la tarea cae menos. */
function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isNarrow;
}

const GLASS_STROKE = "rgba(255,255,255,0.16)";

export function ProcessingBucket({ phase, className = "" }: { readonly phase: "uploading" | "processing"; readonly className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const isNarrow = useIsNarrow();
  const [index, setIndex] = useState(0);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    if (reduceMotion || phase === "uploading") return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % PROCESSING_STAGES.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, phase]);

  const stage = phase === "uploading" ? UPLOADING_STAGE : PROCESSING_STAGES[index % PROCESSING_STAGES.length]!;

  return (
    <div className={`relative isolate w-full max-w-[420px] ${className}`} style={{ aspectRatio: "655 / 352" }} role="status" aria-label={`${stage.title}. ${stage.description}`}>
      {/* Parte de atrás: asas, borde posterior y laterales */}
      <svg aria-hidden="true" viewBox="0 0 655 352" fill="none" className="absolute inset-0 z-0 size-full">
        <defs>
          <linearGradient id={`${gradientId}-rim`} x1="329" y1="43" x2="329" y2="79" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.3" />
            <stop offset="1" stopColor="white" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d="M535.59 78.7427L487.973 42.8776L558.738 13.9516C562.902 12.2494 564.984 11.3984 567.143 11.5597C569.301 11.7211 571.233 12.8723 575.098 15.1747L590.22 24.1832C603.923 32.347 610.775 36.4289 610.372 42.0779C609.97 47.7269 602.609 50.7964 587.887 56.9354L535.59 78.7427Z" fill="white" fillOpacity="0.16" stroke={GLASS_STROKE} />
        <path d="M123.116 79.1145L171.548 42.8776L97.2715 12.5164C94.8305 11.5186 93.61 11.0197 92.3446 11.1143C91.0793 11.2089 89.9465 11.8837 87.681 13.2334L56.155 32.0149C48.1832 36.7641 44.1973 39.1386 44.4205 42.4378C44.6438 45.737 48.9132 47.553 57.4522 51.1849L123.116 79.1145Z" fill="white" fillOpacity="0.16" stroke={GLASS_STROKE} />
        <path d="M487.973 42.8774L171.548 42.8775L123.116 79.1144L535.59 78.7424L487.973 42.8774Z" fill={`url(#${gradientId}-rim)`} stroke={GLASS_STROKE} />
        <path d="M171.548 78.9088V42.8774L123.116 79.1144L171.548 78.9088Z" fill="white" fillOpacity="0.12" />
        <path d="M487.973 78.9088V42.8774L536.404 79.1144L487.973 78.9088Z" fill="white" fillOpacity="0.12" />
      </svg>

      {/* La tarea que cae dentro: queda detrás de la parte delantera, así parece entrar en la cubeta */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative flex h-full w-full items-center justify-center" style={{ paddingBottom: "65%" }}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={stage.title}
              initial={reduceMotion ? false : { y: isNarrow ? -45 : -60, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: isNarrow ? 0.95 : 1.15 }}
              exit={reduceMotion ? undefined : { y: isNarrow ? 90 : 120, scale: 0.8, transition: { duration: 0.8 } }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute flex w-[240px] origin-bottom items-center gap-2 rounded-full border border-white/12 bg-gma-surface p-2 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#22B16B]/15 text-[#2AC57A]">{stage.icon}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-bold leading-none text-white">{stage.title}</span>
                <span className="text-[11.5px] leading-snug text-[#A8A8A8]">{stage.description}</span>
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Parte delantera de cristal */}
      <svg aria-hidden="true" viewBox="0 0 655 352" fill="none" className="pointer-events-none absolute inset-0 z-20 size-full overflow-hidden">
        <path
          d="M512.766 79.1595L147.766 79.1624C136.453 79.1625 130.796 79.1626 127.281 82.6773C123.766 86.192 123.766 91.8488 123.766 103.162V327.159C123.766 338.473 123.766 344.13 127.281 347.645C130.796 351.159 136.453 351.159 147.766 351.159H512.766C524.08 351.159 529.737 351.159 533.252 347.645C536.766 344.13 536.766 338.473 536.766 327.159V103.159C536.766 91.8457 536.766 86.1888 533.252 82.6741C529.737 79.1594 524.08 79.1594 512.766 79.1595Z"
          style={{ fill: "var(--gma-surface)" }} stroke={GLASS_STROKE}
        />
        <path
          d="M74.6011 164.033L123.116 79.1138L535.59 78.7419L581.532 164.469C588.006 176.55 591.243 182.59 588.568 187.06C585.892 191.529 579.039 191.529 565.333 191.529H90.5591C76.4759 191.529 69.4343 191.529 66.7781 186.953C64.1219 182.376 67.615 176.262 74.6011 164.033Z"
          fill="white" fillOpacity="0.14" stroke={GLASS_STROKE}
        />
      </svg>
    </div>
  );
}
