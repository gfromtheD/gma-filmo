"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./three-d-marquee.module.css";
import { cn } from "@/lib/utils";

interface ThreeDMarqueeProps {
  images?: string[];
  className?: string;
  columns?: number;
  extraColumns?: number;
  paused?: boolean;
  largePostersOnDesktop?: boolean;
}

// Las 80 portadas del catalogo (generado desde GMA_CONTENT/catalog_r2.json)
export const GMA_POSTERS = [
  "/r2/peliculas/yasha-gozen/poster.jpg",
  "/r2/peliculas/ventisca-negra/poster.jpg",
  "/r2/peliculas/ylli/poster.jpg",
  "/r2/peliculas/una-ciudad-de-mierda-con-un-gato/poster.jpg",
  "/r2/peliculas/the-match/poster.jpg",
  "/r2/peliculas/wave-core/poster.jpg",
  "/r2/peliculas/terminado-el-dia/poster.jpg",
  "/r2/peliculas/space-tourism/poster.jpg",
  "/r2/peliculas/todavia-esperamos/poster.jpg",
  "/r2/peliculas/trajecte-ultim/poster.jpg",
  "/r2/peliculas/space-diamond/poster.jpg",
  "/r2/peliculas/solo-divirtiendose-en-un-agotador-trabajo/poster.jpg",
  "/r2/peliculas/solio/poster.jpg",
  "/r2/peliculas/si/poster.jpg",
  "/r2/peliculas/shefish/poster.jpg",
  "/r2/peliculas/smile-shine-2/poster.jpg",
  "/r2/peliculas/simon/poster.jpg",
  "/r2/peliculas/sleep-patters/poster.jpg",
  "/r2/peliculas/siul-a-fun-fan-animation/poster.jpg",
  "/r2/peliculas/sangre-de-hermanos/poster.jpg",
  "/r2/peliculas/rojo-y-negro-sobre-blanco/poster.jpg",
  "/r2/peliculas/ratametraje/poster.jpg",
  "/r2/peliculas/quizas-la-flor-quizas-la-muerte-quizas/poster.jpg",
  "/r2/peliculas/que-es-un-heroe/poster.jpg",
  "/r2/peliculas/pequenos-problemas/poster.jpg",
  "/r2/peliculas/protestas-una-historia/poster.jpg",
  "/r2/peliculas/puerta/poster.jpg",
  "/r2/peliculas/ojos/poster.jpg",
  "/r2/peliculas/no-voy-a-decir-que-no-merezco-esto/poster.jpg",
  "/r2/peliculas/opium/poster.jpg",
  "/r2/peliculas/papa/poster.jpg",
  "/r2/peliculas/microsuenos/poster.jpg",
  "/r2/peliculas/no-debimos-jugar/poster.jpg",
  "/r2/peliculas/mi-amo/poster.jpg",
  "/r2/peliculas/medianoche/poster.jpg",
  "/r2/peliculas/me-hice-el-pendejo-todo-el-ano-y-no-iba-a-participar-pero-al-final-si-aso-que-hice-esta-mamada/poster.jpg",
  "/r2/peliculas/maquinas-de-guerra/poster.jpg",
  "/r2/peliculas/mal-viaje/poster.jpg",
  "/r2/peliculas/los-origenes-de-palo-alzado/poster.jpg",
  "/r2/peliculas/llevame-al-rio/poster.jpg",
  "/r2/peliculas/limbo/poster.jpg",
  "/r2/peliculas/laqu/poster.jpg",
  "/r2/peliculas/light-life/poster.jpg",
  "/r2/peliculas/la-nieve-que-mata/poster.jpg",
  "/r2/peliculas/la-historia-mas-larga/poster.jpg",
  "/r2/peliculas/la-fabrica-de-desahuciados/poster.jpg",
  "/r2/peliculas/la-banana-tuerta-de-gamp/poster.jpg",
  "/r2/peliculas/infinity-projections/poster.jpg",
  "/r2/peliculas/kalle-sonrisa/poster.jpg",
  "/r2/peliculas/huas-huas/poster.jpg",
  "/r2/peliculas/hijo-natural/poster.jpg",
  "/r2/peliculas/guerra-en-sarilla/poster.jpg",
  "/r2/peliculas/impulso/poster.jpg",
  "/r2/peliculas/higiene-de-sueno/poster.jpg",
  "/r2/peliculas/genesis-animatic/poster.jpg",
  "/r2/peliculas/flores-de-agua/poster.jpg",
  "/r2/peliculas/fe-faith/poster.jpg",
  "/r2/peliculas/fantaso4/poster.jpg",
  "/r2/peliculas/escarnio/poster.jpg",
  "/r2/peliculas/es-solo-un-sueno/poster.jpg",
  "/r2/peliculas/en-el-desierto/poster.jpg",
  "/r2/peliculas/el-ser-mas-debil/poster.jpg",
  "/r2/peliculas/el-ultimo-futuro/poster.jpg",
  "/r2/peliculas/el-otro-choque/poster.jpg",
  "/r2/peliculas/el-lenguaje-es-matematico/poster.jpg",
  "/r2/peliculas/el-llamado-de-la-tierra/poster.jpg",
  "/r2/peliculas/el-cine-cobra-vida/poster.jpg",
  "/r2/peliculas/e-toro/poster.jpg",
  "/r2/peliculas/dios-hazme-alto-y-no-me-la-jalo-en-4-semanas/poster.jpg",
  "/r2/peliculas/dualidad/poster.jpg",
  "/r2/peliculas/curvilinea/poster.jpg",
  "/r2/peliculas/cuco/poster.jpg",
  "/r2/peliculas/control-mental/poster.jpg",
  "/r2/peliculas/cazando-perros/poster.jpg",
  "/r2/peliculas/chi-no-wadachi-fan-animation/poster.jpg",
  "/r2/peliculas/ceguera-temporal-2/poster.jpg",
  "/r2/peliculas/caso-6811-el-extrano-mundo-de-gumball/poster.jpg",
  "/r2/peliculas/ancronia-95/poster.jpg",
  "/r2/peliculas/a-cada-cual-su-espera/poster.jpg",
  "/r2/peliculas/ano-1-antes-de-covid/poster.jpg",
];

const COLUMN_DURATIONS = [112, 138, 124, 146, 118, 132, 128, 142, 122, 136];
const MIN_ITEMS_PER_GROUP = 16;

function MarqueeColumn({ images, index, paused, className, largePostersOnDesktop }: {
  images: string[];
  index: number;
  paused: boolean;
  className?: string;
  largePostersOnDesktop: boolean;
}) {
  const repeats = Math.ceil(MIN_ITEMS_PER_GROUP / images.length);
  const group = Array.from({ length: repeats }, () => images).flat();
  const duration = (COLUMN_DURATIONS[index % COLUMN_DURATIONS.length] ?? 112) * group.length / MIN_ITEMS_PER_GROUP;

  return (
    <div className={cn(styles.column, className)}>
      <div
        className={styles.track}
        style={{
          animationDuration: `${duration}s`,
          animationDelay: `${-index * 19}s`,
          animationDirection: index % 2 === 0 ? "normal" : "reverse",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {/* Both groups include their trailing gap. Half of the complete track is
            therefore exactly one repeat, including the seam between groups. */}
        {[0, 1].map((copy) => (
          <div key={copy} className={styles.group}>
            {group.map((src, imageIndex) => (
              <div
                key={`${imageIndex}-${src}`}
                className={styles.poster}
                style={{ "--poster-depth": `${[16, 0, 8, -6][imageIndex % 4]}px` } as CSSProperties}
              >
                <Image
                  src={src}
                  alt=""
                  width={480}
                  height={270}
                  sizes={largePostersOnDesktop ? "(min-width: 768px) 28vw, 220px" : "(min-width: 1280px) 300px, (min-width: 768px) 260px, 220px"}
                  quality={65}
                  loading="lazy"
                  draggable={false}
                  className={styles.image}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThreeDMarquee({
  images = GMA_POSTERS,
  className,
  columns = 4,
  extraColumns = 0,
  paused = false,
  largePostersOnDesktop = false,
}: ThreeDMarqueeProps) {
  const posters = images.filter(Boolean);
  if (!posters.length) return null;

  const mobileColumns = Math.max(4, Math.min(8, Math.floor(columns))) + Math.max(0, Math.floor(extraColumns));
  const tabletColumns = mobileColumns + 2;
  const desktopColumns = mobileColumns + 4;
  // Interleave the actual catalog rather than repeatedly showing one chunk.
  const chunks = Array.from({ length: desktopColumns }, (_, index) => {
    const selected = posters.filter((_, posterIndex) => posterIndex % desktopColumns === index);
    return selected.length ? selected : [posters[index % posters.length]!];
  });

  return (
    <div
      aria-hidden="true"
      className={cn(styles.scene, largePostersOnDesktop && styles.largePosters, "h-[40rem] w-full", className)}
      style={{
        "--marquee-columns-mobile": mobileColumns,
        "--marquee-columns-tablet": tabletColumns,
        "--marquee-columns-desktop": desktopColumns,
      } as CSSProperties}
    >
      <div className={styles.field}>
        {chunks.map((chunk, index) => (
          <MarqueeColumn
            key={index}
            images={chunk}
            index={index}
            paused={paused}
            largePostersOnDesktop={largePostersOnDesktop}
            className={index >= tabletColumns ? styles.desktopBuffer : index >= mobileColumns ? styles.tabletBuffer : undefined}
          />
        ))}
      </div>
    </div>
  );
}
