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
