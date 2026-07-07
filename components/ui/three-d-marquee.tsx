"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface ThreeDMarqueeProps {
  images?: string[];
  className?: string;
  columns?: number;
  /** Columnas adicionales que extienden el grid hacia la derecha (cubren esquinas
      que el cuadrado base deja sin poblar). Mantienen el mismo ancho de columna. */
  extraColumns?: number;
}

// Las 80 portadas del catalogo (generado desde GMA_CONTENT/catalog_r2.json)
export const GMA_POSTERS = [
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/yasha-gozen/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ventisca-negra/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ylli/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/una-ciudad-de-mierda-con-un-gato/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/the-match/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/wave-core/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/terminado-el-dia/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/space-tourism/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/todavia-esperamos/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/trajecte-ultim/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/space-diamond/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/solo-divirtiendose-en-un-agotador-trabajo/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/solio/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/si/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/shefish/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/smile-shine-2/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/simon/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/sleep-patters/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/siul-a-fun-fan-animation/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/sangre-de-hermanos/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/rojo-y-negro-sobre-blanco/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ratametraje/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/quizas-la-flor-quizas-la-muerte-quizas/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/que-es-un-heroe/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/pequenos-problemas/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/protestas-una-historia/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/puerta/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ojos/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/no-voy-a-decir-que-no-merezco-esto/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/opium/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/papa/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/microsuenos/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/no-debimos-jugar/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/mi-amo/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/medianoche/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/me-hice-el-pendejo-todo-el-ano-y-no-iba-a-participar-pero-al-final-si-aso-que-hice-esta-mamada/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/maquinas-de-guerra/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/mal-viaje/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/los-origenes-de-palo-alzado/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/llevame-al-rio/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/limbo/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/laqu/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/light-life/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/la-nieve-que-mata/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/la-historia-mas-larga/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/la-fabrica-de-desahuciados/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/la-banana-tuerta-de-gamp/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/infinity-projections/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/kalle-sonrisa/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/huas-huas/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/hijo-natural/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/guerra-en-sarilla/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/impulso/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/higiene-de-sueno/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/genesis-animatic/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/flores-de-agua/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/fe-faith/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/fantaso4/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/escarnio/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/es-solo-un-sueno/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/en-el-desierto/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-ser-mas-debil/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-ultimo-futuro/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-otro-choque/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-lenguaje-es-matematico/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-llamado-de-la-tierra/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-cine-cobra-vida/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/e-toro/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/dios-hazme-alto-y-no-me-la-jalo-en-4-semanas/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/dualidad/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/curvilinea/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/cuco/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/control-mental/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/cazando-perros/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/chi-no-wadachi-fan-animation/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ceguera-temporal-2/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/caso-6811-el-extrano-mundo-de-gumball/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ancronia-95/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/a-cada-cual-su-espera/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ano-1-antes-de-covid/poster.jpg",
];

const COL_DURATIONS = [38, 52, 43, 48, 41];

// Each animation half must be taller than the container or black gaps show
// when the loop wraps. Repeat the chunk until one half always covers it.
const MIN_ITEMS_PER_HALF = 10;

function MarqueeColumn({ images, direction, duration }: {
  images: string[];
  direction: "up" | "down";
  duration: number;
}) {
  const repeats = Math.max(1, Math.ceil(MIN_ITEMS_PER_HALF / Math.max(images.length, 1)));
  const half = Array.from({ length: repeats }, () => images).flat();
  // The animation traverses one half per cycle, so perceived speed depends on
  // how tall that half is. Normalize: `duration` = seconds per 4 posters.
  const scaledDuration = (duration / 4) * half.length;

  const animation = direction === "up"
    ? `marqueeUp ${scaledDuration}s linear infinite`
    : `marqueeDown ${scaledDuration}s linear infinite`;

  return (
    <div
      className="flex flex-col items-start gap-5"
      style={{ animation, willChange: "transform" }}
    >
      {[...half, ...half].map((src, i) => (
        <div key={i} className="relative shrink-0 w-full">
          <Image
            src={src}
            alt=""
            width={640}
            height={360}
            sizes="220px"
            draggable={false}
            // Solo las primeras portadas de cada columna están realmente a la
            // vista al cargar la página — esas sí van con prioridad alta. El
            // resto no se pide hasta que el scroll del bucle las acerca a la
            // pantalla (loading="lazy" es el valor por defecto de next/image).
            priority={i < 3}
            loading={i < 3 ? undefined : "lazy"}
            className="aspect-video w-full rounded-lg object-cover select-none"
          />
        </div>
      ))}
    </div>
  );
}

export function ThreeDMarquee({ images = GMA_POSTERS, className, columns = 3, extraColumns = 0 }: ThreeDMarqueeProps) {
  const totalColumns = columns + extraColumns;
  const chunkSize = Math.ceil(images.length / totalColumns);
  const chunks = Array.from({ length: totalColumns }, (_, i) =>
    images.slice(i * chunkSize, i * chunkSize + chunkSize)
  );

  return (
    <div className={cn("block h-140 w-full overflow-hidden rounded-md", className)}>
      <style>{`
        @keyframes marqueeUp {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        @keyframes marqueeDown {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <div className="flex size-full items-center justify-center">
        <div className="aspect-square size-360 shrink-0 scale-115">
          <div
            style={{
              transform: "rotateX(45deg) rotateY(0deg) rotateZ(45deg)",
              transformStyle: "preserve-3d",
              gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
              width: `${(totalColumns / columns) * 100}%`,
            }}
            className="relative top-0 left-[35%] grid h-full origin-top-left gap-5"
          >
            {chunks.map((col, colIndex) => (
              <MarqueeColumn
                key={colIndex}
                images={col}
                direction={colIndex % 2 === 0 ? "up" : "down"}
                duration={COL_DURATIONS[colIndex] ?? 45}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
