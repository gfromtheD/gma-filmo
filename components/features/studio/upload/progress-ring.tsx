"use client";

import type { ReactNode } from "react";

interface ProgressRingProps {
  /** Avance de 0 a 100. `null` = la etapa no informa de su avance: el arco gira en vez de rellenarse. */
  readonly value: number | null;
  /** Qué mide el anillo, para lectores de pantalla («Subida del vídeo»). */
  readonly label: string;
  /** Diámetro total en píxeles (el contenido va dentro, con margen). */
  readonly size?: number;
  readonly stroke?: number;
  readonly className?: string;
  readonly children?: ReactNode;
}

const GREEN = "#22B16B";
const TRACK = "rgba(255,255,255,0.12)";

/**
 * Anillo que rodea un icono y se va rellenando con el avance real de una etapa (empieza arriba y gira en el sentido
 * del reloj). Cada etapa de una subida lleva el suyo, así que al cambiar de etapa el anillo vuelve a empezar de cero.
 * Sin dato de avance (`value = null`) muestra un arco que gira: nunca se inventa un porcentaje.
 */
export function ProgressRing({ value, label, size = 48, stroke = 3, className = "", children }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const clamped = value === null ? null : Math.max(0, Math.min(100, value));
  const circle = { cx: center, cy: center, r: radius, fill: "none", strokeWidth: stroke } as const;

  return (
    <span
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
      {...(clamped === null ? {} : { "aria-valuenow": Math.round(clamped) })}
      className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90">
        <circle {...circle} stroke={TRACK} />
        {clamped === null ? (
          <g className="animate-spin motion-reduce:animate-none" style={{ transformOrigin: `${center}px ${center}px`, animationDuration: "1.4s" }}>
            <circle {...circle} stroke={GREEN} strokeLinecap="round" pathLength={100} strokeDasharray="26 74" />
          </g>
        ) : (
          <circle
            {...circle} stroke={GREEN} strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - clamped}
            className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      {children}
    </span>
  );
}
