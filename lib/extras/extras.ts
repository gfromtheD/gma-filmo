import { z } from "zod";
import type { MovieExtra } from "@/types/catalog";

/**
 * Lógica pura de los «Extras» de un título. Independiente del proveedor de medios:
 * `provider` y `media_ref` permiten migrar de R2 a Stream/PeerTube sin tocar la interfaz.
 */

export const EXTRA_KINDS = [
  "making_of",
  "entrevista",
  "escena_eliminada",
  "detras_camaras",
  "musica",
  "galeria",
  "otro",
] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

export const EXTRA_PROVIDERS = ["r2", "stream", "peertube", "external"] as const;
export const EXTRA_TITLE_MAX = 120;
export const EXTRA_DESCRIPTION_MAX = 500;

const KIND_LABELS: Record<ExtraKind, string> = {
  making_of: "Making of",
  entrevista: "Entrevista",
  escena_eliminada: "Escena eliminada",
  detras_camaras: "Detrás de cámaras",
  musica: "Música",
  galeria: "Galería",
  otro: "Extra",
};

const FALLBACK_LABEL = "Extra";

/** Fila de `pelicula_extras` tal y como la devuelve Supabase. */
export interface ExtraRow {
  readonly id: number;
  readonly pelicula_id: number;
  readonly title: string;
  readonly description: string | null;
  readonly kind: string;
  readonly provider: string;
  readonly video_url: string;
  readonly media_ref: string | null;
  readonly poster_url: string | null;
  readonly duration_seconds: number | null;
  readonly file_size_bytes: number | null;
  readonly sort_order: number;
  readonly status: string;
}

export function isExtraKind(value: string): value is ExtraKind {
  return (EXTRA_KINDS as readonly string[]).includes(value);
}

export function extraKindLabel(kind: string): string {
  return isExtraKind(kind) ? KIND_LABELS[kind] : FALLBACK_LABEL;
}

/** `m:ss` o `h:mm:ss`; `null` cuando no hay una duración válida. */
export function formatExtraDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Fila → extra de interfaz. `null` si no está publicado o la URL no es https. */
export function rowToExtra(row: ExtraRow): MovieExtra | null {
  if (row.status !== "published" || !isHttpsUrl(row.video_url)) return null;
  const description = row.description?.trim() ?? "";
  return {
    id: row.id,
    title: row.title.trim(),
    description: description || null,
    kind: row.kind,
    kindLabel: extraKindLabel(row.kind),
    videoUrl: row.video_url,
    posterUrl: row.poster_url && isHttpsUrl(row.poster_url) ? row.poster_url : null,
    durationLabel: formatExtraDuration(row.duration_seconds),
  };
}

export function sortExtras<T extends { readonly id: number; readonly sort_order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export interface ExtraKindGroup {
  readonly kind: string;
  readonly label: string;
  readonly count: number;
}

/** Tipos presentes (orden estable del catálogo de tipos) con su recuento, para los filtros. */
export function groupExtraKinds(extras: readonly MovieExtra[]): ExtraKindGroup[] {
  const counts = new Map<string, number>();
  for (const extra of extras) counts.set(extra.kind, (counts.get(extra.kind) ?? 0) + 1);
  const rank = (kind: string) => {
    const index = EXTRA_KINDS.indexOf(kind as ExtraKind);
    return index === -1 ? EXTRA_KINDS.length : index;
  };
  return [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([kind, count]) => ({ kind, label: extraKindLabel(kind), count }));
}

const httpsUrl = z.string().trim().max(2048).refine(isHttpsUrl, "Debe ser una URL https");

export const ExtraInputSchema = z.object({
  title: z.string().trim().min(1).max(EXTRA_TITLE_MAX),
  description: z.string().trim().max(EXTRA_DESCRIPTION_MAX).nullish(),
  kind: z.enum(EXTRA_KINDS),
  provider: z.enum(EXTRA_PROVIDERS).default("r2"),
  videoUrl: httpsUrl,
  mediaRef: z.string().trim().max(512).nullish(),
  posterUrl: httpsUrl.nullish(),
  durationSeconds: z.number().int().min(0).max(86_400).nullish(),
  fileSizeBytes: z.number().int().min(0).nullish(),
});
export type ExtraInput = z.infer<typeof ExtraInputSchema>;

export function parseExtraInput(input: unknown) {
  return ExtraInputSchema.safeParse(input);
}
