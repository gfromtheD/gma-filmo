import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatExtraDuration } from "@/lib/extras/extras";
import type { MovieExtra } from "@/types/catalog";

interface TitleMediaRow {
  readonly asset_id: string;
  readonly role: string;
  readonly position: number;
  readonly gma_media_assets: { readonly state: string; readonly duration_seconds: number | null } | null;
}

const EXTRA_ROLES = ["trailer", "extras", "extra_image"] as const;
const ROLE_RANK: Record<string, number> = { trailer: 0, extras: 1, extra_image: 2 };

/**
 * Convierte lo que el motor guarda de un título (tráiler, extras en vídeo y extras en imagen, ya listos) en extras de la ficha.
 * El tráiler va primero. Las imágenes salen de `/api/media/<id>` (caché pública); los vídeos se reproducen bajo demanda por HLS
 * desde el VPS (`managedEndpoint`), así que solo cuestan ancho de banda cuando alguien los abre.
 * Los ids son negativos y estables dentro de la lista para no chocar con los de `pelicula_extras`.
 */
export function mapEngineExtras(slug: string, rows: readonly TitleMediaRow[]): MovieExtra[] {
  const ready = rows
    .filter((r) => (EXTRA_ROLES as readonly string[]).includes(r.role) && r.gma_media_assets?.state === "ready")
    .sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.position - b.position);
  let extraNumber = 0;
  let imageNumber = 0;
  return ready.map((row, index): MovieExtra => {
    const id = -(index + 1);
    if (row.role === "extra_image") {
      imageNumber += 1;
      const url = `/api/media/${row.asset_id}`;
      return { id, title: `Imagen ${imageNumber}`, description: null, kind: "galeria", kindLabel: "Galería", videoUrl: url,
        mediaType: "image", posterUrl: url, durationLabel: null };
    }
    const isTrailer = row.role === "trailer";
    if (!isTrailer) extraNumber += 1;
    return { id, title: isTrailer ? "Tráiler" : `Extra ${extraNumber}`, description: null, kind: isTrailer ? "trailer" : "otro",
      kindLabel: isTrailer ? "Tráiler" : "Extra", videoUrl: "", mediaType: "video", posterUrl: null,
      durationLabel: formatExtraDuration(row.gma_media_assets?.duration_seconds), managedEndpoint: `/api/titles/${encodeURIComponent(slug)}/media/${row.asset_id}/playback` };
  });
}

/** Extras del motor de un título publicado. Nunca lanza: ante cualquier fallo devuelve [] y la ficha sigue funcionando. */
export async function fetchEngineExtras(titleId: number, slug: string): Promise<MovieExtra[]> {
  try {
    const { data, error } = await (getSupabaseAdminClient() as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: number) => { order: (c: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }> } } };
    }).from("gma_title_media").select("asset_id, role, position, gma_media_assets(state, duration_seconds)").eq("title_id", titleId).order("position");
    if (error || !Array.isArray(data)) {
      if (error) console.error("[extras] engine read error:", error.message);
      return [];
    }
    return mapEngineExtras(slug, data as TitleMediaRow[]);
  } catch (error) {
    console.error("[extras] engine unexpected error:", error);
    return [];
  }
}

export const getEngineExtras = unstable_cache(fetchEngineExtras, ["engine-extras-by-title"], { revalidate: 3600, tags: ["extras", "peliculas"] });
