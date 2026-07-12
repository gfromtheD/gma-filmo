import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface BoxesLoaderProps {
  /** Overall font-size (px) the loader scales from — controls its footprint. */
  size?: number;
  /** Box + ground line color. Defaults to the studio accent green. */
  color?: string;
  className?: string;
}

const BOX_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * "Boxes" loader — a row of small boxes that drop onto a ground line with a
 * staggered cascade, squash on impact, and rise back up in an infinite loop.
 * Matching CSS/keyframes live in app/globals.css (`.boxes-loader` block),
 * following this repo's convention of namespaced global classes for bespoke
 * component animations (see `.gsp-*` / `.studio-spin`).
 */
export function BoxesLoader({ size = 16, color = "#22B16B", className }: BoxesLoaderProps) {
  return (
    <div
      className={cn("boxes-loader", className)}
      style={{ fontSize: size, "--boxes-loader-color": color } as CSSProperties}
      role="status"
      aria-label="Cargando"
    >
      {BOX_INDICES.map((i) => (
        <div key={i} className={cn("box", `box${i}`)}>
          <div />
        </div>
      ))}
      <div className="ground">
        <div />
      </div>
    </div>
  );
}
