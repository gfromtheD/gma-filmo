import Link from "next/link";
import type { Coleccion } from "@/lib/supabase/queries";

const COLECCION_NAME_OVERRIDES: Record<string, string> = {
  "la-pelicula": "Películas",
};

/** Colores de acento (oscuros y saturados) para el velo de cada colección. */
const ACCENT_PALETTE = [
  "#1c4d5e",
  "#8a2323",
  "#0f6b5c",
  "#4a2b78",
  "#8a3b12",
  "#1f4f8f",
  "#7a1f5c",
  "#3d5a1f",
] as const;

/** Acento estable por colección: mismo slug, mismo color en todas las pantallas. */
export function accentForSlug(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length]!;
}

/** Velo en degradado que nace en el borde izquierdo con el color de acento y se funde hacia la imagen. */
function washFor(accent: string): string {
  return [
    `linear-gradient(90deg, ${accent} 0%, ${accent}b8 32%, ${accent}2e 68%, transparent 100%)`,
    "linear-gradient(transparent 42%, rgba(0,0,0,0.45) 100%)",
  ].join(", ");
}

export function ColeccionCard({ col, filmCount }: { col: Coleccion; filmCount: number }) {
  const displayName = COLECCION_NAME_OVERRIDES[col.slug] ?? col.name;
  const accent = accentForSlug(col.slug);
  return (
    <Link
      href={`/cortos/coleccion/${col.slug}`}
      className="group relative block aspect-video overflow-hidden rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#22B16B]"
      style={{ backgroundColor: accent }}
    >
      {col.r2_cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={col.r2_cover_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
      )}

      <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: washFor(accent) }} />

      <span className="absolute inset-x-3.5 bottom-3.5 min-w-0">
        <span className="block break-words text-[17px] font-bold leading-tight text-white">{displayName}</span>
        {filmCount > 0 && (
          <span className="mt-0.5 block text-[12px] text-white/70">
            {filmCount}{" "}
            {col.slug === "la-pelicula"
              ? filmCount === 1 ? "film" : "films"
              : filmCount === 1 ? "corto" : "cortos"}
          </span>
        )}
      </span>
    </Link>
  );
}
