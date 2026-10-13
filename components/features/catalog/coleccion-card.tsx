import Link from "next/link";
import { GmaIcon } from "@/components/ui/gma-icon";
import type { Coleccion } from "@/lib/supabase/queries";

const COLECCION_NAME_OVERRIDES: Record<string, string> = {
  "la-pelicula": "Películas",
};

export function ColeccionCard({ col, filmCount }: { col: Coleccion; filmCount: number }) {
  const displayName = COLECCION_NAME_OVERRIDES[col.slug] ?? col.name;
  return (
    <Link
      href={`/cortos/coleccion/${col.slug}`}
      className="group relative block aspect-video overflow-hidden rounded-xl"
    >
      {/* Cover image or gradient fallback */}
      {col.r2_cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={col.r2_cover_url}
          alt={displayName}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0a1a10 0%, #1a3a28 50%, #0d2018 100%)",
          }}
        />
      )}

      {/* Permanent gradient overlay for legibility */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Hover tint */}
      <div className="pointer-events-none absolute inset-0 bg-[#22B16B]/0 transition-colors duration-300 group-hover:bg-[#22B16B]/10" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22B16B]">
              Colección
            </p>
            <h3 className="mt-0.5 text-[18px] font-extrabold leading-tight text-white">
              {displayName}
            </h3>
            {filmCount > 0 && (
              <p className="mt-1 text-[12px] text-[#8A9AAE]">
                {filmCount}{" "}
                {col.slug === "la-pelicula"
                  ? filmCount === 1 ? "film" : "films"
                  : filmCount === 1 ? "corto" : "cortos"}
              </p>
            )}
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 group-hover:bg-[#22B16B] group-hover:text-gma-accent-fg">
            <GmaIcon name="chevronRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
