/**
 * Presentación de los comentarios (inspirada en lo que hace bien YouTube): contadores abreviados,
 * nombres accesibles descriptivos, orden «Destacados» / «Más recientes», momentos del texto que
 * llevan al minuto y enlaces permanentes a un comentario. Lógica pura, sin React ni red.
 */

import { parseTimestampInput } from "@/lib/comments/timestamp";

// ── Contadores ───────────────────────────────────────────────────────────────

function trimmedDecimal(value: number): string {
  const rounded = Math.floor(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

/** 999 → «999», 1 900 → «1,9 K», 12 345 → «12 K», 1 100 000 → «1,1 M». */
export function formatCompactCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  const n = Math.floor(count);
  if (n < 1000) return String(n);
  if (n < 10_000) return `${trimmedDecimal(n / 1000)} K`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)} K`;
  if (n < 10_000_000) return `${trimmedDecimal(n / 1_000_000)} M`;
  return `${Math.floor(n / 1_000_000)} M`;
}

/** Nombre accesible del botón «de acuerdo»: dice qué hace y cuántas personas más lo han marcado. */
export function likeButtonLabel(input: { readonly count: number; readonly isReply: boolean; readonly liked: boolean }): string {
  const target = input.isReply ? "esta respuesta" : "este comentario";
  if (input.liked) return `Quitar tu «me gusta» de ${target}`;
  const base = `Indica que te gusta ${target}`;
  if (input.count <= 0) return base;
  if (input.count === 1) return `${base} junto con otra persona`;
  return `${base} junto con otras ${formatCompactCount(input.count)} personas`;
}

// ── Orden ────────────────────────────────────────────────────────────────────

export type CommentSort = "top" | "recent";

interface Sortable {
  readonly like_count: number;
  readonly created_at: string;
  readonly pinned_at?: string | null;
}

const time = (iso: string) => new Date(iso).getTime();

/**
 * «Destacados» (más «me gusta» y, a igualdad, el más reciente) o «Más recientes». Un comentario fijado
 * por el creador va siempre primero. Devuelve una copia.
 */
export function sortThreads<T extends Sortable>(threads: readonly T[], mode: CommentSort): T[] {
  return [...threads].sort((a, b) => {
    const pinned = Number(Boolean(b.pinned_at)) - Number(Boolean(a.pinned_at));
    if (pinned !== 0) return pinned;
    if (mode === "recent") return time(b.created_at) - time(a.created_at);
    return b.like_count - a.like_count || time(b.created_at) - time(a.created_at);
  });
}

// ── Momentos dentro del texto ────────────────────────────────────────────────

export type TextSegment =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "time"; readonly value: string; readonly seconds: number };

// «m:ss» o «h:mm:ss» aislado: sin dígitos, letras ni puntos pegados por ningún lado.
const TIME_IN_TEXT = /(?<![\w.:])(\d{1,3}:\d{2}(?::\d{2})?)(?![\w.:])/g;

/**
 * Parte un comentario en trozos de texto y momentos («10:32») válidos. Un momento solo se convierte en
 * enlace si es válido y, cuando se conoce la duración de la obra, no se pasa de ella.
 */
export function splitTimestamps(text: string, durationSeconds: number | null): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TIME_IN_TEXT)) {
    const value = match[1]!;
    const seconds = parseTimestampInput(value);
    if (seconds === null || (durationSeconds !== null && seconds > durationSeconds)) continue;
    const start = match.index!;
    if (start > cursor) segments.push({ type: "text", value: text.slice(cursor, start) });
    segments.push({ type: "time", value, seconds });
    cursor = start + value.length;
  }
  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}

// ── Enlace permanente ────────────────────────────────────────────────────────

export function commentAnchorId(commentId: number): string {
  return `comentario-${commentId}`;
}

/** «#comentario-42» → 42; cualquier otra cosa → `null`. */
export function parseCommentHash(hash: string): number | null {
  const match = /^#?comentario-(\d+)$/.exec(hash);
  const id = match ? Number(match[1]) : 0;
  return id > 0 ? id : null;
}

// ── Menciones al responder ───────────────────────────────────────────────────

/**
 * Solo para comentarios ANTIGUOS, que llevan «@Nombre» escrito en el texto (los nuevos guardan la referencia
 * al comentario mencionado, ver `reply_to_id`). Si el texto empieza por «@Nombre» de alguien del hilo, lo
 * separa del resto para poder resaltarlo.
 * Gana el nombre más largo («@Ana María» antes que «@Ana»); la mención debe terminar en un límite
 * (espacio, puntuación o final), no en mitad de otra palabra.
 */
export function splitLeadingMention(text: string, names: readonly string[]): { mention: string; rest: string } | null {
  if (!text.startsWith("@")) return null;
  const candidates = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    const mention = `@${name}`;
    if (!text.startsWith(mention)) continue;
    const next = text.charAt(mention.length);
    if (next === "" || /[\s.,;:!?¡¿)\]]/.test(next)) return { mention, rest: text.slice(mention.length) };
  }
  return null;
}
