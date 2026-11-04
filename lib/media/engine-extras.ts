import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatExtraDuration } from "@/lib/extras/extras";
import type { MovieExtra } from "@/types/catalog";

export interface TitleMediaRow {
  readonly asset_id: string;
  readonly role: string;
  readonly position: number;
  readonly gma_media_assets: { readonly state: string; readonly duration_seconds: number | null } | null;
}

/** Lo que el creador escribió sobre un extra (tabla `gma_extra_meta`). Todo opcional: sin fila, el extra sale con sus nombres de siempre. */
export interface ExtraMeta {
  readonly assetId: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly hidden: boolean;
  readonly sortOrder: number;
}

const EXTRA_ROLES = ["trailer", "extras", "extra_image"] as const;
const ROLE_RANK: Record<string, number> = { trailer: 0, extras: 1, extra_image: 2 };

/**
 * Convierte lo que el motor guarda de un título (tráiler, extras en vídeo y extras en imagen, ya listos) en extras de la ficha.
 * El tráiler va primero. Las imágenes salen de `/api/media/<id>` (caché pública); los vídeos se reproducen bajo demanda por HLS
 * desde el VPS (`managedEndpoint`), así que solo cuestan ancho de banda cuando alguien los abre.
 * Los ids son negativos y estables dentro de la lista para no chocar con los de `pelicula_extras`.
 */
export function mapEngineExtras(slug: string, rows: readonly TitleMediaRow[], metas: readonly ExtraMeta[] = []): MovieExtra[] {
  const metaOf = new Map(metas.map((m) => [m.assetId, m]));
  const ready = rows
    .filter((r) => (EXTRA_ROLES as readonly string[]).includes(r.role) && r.gma_media_assets?.state === "ready" && !metaOf.get(r.asset_id)?.hidden)
    .sort((a, b) => compareExtraRows(a, b, metaOf));
  let extraNumber = 0;
  let imageNumber = 0;
  return ready.map((row, index): MovieExtra => {
    const id = -(index + 1);
    const meta = metaOf.get(row.asset_id);
    const described = (extra: MovieExtra): MovieExtra => ({ ...extra, title: meta?.label || extra.title, description: meta?.description || null });
    if (row.role === "extra_image") {
      imageNumber += 1;
      const url = `/api/media/${row.asset_id}`;
      return described({ id, title: `Imagen ${imageNumber}`, description: null, kind: "galeria", kindLabel: "Galería", videoUrl: url,
        mediaType: "image", posterUrl: url, durationLabel: null });
    }
    const isTrailer = row.role === "trailer";
    if (!isTrailer) extraNumber += 1;
    return described({ id, title: isTrailer ? "Tráiler" : `Extra ${extraNumber}`, description: null, kind: isTrailer ? "trailer" : "otro",
      kindLabel: isTrailer ? "Tráiler" : "Extra", videoUrl: "", mediaType: "video", posterUrl: null,
      durationLabel: formatExtraDuration(row.gma_media_assets?.duration_seconds), managedEndpoint: `/api/titles/${encodeURIComponent(slug)}/media/${row.asset_id}/playback` });
  });
}

/** El tráiler siempre va primero; el resto, por el orden que eligió el creador y, sin elegir, por tipo y posición. */
export function compareExtraRows(a: TitleMediaRow, b: TitleMediaRow, metaOf: ReadonlyMap<string, ExtraMeta>): number {
  const aTrailer = a.role === "trailer";
  const bTrailer = b.role === "trailer";
  if (aTrailer !== bTrailer) return aTrailer ? -1 : 1;
  const aMeta = metaOf.get(a.asset_id);
  const bMeta = metaOf.get(b.asset_id);
  // Lo subido después de ordenar (sin fila todavía) va detrás de lo ya ordenado: mezclar los dos criterios no da un orden estable.
  if (Boolean(aMeta) !== Boolean(bMeta)) return aMeta ? -1 : 1;
  if (aMeta && bMeta) return aMeta.sortOrder - bMeta.sortOrder;
  return (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.position - b.position;
}

/** Los extras de un título tal y como los ve su creador en Studio: todos los listos (también los ocultos), con su nombre por defecto. */
export interface ManageableExtra {
  readonly assetId: string;
  readonly role: "trailer" | "extras" | "extra_image";
  readonly label: string;
  readonly description: string;
  readonly hidden: boolean;
}

export function manageableExtras(rows: readonly TitleMediaRow[], metas: readonly ExtraMeta[]): ManageableExtra[] {
  const metaOf = new Map(metas.map((m) => [m.assetId, m]));
  const ready = rows
    .filter((r) => (EXTRA_ROLES as readonly string[]).includes(r.role) && r.gma_media_assets?.state === "ready")
    .sort((a, b) => compareExtraRows(a, b, metaOf));
  let videos = 0;
  let images = 0;
  return ready.map((row) => {
    const meta = metaOf.get(row.asset_id);
    const role = row.role as ManageableExtra["role"];
    if (role === "extra_image") images += 1;
    else if (role === "extras") videos += 1;
    const fallback = role === "trailer" ? "Tráiler" : role === "extra_image" ? `Imagen ${images}` : `Extra ${videos}`;
    return { assetId: row.asset_id, role, label: meta?.label || fallback, description: meta?.description ?? "", hidden: meta?.hidden ?? false };
  });
}

interface MetaDbRow {
  readonly asset_id: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly hidden: boolean;
  readonly sort_order: number;
}

export function toExtraMeta(row: MetaDbRow): ExtraMeta {
  return { assetId: row.asset_id, label: row.label, description: row.description, hidden: row.hidden, sortOrder: row.sort_order };
}

type Rows<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>;
type Untyped = { from: (t: string) => { select: (c: string) => { eq: (k: string, v: number) => Rows<unknown> & { order: (c: string) => Rows<unknown> } } } };

/** Filas de motor de un título y lo que su creador escribió sobre ellas. Lanza si la base falla: quien llama decide qué hacer. */
export async function readTitleExtras(titleId: number): Promise<{ rows: TitleMediaRow[]; metas: ExtraMeta[] }> {
  const db = getSupabaseAdminClient() as unknown as Untyped;
  const [media, meta] = await Promise.all([
    db.from("gma_title_media").select("asset_id, role, position, gma_media_assets(state, duration_seconds)").eq("title_id", titleId).order("position"),
    db.from("gma_extra_meta").select("asset_id, label, description, hidden, sort_order").eq("title_id", titleId),
  ]);
  if (media.error) throw new Error(media.error.message);
  // Sin la tabla de nombres (o si falla) los extras salen igualmente con sus nombres por defecto.
  if (meta.error) console.error("[extras] meta read error:", meta.error.message);
  return {
    rows: Array.isArray(media.data) ? (media.data as TitleMediaRow[]) : [],
    metas: Array.isArray(meta.data) ? (meta.data as MetaDbRow[]).map(toExtraMeta) : [],
  };
}

/** Extras del motor de un título publicado. Nunca lanza: ante cualquier fallo devuelve [] y la ficha sigue funcionando. */
export async function fetchEngineExtras(titleId: number, slug: string): Promise<MovieExtra[]> {
  try {
    const { rows, metas } = await readTitleExtras(titleId);
    return mapEngineExtras(slug, rows, metas);
  } catch (error) {
    console.error("[extras] engine read error:", error);
    return [];
  }
}

export const getEngineExtras = unstable_cache(fetchEngineExtras, ["engine-extras-by-title"], { revalidate: 3600, tags: ["extras", "peliculas"] });
