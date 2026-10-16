"use client";

import { usePathname } from "next/navigation";

/**
 * Fondo de toda la web: sobre el negro de la página, cuatro manchas de color muy suaves (dos verdes, un violeta y un teal)
 * que derivan despacio detrás del contenido. Es el fondo «líquido» del buscador llevado a todas las páginas.
 *
 * Barato de pintar: cada mancha es un degradado radial (no un filtro de desenfoque) y solo se anima `transform`. Va
 * fijo y con `z-index: -1`, así queda detrás de todo sin necesidad de dar capa al resto del contenido. Con movimiento
 * reducido se queda quieto.
 *
 * En Inicio y en la ficha de cada título no se pinta: allí el fondo lo da el color de la portada (AmbientBackdrop) y las
 * dos cosas se mezclarían.
 */
/** Páginas con su propio fondo de color: Inicio y la ficha de un título (/cortos/<id>, no las colecciones). */
function hasOwnBackground(pathname: string): boolean {
  return pathname === "/inicio" || /^\/cortos\/[^/]+$/.test(pathname);
}

const BLOBS = [
  { name: "a", rgb: "34,177,107", alpha: 0.4, className: "-left-[14%] -top-[22%] h-[90vh] w-[75vw]" },
  { name: "b", rgb: "91,63,209", alpha: 0.35, className: "-right-[16%] top-[0%] h-[95vh] w-[70vw]" },
  { name: "c", rgb: "19,140,150", alpha: 0.3, className: "-bottom-[32%] left-[14%] h-[85vh] w-[80vw]" },
  { name: "d", rgb: "34,177,107", alpha: 0.26, className: "-bottom-[18%] -right-[10%] h-[70vh] w-[55vw]" },
] as const;

export function SiteAurora() {
  const pathname = usePathname();
  if (hasOwnBackground(pathname)) return null;

  return (
    <div
      aria-hidden="true"
      data-site-aurora=""
      className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden"
      style={{ contain: "strict" }}
    >
      {BLOBS.map((blob) => (
        <div
          key={blob.name}
          data-aurora-blob={blob.name}
          className={`aurora-${blob.name} absolute rounded-full will-change-transform ${blob.className}`}
          style={{
            backgroundImage: `radial-gradient(closest-side, rgba(${blob.rgb},${blob.alpha}) 0%, rgba(${blob.rgb},${(blob.alpha * 0.55).toFixed(3)}) 45%, rgba(${blob.rgb},0) 100%)`,
          }}
        />
      ))}
    </div>
  );
}
