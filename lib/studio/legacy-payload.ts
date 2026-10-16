import { CREATOR_GENRES } from "@/lib/genres";
import { languageName } from "@/lib/studio/geo";
import type { UploadDraft } from "@/lib/studio/upload-draft";

/** Lo que admite hoy `POST /api/titles`. */
export interface LegacyTitlePayload {
  readonly title: string;
  readonly synopsis?: string;
  readonly year?: string;
  readonly duration?: string;
  readonly genre?: string;
  readonly language?: string;
  readonly r2VideoUrl: string;
  readonly r2PosterUrl?: string;
  readonly r2SubtitleUrl?: string;
}

const capitalize = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : text);

/** El género que el servidor actual reconoce: el primero de géneros o categorías que esté en su lista. */
function recognizedGenre(draft: UploadDraft): string | undefined {
  const known = CREATOR_GENRES.map((g) => g.label as string);
  return [...draft.genres, ...draft.categories].find((g) => known.includes(g));
}

const doneUrl = (asset: { readonly url: string | null; readonly status: string } | null | undefined) =>
  asset?.status === "done" && asset.url && !asset.url.startsWith("blob:") ? asset.url : undefined;

/**
 * Traduce el borrador al formato que entiende el servidor actual. Devuelve `null` si todavía no hay un vídeo alojado
 * (un archivo que solo se ha comprobado en local no se puede publicar con este servidor).
 */
export function buildLegacyTitlePayload(draft: UploadDraft): LegacyTitlePayload | null {
  const videoUrl = doneUrl(draft.video.file);
  if (!videoUrl) return null;
  const year = draft.releaseYear ? String(draft.releaseYear) : "";
  return {
    title: draft.title.trim(),
    synopsis: draft.synopsisLong.trim() || draft.synopsisShort.trim() || undefined,
    year: /^\d{4}$/.test(year) ? year : undefined,
    duration: draft.durationMinutes ? `${draft.durationMinutes} min` : undefined,
    genre: recognizedGenre(draft),
    language: draft.language ? capitalize(languageName(draft.language)) : undefined,
    r2VideoUrl: videoUrl,
    r2PosterUrl: doneUrl(draft.images.poster) ?? doneUrl(draft.images.banner),
    r2SubtitleUrl: draft.srtSubtitles.map((s) => doneUrl(s.file)).find(Boolean),
  };
}
