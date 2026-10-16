"use client";

import { useEffect, useRef, useState } from "react";
import type { PosterStyle } from "@/types/catalog";

interface AmbientBackdropProps {
  /** Portada de la diapositiva activa; si falta se usa el degradado del póster. */
  readonly imageUrl?: string;
  readonly style: PosterStyle;
}

const TOP_FADE_MASK = {
  maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
} as const;

/** Duración del fundido entre diapositivas (la misma que el hero). */
const CROSSFADE_MS = 1000;

interface Layer {
  readonly key: string;
  readonly imageUrl?: string;
  readonly tone: readonly [string, string];
}

function layerFor(imageUrl: string | undefined, style: PosterStyle): Layer {
  return { key: imageUrl ?? `${style.tone[0]}-${style.tone[1]}`, imageUrl, tone: style.tone };
}

function LayerArt({ layer, fadeIn }: { layer: Layer; fadeIn: boolean }) {
  const animation = fadeIn ? { animation: `fadeIn ${CROSSFADE_MS}ms ease both` } : undefined;
  return (
    <div className="absolute inset-0 motion-reduce:![animation:none]" style={animation}>
      {/* Capa 1: toda la pantalla, muy desenfocada y a media opacidad */}
      {layer.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layer.imageUrl} alt="" className="h-full w-full scale-[1.2] object-cover opacity-50 blur-[80px]" />
      ) : (
        <div
          className="h-full w-full scale-[1.2] opacity-50 blur-[80px]"
          style={{ background: `linear-gradient(135deg, ${layer.tone[0]}, ${layer.tone[1]})` }}
        />
      )}
      {/* Capa 2: franja superior (~48 % de la altura), menos desenfocada y opaca, que se desvanece hacia abajo */}
      <div className="absolute inset-x-0 top-0 h-[48vh]" style={TOP_FADE_MASK}>
        {layer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={layer.imageUrl} alt="" className="h-full w-full scale-[1.2] object-cover blur-[50px]" />
        ) : (
          <div
            className="h-full w-full scale-[1.2] blur-[50px]"
            style={{ background: `linear-gradient(135deg, ${layer.tone[0]}, ${layer.tone[1]})` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Resplandor ambiental: la portada de la diapositiva activa, muy desenfocada, queda fija
 * detrás de toda la página. Al cambiar de diapositiva el color de fondo se funde con el de la
 * nueva portada, y las filas "flotan" sobre un cristal teñido por ella.
 */
export function AmbientBackdrop({ imageUrl, style }: AmbientBackdropProps) {
  const next = layerFor(imageUrl, style);
  const [current, setCurrent] = useState<Layer>(next);
  const [leaving, setLeaving] = useState<Layer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (next.key === current.key) return;
    setLeaving(current);
    setCurrent(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), CROSSFADE_MS);
    // current se actualiza dentro del efecto: solo depende de la portada entrante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next.key]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-gma-bg"
      style={{ contain: "strict" }}
    >
      {leaving && <LayerArt key={`out-${leaving.key}`} layer={leaving} fadeIn={false} />}
      <LayerArt key={current.key} layer={current} fadeIn={leaving !== null} />
    </div>
  );
}
