"use client";

interface HeroIndicatorProps {
  readonly count: number;
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
  /** Pausa el avance (p. ej. mientras suena un tráiler): detiene el llenado del punto activo. */
  readonly isPaused: boolean;
  /** El llenado del punto activo terminó: toca pasar a la siguiente diapositiva. */
  readonly onComplete: () => void;
  /** Sin avance automático (movimiento reducido): el punto activo se muestra lleno y quieto. */
  readonly isStatic: boolean;
}

/**
 * Indicador de diapositivas del hero. El punto activo se alarga a 32 px y se llena de izquierda a
 * derecha en 8 s (animación CSS `dot-fill-anim`); al terminar avisa con `onComplete`, así el
 * temporizador y lo que se ve son siempre la misma cosa.
 */
export function HeroIndicator({ count, activeIndex, onSelect, isPaused, onComplete, isStatic }: HeroIndicatorProps) {
  if (count < 2) return null;
  return (
    <div className="absolute bottom-32 right-16 z-30 hidden items-center gap-2 lg:flex" role="group" aria-label="Diapositivas destacadas">
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Ir a la diapositiva ${i + 1} de ${count}`}
            aria-current={isActive ? "true" : undefined}
            onClick={() => onSelect(i)}
            className={`h-2 cursor-pointer overflow-hidden rounded-full shadow-lg outline-offset-4 transition-[width,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none ${
              isActive ? "w-8 bg-white/30" : "w-2 bg-white"
            }`}
          >
            {isActive && (
              <span
                // Se reinicia al cambiar de diapositiva (key) y se detiene con `isPaused`.
                key={activeIndex}
                className={`block h-full w-full origin-left bg-white ${isStatic ? "" : "dot-filling"}`}
                style={isStatic ? undefined : { animationPlayState: isPaused ? "paused" : "running" }}
                onAnimationEnd={isStatic ? undefined : onComplete}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
