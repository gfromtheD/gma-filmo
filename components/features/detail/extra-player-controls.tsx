"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Undo as RotateCcw, Redo as RotateCw } from "@/components/ui/icons";

/** Mismo formato de tiempo que el reproductor principal. */
export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—:—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Skip10({ direction }: { readonly direction: "back" | "forward" }) {
  const Icon = direction === "back" ? RotateCcw : RotateCw;
  return (
    <span className="relative flex h-[22px] w-[22px] items-center justify-center" aria-hidden="true">
      <Icon size={22} strokeWidth={1.7} />
      <span className="absolute text-[6.5px] font-bold leading-none">10</span>
    </span>
  );
}

export function PlayTriangle({ size = 26 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="extraPlayTriGrad" x1="5" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22B16B" />
          <stop offset="0.5" stopColor="#6EF0AE" />
          <stop offset="1" stopColor="#14C876" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 4.5C7 3.5 5.5 4 5.5 5.5V18.5C5.5 20 7 20.5 8.5 19.5L20.5 13C22 12 22 12 20.5 11Z"
        fill="url(#extraPlayTriGrad)"
      />
    </svg>
  );
}

interface DragSliderProps {
  /** Posición actual, de 0 a 1. */
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly valueText?: string;
  /** Progreso precargado, de 0 a 1 (solo la barra de progreso). */
  readonly buffered?: number;
  /** Paso de las flechas del teclado, en la escala 0–1. */
  readonly keyStep: number;
  readonly variant: "progress" | "volume";
  readonly className?: string;
  /** Texto del tooltip al pasar el ratón (solo la barra de progreso). */
  readonly tooltipFor?: (fraction: number) => string;
}

/** Control deslizante con arrastre y teclado, con el aspecto de los del reproductor principal. */
export function DragSlider({ value, onChange, label, valueText, buffered = 0, keyStep, variant, className = "", tooltipFor }: DragSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);
  const isProgress = variant === "progress";
  const pct = Math.max(0, Math.min(100, value * 100));

  useEffect(() => () => stopDragRef.current?.(), []);

  function fractionAt(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = true;
    setActive(true);
    onChange(fractionAt(event.clientX));

    const onMove = (move: PointerEvent) => {
      onChange(fractionAt(move.clientX));
      setHover(fractionAt(move.clientX));
    };
    const stop = () => {
      dragging.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      stopDragRef.current = null;
    };
    const onUp = (up: PointerEvent) => {
      onChange(fractionAt(up.clientX));
      stop();
    };
    const onCancel = () => {
      stop();
      setActive(false);
    };
    stopDragRef.current = stop;
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowUp" ? keyStep
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -keyStep
      : null;
    if (delta === null && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    event.stopPropagation();
    onChange(event.key === "Home" ? 0 : event.key === "End" ? 1 : Math.max(0, Math.min(1, value + (delta ?? 0))));
  }

  const trackHeight = isProgress ? (active ? 5 : 4) : 3;
  const thumb = isProgress ? (active ? 14 : 10) : active ? 11 : 9;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={valueText}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => {
        if (!dragging.current) {
          setActive(false);
          setHover(null);
        }
      }}
      onPointerMove={(event) => {
        if (tooltipFor) setHover(fractionAt(event.clientX));
      }}
      className={`relative flex cursor-pointer select-none items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B] ${className}`}
      style={{ height: isProgress ? 32 : 20, width: isProgress ? undefined : 56, touchAction: "none" }}
    >
      {tooltipFor && active && hover !== null && (
        <div
          className="pointer-events-none absolute rounded-md border border-white/15 bg-black/85 px-2 py-0.5 text-[12px] tabular-nums text-white"
          style={{ bottom: "calc(100% + 6px)", left: `${hover * 100}%`, transform: "translateX(-50%)" }}
        >
          {tooltipFor(hover)}
        </div>
      )}
      <div
        className={`relative w-full rounded-full transition-[height] duration-150 ${isProgress ? "bg-white/20" : "bg-white/25"}`}
        style={{ height: trackHeight }}
      >
        {isProgress && (
          <div className="absolute left-0 top-0 h-full rounded-full bg-white/25" style={{ width: `${Math.max(0, Math.min(100, buffered * 100))}%` }} />
        )}
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${isProgress ? "bg-[#22B16B]" : "bg-white"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 rounded-full bg-white transition-all duration-150"
        style={{
          width: thumb,
          height: thumb,
          left: `${pct}%`,
          transform: "translate(-50%, -50%)",
          opacity: pct > 0 ? 1 : 0,
          boxShadow: active
            ? isProgress ? "0 0 0 6px rgba(34,177,107,0.28)" : "0 0 0 3px rgba(255,255,255,0.2)"
            : isProgress ? "0 0 0 2px rgba(255,255,255,0.15)" : "none",
        }}
      />
    </div>
  );
}
