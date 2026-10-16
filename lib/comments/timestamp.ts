/**
 * Momento del vídeo de un comentario: lectura, validación contra la duración de la obra y
 * nomenclatura según la sección (cortometraje o película). Lógica pura, usada en cliente y servidor.
 */

export type WorkType = "cortometraje" | "pelicula";

const WORK_NOUNS: Record<WorkType, { readonly name: string; readonly del: string }> = {
  cortometraje: { name: "cortometraje", del: "del cortometraje" },
  pelicula: { name: "película", del: "de la película" },
};

export function workNoun(type: WorkType): { readonly name: string; readonly del: string } {
  return WORK_NOUNS[type];
}

const PART = /^\d{1,3}$/;

/**
 * «m:ss» o «h:mm:ss» → segundos. `null` si el formato no es válido: sin números o con
 * segundos (y minutos, si hay horas) fuera de 0–59.
 */
export function parseTimestampInput(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || !parts.every((part) => PART.test(part))) return null;
  const numbers = parts.map(Number);
  const seconds = numbers[numbers.length - 1]!;
  if (seconds > 59) return null;
  if (numbers.length === 3) {
    const [hours, minutes] = numbers as [number, number, number];
    return minutes > 59 ? null : hours * 3600 + minutes * 60 + seconds;
  }
  return numbers[0]! * 60 + seconds;
}

/** «1h 02m 03s», «4m 30s», «58s»… → segundos. `null` si no se reconoce (p. ej. «Corto») o es 0. */
export function parseRuntimeSeconds(runtime: string | null | undefined): number | null {
  if (!runtime) return null;
  const unit = (letter: string) => Number(new RegExp(String.raw`(\d+)\s*${letter}\b`, "i").exec(runtime)?.[1] ?? 0);
  const total = unit("h") * 3600 + unit("m") * 60 + unit("s");
  return total > 0 ? total : null;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export type TimestampValidation =
  | { readonly ok: true; readonly seconds: number | null }
  | { readonly ok: false; readonly reason: "format" }
  | { readonly ok: false; readonly reason: "beyond"; readonly maxSeconds: number };

/**
 * Valida lo escrito. El campo vacío es válido (el momento es opcional). Si se conoce la duración
 * de la obra, el momento no puede pasarse de ella.
 */
export function validateTimestamp(value: string, durationSeconds: number | null): TimestampValidation {
  if (value.trim() === "") return { ok: true, seconds: null };
  const seconds = parseTimestampInput(value);
  if (seconds === null) return { ok: false, reason: "format" };
  if (durationSeconds !== null && seconds > durationSeconds) {
    return { ok: false, reason: "beyond", maxSeconds: durationSeconds };
  }
  return { ok: true, seconds };
}
