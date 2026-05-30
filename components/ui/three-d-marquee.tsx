"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface ThreeDMarqueeProps {
  images?: string[];
  className?: string;
  columns?: number;
}

const GMA_POSTERS = [
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/opium/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/la-nieve-que-mata/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/siul-a-fun-fan-animation/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ventisca-negra/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/shefish/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/yasha-gozen/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/medianoche/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/fe-faith/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/limbo/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/el-ultimo-futuro/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/cazando-perros/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/ojos/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/dualidad/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/e-toro/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/impulso/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/hijo-natural/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/space-tourism/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/mal-viaje/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/solio/poster.jpg",
  "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/peliculas/todavia-esperamos/poster.jpg",
];

const COL_DURATIONS = [38, 52, 43, 48, 41];

function MarqueeColumn({ images, direction, duration }: {
  images: string[];
  direction: "up" | "down";
  duration: number;
}) {
  const animation = direction === "up"
    ? `marqueeUp ${duration}s linear infinite`
    : `marqueeDown ${duration}s linear infinite`;

  return (
    <div
      className="flex flex-col items-start gap-5"
      style={{ animation, willChange: "transform" }}
    >
      {[...images, ...images].map((src, i) => (
        <div key={i} className="relative shrink-0 w-full">
          <Image
            src={src}
            alt=""
            width={640}
            height={360}
            draggable={false}
            className="aspect-video w-full rounded-lg object-cover select-none"
          />
        </div>
      ))}
    </div>
  );
}

export function ThreeDMarquee({ images = GMA_POSTERS, className, columns = 3 }: ThreeDMarqueeProps) {
  const chunkSize = Math.ceil(images.length / columns);
  const chunks = Array.from({ length: columns }, (_, i) =>
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
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
            className="relative top-0 left-[35%] grid size-full origin-top-left gap-5"
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
