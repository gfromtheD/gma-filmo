"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./three-d-marquee.module.css";
import { cn } from "@/lib/utils";

/**
 * Con «reducir movimiento» o con el ahorro de datos del móvil activado, el mosaico no tiene sentido animado (y
 * descargarlo entero tampoco): se queda quieto y con muchas menos portadas. Mismo criterio que el tráiler del hero
 * (`useHeroTrailer`).
 */
function useLiteBackground(): boolean {
  const reduceMotion = useReducedMotion();
  const [saveData, setSaveData] = useState(false);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setSaveData(Boolean(connection?.saveData));
  }, []);
  return Boolean(reduceMotion) || saveData;
}

interface ThreeDMarqueeProps {
  images?: string[];
  className?: string;
  columns?: number;
  extraColumns?: number;
  paused?: boolean;
  largePostersOnDesktop?: boolean;
  /**
   * Cuántas portadas distintas hay por columna antes de repetir (×2 para el bucle continuo): a más alto, más
   * variedad, pero más peticiones de imagen a la vez al montar. 16 por defecto; la pantalla de bienvenida, la más
   * pesada (6-10 columnas, primera vez que entra cualquiera), usa menos para no saturar la red del visitante.
   */
  itemsPerGroup?: number;
}

// Las 80 portadas del catalogo (generado desde GMA_CONTENT/catalog_r2.json)
export const GMA_POSTERS = [
  "/r2/peliculas/yasha-gozen/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ventisca-negra/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ylli/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/una-ciudad-de-mierda-con-un-gato/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/the-match/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/wave-core/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/terminado-el-dia/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/space-tourism/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/todavia-esperamos/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/trajecte-ultim/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/space-diamond/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/solo-divirtiendose-en-un-agotador-trabajo/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/solio/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/si/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/shefish/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/smile-shine-2/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/simon/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/sleep-patters/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/siul-a-fun-fan-animation/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/sangre-de-hermanos/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/rojo-y-negro-sobre-blanco/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ratametraje/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/quizas-la-flor-quizas-la-muerte-quizas/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/que-es-un-heroe/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/pequenos-problemas/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/protestas-una-historia/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/puerta/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ojos/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/no-voy-a-decir-que-no-merezco-esto/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/opium/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/papa/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/microsuenos/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/no-debimos-jugar/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/mi-amo/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/medianoche/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/me-hice-el-pendejo-todo-el-ano-y-no-iba-a-participar-pero-al-final-si-aso-que-hice-esta-mamada/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/maquinas-de-guerra/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/mal-viaje/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/los-origenes-de-palo-alzado/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/llevame-al-rio/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/limbo/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/laqu/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/light-life/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/la-nieve-que-mata/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/la-historia-mas-larga/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/la-fabrica-de-desahuciados/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/la-banana-tuerta-de-gamp/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/infinity-projections/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/kalle-sonrisa/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/huas-huas/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/hijo-natural/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/guerra-en-sarilla/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/impulso/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/higiene-de-sueno/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/genesis-animatic/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/flores-de-agua/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/fe-faith/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/fantaso4/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/escarnio/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/es-solo-un-sueno/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/en-el-desierto/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/el-ser-mas-debil/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/el-ultimo-futuro/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/el-otro-choque/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/el-lenguaje-es-matematico/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/el-llamado-de-la-tierra/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/el-cine-cobra-vida/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/e-toro/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/dios-hazme-alto-y-no-me-la-jalo-en-4-semanas/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/dualidad/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/curvilinea/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/cuco/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/control-mental/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/cazando-perros/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/chi-no-wadachi-fan-animation/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ceguera-temporal-2/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/caso-6811-el-extrano-mundo-de-gumball/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ancronia-95/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/a-cada-cual-su-espera/mosaic-mosaic-20261028.webp",
  "/r2/peliculas/ano-1-antes-de-covid/mosaic-mosaic-20261028.webp",
];

const COLUMN_DURATIONS = [112, 138, 124, 146, 118, 132, 128, 142, 122, 136];
const DEFAULT_ITEMS_PER_GROUP = 16;

function MarqueeColumn({ images, index, paused, className, itemsPerGroup, isLite }: {
  images: string[];
  index: number;
  paused: boolean;
  className?: string;
  itemsPerGroup: number;
  isLite: boolean;
}) {
  const repeats = Math.ceil(itemsPerGroup / images.length);
  const group = Array.from({ length: repeats }, () => images).flat();
  const duration = (COLUMN_DURATIONS[index % COLUMN_DURATIONS.length] ?? 112) * group.length / itemsPerGroup;
  // Las dos copias solo existen para que el bucle no dé un salto al enlazar; quieto (modo ligero) no hace falta.
  const copies = isLite ? [0] : [0, 1];

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
        {copies.map((copy) => (
          <div key={copy} className={styles.group}>
            {group.map((src, imageIndex) => (
              <div
                key={`${imageIndex}-${src}`}
                className={styles.poster}
                style={{ "--poster-depth": `${[16, 0, 8, -6][imageIndex % 4]}px` } as CSSProperties}
              >
                {/* Img normal, no next/image: el optimizador de Vercel tiene un tope mensual de imágenes de origen
                    distintas y, agotado, devuelve 402 para TODA la web (confirmado en producción el 28-10-2026,
                    incluido el logo) hasta el mes siguiente o una mejora de plan. src ya va por /r2/… (el proxy
                    cacheado en el borde de Vercel, sin pasar por ese optimizador: ver next.config.mjs). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  width={480}
                  height={270}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
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
  itemsPerGroup = DEFAULT_ITEMS_PER_GROUP,
}: ThreeDMarqueeProps) {
  // Antes de cualquier salida temprana: las reglas de los Hooks exigen llamarlo siempre.
  const isLite = useLiteBackground();
  const posters = images.filter(Boolean);
  if (!posters.length) return null;

  const effectivePaused = paused || isLite;
  const effectiveItemsPerGroup = isLite ? Math.min(itemsPerGroup, 6) : itemsPerGroup;
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
            paused={effectivePaused}
            itemsPerGroup={effectiveItemsPerGroup}
            isLite={isLite}
            className={index >= tabletColumns ? styles.desktopBuffer : index >= mobileColumns ? styles.tabletBuffer : undefined}
          />
        ))}
      </div>
    </div>
  );
}
