import {
  DIRECTOR_ROLE, CREW_ROLES, IMAGE_SLOTS, LIMITS, type ImageSlotId,
} from "@/lib/studio/catalogs";

/**
 * Borrador de una subida: todo lo que se pide al creador, en una sola estructura serializable. Las funciones de este
 * archivo son puras (no modifican el borrador) y deciden qué falta en cada paso de la pasarela.
 */

export type UploadStepId = "video" | "ficha" | "datos";

export interface UploadStepInfo {
  readonly id: UploadStepId;
  readonly label: string;
}

export const UPLOAD_STEPS: readonly UploadStepInfo[] = [
  { id: "video", label: "Sube tu obra" },
  { id: "ficha", label: "Crea tu ficha" },
  { id: "datos", label: "Completa los detalles" },
];

/** Etapa de una subida: comprobar el archivo en el navegador, enviarlo y procesarlo en el servidor. */
export type UploadPhase = "checking" | "uploading" | "processing";

/** Un archivo del borrador: lo que se sabe de él y cómo va su subida. */
export interface UploadedAsset {
  readonly name: string;
  readonly sizeBytes: number;
  readonly url: string | null;
  readonly status: "pending" | "uploading" | "processing" | "done" | "error";
  /** Etapa en curso mientras `status` es «uploading» o «processing». Sin dato, se entiende «uploading». */
  readonly phase?: UploadPhase;
  /** Avance (0–100) de la etapa en curso, no del conjunto. */
  readonly progress?: number;
  readonly error?: string;
  /** Subido en modo local: validado, pero todavía no enviado al motor de alojamiento. */
  readonly localOnly?: boolean;
}

/** Una persona de la ficha: solo nombre y papel (sin datos de contacto; esos van en el perfil del creador). */
export interface TeamMember {
  readonly name: string;
  readonly role: string;
}

/** Un premio o selección en un festival: dato opcional y ligero de la ficha. */
export interface AwardEntry {
  readonly festival: string;
  readonly award: string;
}

/** Un vídeo subido como archivo (la película y el tráiler). */
export interface VideoSource {
  readonly file: UploadedAsset | null;
}

export type ExtraKind = "fotograma" | "poster" | "video";

/** Material extra de la ficha: fotogramas, pósters y vídeos (entrevistas, making of…). */
export interface ExtraItem {
  /** Identidad estable del hueco (`extra:<id>`): quitar otro extra no la cambia. Los borradores antiguos no la tienen. */
  readonly id?: string;
  readonly kind: ExtraKind;
  readonly file: UploadedAsset | null;
}

/** Hueco de un extra: `extra:<id>`, o `extra:<posición>` en borradores guardados antes de que los extras tuvieran id. */
export const extraSlot = (extra: ExtraItem, index: number): string => `extra:${extra.id ?? index}`;

/** Posición del extra de un hueco `extra:…` (por id, o por posición si el extra no tiene id), o -1. */
export function extraIndexOf(draft: Pick<UploadDraft, "extras">, slot: string): number {
  const key = /^extra:([\w-]+)$/.exec(slot)?.[1];
  if (!key) return -1;
  const byId = draft.extras.findIndex((e) => e.id === key);
  if (byId >= 0) return byId;
  const index = /^\d+$/.test(key) ? Number(key) : -1;
  return index >= 0 && index < draft.extras.length && !draft.extras[index]!.id ? index : -1;
}

export interface UploadDraft {
  readonly version: 7;
  readonly video: VideoSource;
  /** Tráiler: se usará en el banner del Home y en la ficha. */
  readonly trailer: VideoSource;
  readonly extras: readonly ExtraItem[];
  readonly title: string;
  readonly originalTitle: string;
  readonly durationMinutes: number | null;
  readonly productionCountry: string;
  /** Año de estreno de la obra. */
  readonly releaseYear: number | null;
  readonly categories: readonly string[];
  readonly ageRating: string;
  readonly firstFilm: boolean;
  readonly language: string;
  readonly srtSubtitles: readonly { readonly language: string; readonly file: UploadedAsset | null }[];
  readonly images: Readonly<Record<ImageSlotId, UploadedAsset | null>>;
  readonly synopsisShort: string;
  readonly synopsisLong: string;
  readonly genres: readonly string[];
  readonly themes: readonly string[];
  readonly team: readonly TeamMember[];
  readonly awards: readonly AwardEntry[];
    /** Aviso opcional de que la obra puede contener contenido creado con IA. */
  readonly ai: { readonly used: boolean; readonly note: string };
  readonly allowComments: boolean;
  readonly acceptedTerms: boolean;
}

export function emptyDraft(): UploadDraft {
  return {
    version: 7,
    video: { file: null },
    trailer: { file: null },
    extras: [],
    title: "", originalTitle: "", durationMinutes: null, productionCountry: "", releaseYear: null, categories: [], ageRating: "", firstFilm: false, language: "",
    srtSubtitles: [],
    images: { poster: null, banner: null },
    synopsisShort: "", synopsisLong: "", genres: [], themes: [],
    team: [],
    awards: [],
    ai: { used: false, note: "" },
    allowComments: true,
    acceptedTerms: false,
  };
}

export type StepStatus = "complete" | "incomplete";

export interface StepReview {
  readonly id: UploadStepId;
  readonly label: string;
  readonly status: StepStatus;
  /** Lo que falta o está mal, en lenguaje claro. */
  readonly missing: readonly string[];
}

const filled = (text: string) => text.trim().length > 0;

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Una imagen o archivo cuenta solo si ya está subido sin errores. */
const isDone = (asset: UploadedAsset | null | undefined): asset is UploadedAsset => asset?.status === "done";

function assetProblems(label: string, asset: UploadedAsset | null | undefined): string[] {
  if (!asset) return [];
  if (asset.status === "error") return [`${label}: ${asset.error ?? "no se pudo subir"}`];
  if (asset.status === "processing") return [`${label}: aún se está procesando`];
  if (asset.status !== "done") return [`${label}: aún se está subiendo`];
  return [];
}

function reviewVideo(d: UploadDraft): string[] {
  if (!d.video.file) return ["El vídeo de la obra"];
  return isDone(d.video.file) ? [] : assetProblems("Vídeo", d.video.file);
}

/** El tráiler y los extras son opcionales, pero lo que se añade tiene que estar bien. */
function reviewAwards(d: UploadDraft): string[] {
  return d.awards.flatMap((a, i) => [
    ...(filled(a.festival) ? [] : [`Premio o selección ${i + 1}: el festival`]),
    ...(a.festival.trim().length > LIMITS.awardChars ? [`Premio o selección ${i + 1}: el festival es demasiado largo (máximo ${LIMITS.awardChars} caracteres)`] : []),
    ...(a.award.trim().length > LIMITS.awardChars ? [`Premio o selección ${i + 1}: el premio es demasiado largo (máximo ${LIMITS.awardChars} caracteres)`] : []),
  ]);
}

function reviewExtras(d: UploadDraft): string[] {
  const missing: string[] = [];
  missing.push(...assetProblems("Tráiler", d.trailer.file));
  for (const [i, extra] of d.extras.entries()) {
    if (!extra.file) missing.push(`Extra ${i + 1}: el archivo`);
    else missing.push(...assetProblems(`Extra ${i + 1}`, extra.file));
  }
  return missing;
}

/** Lo creativo de la ficha: imágenes, título, sinopsis, tráiler y extras. */
function reviewFicha(d: UploadDraft): string[] {
  const missing: string[] = [];
  if (!filled(d.title)) missing.push("Título");
  if (!filled(d.synopsisShort)) missing.push("Sinopsis corta");
  else if (d.synopsisShort.length > LIMITS.shortSynopsisChars) missing.push(`Sinopsis corta de ${LIMITS.shortSynopsisChars} caracteres como máximo`);
  if (!filled(d.synopsisLong)) missing.push("Sinopsis larga");
  else if (d.synopsisLong.length > LIMITS.longSynopsisChars) missing.push(`Sinopsis larga de ${LIMITS.longSynopsisChars} caracteres como máximo`);
  if (d.originalTitle.trim().length > LIMITS.originalTitleChars) {
    missing.push(`Título original de ${LIMITS.originalTitleChars} caracteres como máximo (tienes ${d.originalTitle.trim().length})`);
  }
  for (const slot of IMAGE_SLOTS) {
    const asset = d.images[slot.id];
    if (asset) missing.push(...assetProblems(slot.label, asset));
    else if (slot.required) missing.push(slot.label);
  }
  missing.push(...reviewExtras(d));
  return missing;
}

/** Datos a elegir: técnicos, idioma y subtítulos, reparto y equipo, y premios. */
function reviewData(d: UploadDraft): string[] {
  const missing: string[] = [...reviewTeam(d), ...reviewAwards(d)];
  if (d.ai.used && d.ai.note.trim().length > LIMITS.aiNoteChars) missing.push(`Nota sobre la IA de ${LIMITS.aiNoteChars} caracteres como máximo`);
  if (!d.durationMinutes || d.durationMinutes <= 0) missing.push("Duración");
  if (!d.releaseYear) missing.push("Año de estreno");
  else if (d.releaseYear < LIMITS.firstYear || d.releaseYear > new Date().getFullYear()) missing.push("Un año de estreno válido");
  if (d.categories.length === 0) missing.push("Categoría");
  if (!d.language) missing.push("Idioma original");
  if (d.srtSubtitles.length > LIMITS.srtFiles) missing.push(`Como mucho ${LIMITS.srtFiles} archivos SRT`);
  for (const [i, srt] of d.srtSubtitles.entries()) {
    if (!srt.language) missing.push(`Idioma del SRT ${i + 1}`);
    if (!srt.file) missing.push(`Archivo del SRT ${i + 1}`);
    else missing.push(...assetProblems(`SRT ${i + 1}`, srt.file));
  }
  return missing;
}

function reviewTeam(d: UploadDraft): string[] {
  const missing: string[] = [];
  if (!d.team.some((m) => m.role === DIRECTOR_ROLE && filled(m.name))) missing.push("Al menos un director/a");
  for (const [i, m] of d.team.entries()) {
    if (!filled(m.name)) missing.push(`Persona ${i + 1}: el nombre`);
    else if (!CREW_ROLES.includes(m.role)) missing.push(`${m.name}: su papel`);
    if (m.name.trim().length > LIMITS.teamNameChars) missing.push(`Persona ${i + 1}: el nombre es demasiado largo (máximo ${LIMITS.teamNameChars} caracteres)`);
  }
  return missing;
}

/** Qué falta en cada paso y cómo queda su estado. */
export function reviewDraft(draft: UploadDraft): StepReview[] {
  const reviewers: Record<UploadStepId, (d: UploadDraft) => string[]> = { video: reviewVideo, ficha: reviewFicha, datos: reviewData };
  return UPLOAD_STEPS.map((info) => {
    const missing = reviewers[info.id](draft);
    const status: StepStatus = missing.length > 0 ? "incomplete" : "complete";
    return { id: info.id, label: info.label, status, missing };
  });
}

export function isReadyToSubmit(draft: UploadDraft): boolean {
  return draft.acceptedTerms && reviewDraft(draft).every((s) => s.status === "complete");
}

// ── Huecos de archivo ────────────────────────────────────────────────────────────────────────

/**
 * Un hueco identifica dónde va un archivo dentro del borrador:
 * `video`, `trailer`, un id de imagen (`poster`, `banner`), `extra:<id>` (ver `extraSlot`) o `srt:<n>`.
 */
export function getAsset(draft: UploadDraft, slot: string): UploadedAsset | null {
  if (slot === "video") return draft.video.file;
  if (slot === "trailer") return draft.trailer.file;
  if (slot.startsWith("extra:")) return draft.extras[extraIndexOf(draft, slot)]?.file ?? null;
  if (slot in draft.images) return draft.images[slot as ImageSlotId];
  const srt = slot.match(/^srt:(\d+)$/);
  if (srt) return draft.srtSubtitles[Number(srt[1])]?.file ?? null;
  return null;
}

/** Devuelve un borrador nuevo con el archivo colocado (o quitado, con `null`) en su hueco. */
export function setAsset(draft: UploadDraft, slot: string, asset: UploadedAsset | null): UploadDraft {
  if (slot === "video") {
    return { ...draft, video: { file: asset } };
  }
  if (slot === "trailer") {
    return { ...draft, trailer: { file: asset } };
  }
  if (slot.startsWith("extra:")) {
    const index = extraIndexOf(draft, slot);
    return { ...draft, extras: draft.extras.map((e, i) => (i === index ? { ...e, file: asset } : e)) };
  }
  if (slot in draft.images) return { ...draft, images: { ...draft.images, [slot]: asset } };
  const srt = slot.match(/^srt:(\d+)$/);
  if (srt) {
    const index = Number(srt[1]);
    const list = draft.srtSubtitles.map((s, i) => (i === index ? { ...s, file: asset } : s));
    return { ...draft, srtSubtitles: list };
  }
  return draft;
}
