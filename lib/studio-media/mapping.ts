/**
 * Traducción entre el borrador de Mi Estudio (Windows, `lib/studio/upload-draft.ts`) y el motor multimedia (Mac).
 * Módulo puro, sin red ni navegador: lo usan el adaptador `mediaEngine` y sus pruebas.
 *
 * Reglas (ver docs/handoff/INTEGRACION-MOTOR-REGISTRO.md, «Mapeo de huecos»):
 *  video → main · trailer → trailer · poster → poster_v · banner → poster_h · extra:N (vídeo) → extras
 *  srt:N → subtitles con el idioma de ese SRT · extra:N de imagen → NO soportado (decisión de producto pendiente).
 */
import type { AssetRole } from '@/types/media-engine';
import { UPLOAD_LIMITS, durationLimit } from '@/lib/uploads/policy';
import { CREATOR_GENRES } from '@/lib/genres';
import type { UploadDraft } from '@/lib/studio/upload-draft';
import { FICHA_SCHEMA_VERSION, type Ficha } from '@/lib/media/ficha';

export type SlotMapping =
  | { readonly supported: true; readonly role: AssetRole; readonly language?: string }
  | { readonly supported: false; readonly reason: string };

export function mapSlot(draft: UploadDraft, slot: string): SlotMapping {
  if (slot === 'video') return { supported: true, role: 'main' };
  if (slot === 'trailer') return { supported: true, role: 'trailer' };
  if (slot === 'poster') return { supported: true, role: 'poster_v' };
  if (slot === 'banner') return { supported: true, role: 'poster_h' };
  const extra = /^extra:(\d+)$/.exec(slot);
  if (extra) {
    const item = draft.extras[Number(extra[1])];
    if (!item) return { supported: false, reason: 'El extra no existe en el borrador.' };
    return item.kind === 'video'
      ? { supported: true, role: 'extras' }
      : { supported: false, reason: 'Los extras de imagen todavía no se pueden alojar en el motor.' };
  }
  const srt = /^srt:(\d+)$/.exec(slot);
  if (srt) {
    const item = draft.srtSubtitles[Number(srt[1])];
    if (!item?.language) return { supported: false, reason: 'Elige el idioma del subtítulo antes de subirlo.' };
    const sameLanguage = draft.srtSubtitles.filter(s => s.language === item.language).length;
    if (sameLanguage > 1) return { supported: false, reason: 'Solo se admite un subtítulo por idioma.' };
    return { supported: true, role: 'subtitles', language: item.language };
  }
  return { supported: false, reason: 'Este archivo no se puede subir al motor.' };
}

/** Problema con el límite real del servidor (más estricto que la pasarela en tráiler y extras). `null` si cabe. */
export function serverLimitProblem(role: AssetRole, sizeBytes: number): string | null {
  const max = UPLOAD_LIMITS[role];
  if (sizeBytes > max) {
    const gb = max >= 1024 ** 3;
    return `El archivo supera el límite del servidor (${gb ? `${max / 1024 ** 3} GB` : `${Math.round(max / 1024 ** 2)} MB`}).`;
  }
  return null;
}

/** Duración máxima en segundos que el servidor acepta para ese rol (0 = sin límite de duración, no es vídeo). */
export const serverDurationLimit = (role: AssetRole): number => durationLimit(role);

/** Los 5 campos que el borrador del motor admite hoy (`metadataSchema`). El resto va a la ficha. */
export interface EngineMetadata { title: string; synopsis: string | null; year?: string; genre?: string; language?: string }

export function engineMetadata(draft: UploadDraft, languageLabel: (code: string) => string = c => c): EngineMetadata {
  const known = CREATOR_GENRES.map(g => g.label as string);
  const genre = [...draft.genres, ...draft.categories].find(g => known.includes(g));
  const year = draft.releaseYear ? String(draft.releaseYear) : '';
  return {
    title: draft.title.trim().slice(0, 160),
    synopsis: (draft.synopsisLong.trim() || draft.synopsisShort.trim() || null),
    ...(/^\d{4}$/.test(year) ? { year } : {}),
    ...(genre ? { genre } : {}),
    ...(draft.language ? { language: languageLabel(draft.language).slice(0, 80) } : {}),
  };
}

/** Ficha completa (todo lo que no es archivo). `mediaIdForSlot` devuelve el medio ya subido de un hueco, si existe. */
export function fichaFromDraft(draft: UploadDraft, mediaIdForSlot: (slot: string) => string | null = () => null): { schemaVersion: number; ficha: Ficha } {
  return {
    schemaVersion: FICHA_SCHEMA_VERSION,
    ficha: {
      originalTitle: draft.originalTitle,
      durationMinutes: draft.durationMinutes,
      productionCountry: draft.productionCountry,
      releaseYear: draft.releaseYear,
      categories: [...draft.categories],
      ageRating: draft.ageRating,
      firstFilm: draft.firstFilm,
      language: draft.language,
      synopsisShort: draft.synopsisShort,
      synopsisLong: draft.synopsisLong,
      genres: [...draft.genres],
      themes: [...draft.themes],
      team: draft.team.map(m => ({ name: m.name, role: m.role })),
      awards: draft.awards.map(a => ({ festival: a.festival, award: a.award })),
      ai: { used: draft.ai.used, note: draft.ai.note },
      allowComments: draft.allowComments,
      subtitleLanguages: draft.srtSubtitles.map(s => s.language).filter(Boolean),
      extras: draft.extras.map((e, i) => ({ kind: e.kind, mediaId: mediaIdForSlot(`extra:${i}`) })),
      acceptedTerms: draft.acceptedTerms,
    },
  };
}
