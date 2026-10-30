"use client";

import { useEffect, useState } from "react";
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

/**
 * Lo que tarda el color en pasar de una portada a la siguiente. Más largo que el fundido del hero a propósito: el hero es
 * lo que se mira y tiene que cambiar con decisión; el ambiente es lo que se siente y tiene que irse transformando.
 */
const FADE_MS = 1600;
/** Curva de la referencia (`ease-in-out` de Material): arranca y termina despacio, sin tirones. */
const FADE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Layer {
  readonly key: string;
  readonly imageUrl?: string;
  readonly tone: readonly [string, string];
}

/** Una capa en pantalla: `shown` decide a qué opacidad está (1 = es la portada actual, 0 = se está yendo). */
interface Slot {
  readonly layer: Layer;
  readonly shown: boolean;
}

function layerFor(imageUrl: string | undefined, style: PosterStyle): Layer {
  return { key: imageUrl ?? `${style.tone[0]}-${style.tone[1]}`, imageUrl, tone: style.tone };
}

function Blurred({ layer, className }: { layer: Layer; className: string }) {
  return layer.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={layer.imageUrl} alt="" className={`h-full w-full scale-[1.2] object-cover ${className}`} />
  ) : (
    <div className={`h-full w-full scale-[1.2] ${className}`} style={{ background: `linear-gradient(135deg, ${layer.tone[0]}, ${layer.tone[1]})` }} />
  );
}

function LayerArt({ layer }: { layer: Layer }) {
  return (
    <>
      {/* Capa 1: toda la pantalla, muy desenfocada y a media opacidad: el tinte base de la página. */}
      <Blurred layer={layer} className="opacity-50 blur-[80px]" />
      {/* Capa 2: franja superior (40 % de la altura), menos desenfocada, que se desvanece hacia abajo. Entra con mezcla
          «screen» y solo al 20 %: añade luz y color arriba, donde está el hero, sin teñir el resto. */}
      <div className="absolute inset-x-0 top-0 hidden h-[40vh] opacity-20 mix-blend-screen lg:block">
        <div className="h-full w-full" style={TOP_FADE_MASK}>
          <Blurred layer={layer} className="blur-[50px]" />
        </div>
      </div>
    </>
  );
}

/**
 * Resplandor ambiental: la portada de la diapositiva activa, muy desenfocada, queda fija detrás de toda la página.
 *
 * Al cambiar de diapositiva las dos portadas conviven y se cruzan por opacidad (la que sale baja mientras la que entra
 * sube), así que el color no salta de uno a otro: pasa por un tono intermedio, más oscuro y neutro, y se asienta en el
 * nuevo. Con «reducir movimiento» el cambio es directo.
 */
export function AmbientBackdrop({ imageUrl, style }: AmbientBackdropProps) {
  const next = layerFor(imageUrl, style);
  const [slots, setSlots] = useState<readonly Slot[]>([{ layer: next, shown: true }]);

  useEffect(() => {
    setSlots((previous) => {
      const incoming = previous.find((slot) => slot.layer.key === next.key);
      const others = previous.filter((slot) => slot.layer.key !== next.key).map((slot) => ({ ...slot, shown: false }));
      return [...others, incoming ?? { layer: next, shown: false }];
    });
    // La nueva entra a opacidad 0 y se enciende unos milisegundos después (con un temporizador, no con un fotograma: así
    // funciona también en pestañas en segundo plano) para que la transición llegue a verse.
    const reveal = setTimeout(() => {
      setSlots((current) => current.map((slot) => (slot.layer.key === next.key ? { ...slot, shown: true } : slot)));
    }, 40);
    // Cuando acaba el fundido, se retiran las que se fueron; la actual nunca se quita.
    const cleanup = setTimeout(() => setSlots((current) => current.filter((slot) => slot.shown || slot.layer.key === next.key)), FADE_MS + 150);
    return () => {
      clearTimeout(reveal);
      clearTimeout(cleanup);
    };
    // `next` se recalcula en cada render: solo importa cuándo cambia de portada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next.key]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-gma-bg" style={{ contain: "strict" }}>
      {slots.map((slot) => (
        <div
          key={slot.layer.key}
          className="absolute inset-0 motion-reduce:!transition-none"
          style={{ opacity: slot.shown ? 1 : 0, transition: `opacity ${FADE_MS}ms ${FADE_EASING}` }}
        >
          <LayerArt layer={slot.layer} />
        </div>
      ))}
    </div>
  );
}
