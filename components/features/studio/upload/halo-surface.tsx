"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";

/**
 * Superficie con «halo» para las cajas de subida. Adaptada del Halo Dropzone (cult-ui): relleno translúcido (deja ver el
 * fondo de la web) y, en el borde, dos luces —una verde y otra teal— que lo recorren a medio perímetro de distancia una de
 * otra, cuando la caja está en uso (ratón encima, foco o arrastrando un archivo).
 */

const TRAIL_LOOP_MS = 5250;
const CORNER_RADIUS_PX = 14;
/** Colores de las luces del borde (el verde y el teal del fondo de la web, `SiteAurora`; el teal algo más claro para que se lea), en RGB. */
const GREEN = "34,177,107";
const CYAN = "45,190,200";

/** Luz del borde: la verde es la principal y la teal, la secundaria. */
const TRAILS = {
  green: {
    ambient: `linear-gradient(90deg, transparent 0%, rgba(${GREEN},0) 6%, rgba(${GREEN},0.34) 28%, rgba(${GREEN},0.44) 50%, rgba(${GREEN},0.3) 74%, rgba(${GREEN},0) 94%, transparent 100%)`,
    core: `linear-gradient(90deg, transparent 0%, rgba(${GREEN},0.7) 22%, rgba(120,235,175,0.95) 50%, rgba(${GREEN},0.75) 78%, transparent 100%)`,
    ambientGlow: `0 0 22px rgba(${GREEN},0.3), 0 0 44px rgba(${GREEN},0.2)`,
    coreGlow: `0 0 14px rgba(${GREEN},0.45), 0 0 28px rgba(${GREEN},0.3), inset 0 0 1px rgba(255,255,255,0.22)`,
  },
  teal: {
    ambient: `linear-gradient(90deg, transparent 0%, rgba(${CYAN},0) 6%, rgba(${CYAN},0.34) 28%, rgba(${CYAN},0.44) 50%, rgba(${CYAN},0.3) 74%, rgba(${CYAN},0) 94%, transparent 100%)`,
    core: `linear-gradient(90deg, transparent 0%, rgba(${CYAN},0.7) 22%, rgba(150,236,242,0.95) 50%, rgba(${CYAN},0.75) 78%, transparent 100%)`,
    ambientGlow: `0 0 22px rgba(${CYAN},0.3), 0 0 44px rgba(${CYAN},0.2)`,
    coreGlow: `0 0 14px rgba(${CYAN},0.45), 0 0 28px rgba(${CYAN},0.3), inset 0 0 1px rgba(255,255,255,0.22)`,
  },
} as const;

type TrailName = keyof typeof TRAILS;

const TRAIL_BOX = {
  height: 32,
  width: 184,
  offsetPath: `rect(0 auto auto 0 round ${CORNER_RADIUS_PX}px)`,
} as const;

/** Mascara que deja ver la luz solo sobre el borde de 1 px. */
const RIM_MASK: CSSProperties = {
  maskClip: "padding-box, border-box",
  maskComposite: "intersect",
  maskImage: "linear-gradient(transparent, transparent), linear-gradient(#000, #000)",
  WebkitMaskClip: "padding-box, border-box",
  WebkitMaskComposite: "source-in",
  WebkitMaskImage: "linear-gradient(transparent, transparent), linear-gradient(#000, #000)",
};

/** Una luz que recorre el borde. `phase` (0–100) la adelanta ese porcentaje del perímetro respecto a la otra. */
function TrailLight({ progress, phase, name }: { readonly progress: MotionValue<number>; readonly phase: number; readonly name: TrailName }) {
  const offsetDistance = useTransform(progress, (v: number) => `${(((v + phase) % 100) + 100) % 100}%`);
  const trail = TRAILS[name];
  return (
    <>
      <motion.div className="absolute opacity-95" style={{ ...TRAIL_BOX, filter: "blur(12px)", offsetDistance }}>
        <div className="size-full rounded-full" style={{ background: trail.ambient, boxShadow: trail.ambientGlow }} />
      </motion.div>
      <motion.div className="absolute" style={{ ...TRAIL_BOX, filter: "blur(4px)", offsetDistance }}>
        <div className="size-full rounded-full" style={{ background: trail.core, boxShadow: trail.coreGlow }} />
      </motion.div>
    </>
  );
}

/** Las dos luces del borde, en lados opuestos (medio perímetro de diferencia) para que nunca se junten. */
function BorderTrails({ active }: { readonly active: boolean }) {
  const progress = useMotionValue(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      progress.set((((progress.get() + ((now - last) / TRAIL_LOOP_MS) * 100) % 100) + 100) % 100);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, progress]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
      style={RIM_MASK}
    >
      <TrailLight progress={progress} phase={0} name="green" />
      <TrailLight progress={progress} phase={50} name="teal" />
    </div>
  );
}

export type HaloTone = "default" | "success" | "error";

const TONE_BORDER: Record<HaloTone, string> = {
  default: "border-white/12",
  success: "border-[#22B16B]/50",
  error: "border-[#ff5252]/60",
};

interface HaloSurfaceProps {
  /** La luz del borde se mueve (ratón encima, foco o arrastrando un archivo). */
  readonly active: boolean;
  readonly tone?: HaloTone;
  /** Clases de la superficie (tamaño, disposición del contenido…). */
  readonly className?: string;
  readonly children: ReactNode;
}

/** Contenedor translúcido con halo. El contenido se coloca con `className`, como en cualquier `div`. */
export function HaloSurface({ active, tone = "default", className = "", children }: HaloSurfaceProps) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <div className="relative rounded-[14px]">
      <div
        className={`relative isolate overflow-hidden rounded-[14px] border backdrop-blur-xl backdrop-saturate-150 transition-colors duration-200 ${TONE_BORDER[tone]} ${className}`}
        style={{ background: "color-mix(in srgb, var(--gma-bg) 58%, transparent)" }}
      >
        {children}
      </div>
      {!reduceMotion && <div className="pointer-events-none absolute inset-0 rounded-[14px]"><BorderTrails active={active} /></div>}
    </div>
  );
}
