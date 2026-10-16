import { IMAGE_MIME_TYPES, LIMITS } from "@/lib/studio/catalogs";

/** Tipos de archivo que se piden en la subida. */
export type FileRuleKind = "video" | "image" | "subtitle";

export interface FileLike {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

/** Peso máximo de un vídeo subido directamente. */
export const VIDEO_MAX_BYTES = 4 * 1024 ** 3;
/** Peso máximo de un archivo de subtítulos. */
export const SUBTITLE_MAX_BYTES = 5 * 1024 * 1024;

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "avi", "webm", "m4v", "mpg", "mpeg", "mxf", "wmv"];

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** Devuelve el motivo por el que el archivo no vale, o `null` si es correcto. */
export function validateFile(kind: FileRuleKind, file: FileLike): string | null {
  if (file.size <= 0) return "El archivo está vacío.";
  switch (kind) {
    case "video": {
      const isVideo = file.type.startsWith("video/") || (file.type === "" && VIDEO_EXTENSIONS.includes(extensionOf(file.name)));
      if (!isVideo) return "Tiene que ser un archivo de vídeo.";
      return file.size > VIDEO_MAX_BYTES ? "El vídeo supera el límite de 4 GB." : null;
    }
    case "image": {
      if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return "Solo se admiten imágenes JPG, PNG o GIF.";
      return file.size > LIMITS.imageBytes ? "La imagen supera el límite de 10 MB." : null;
    }
    case "subtitle": {
      if (extensionOf(file.name) !== "srt") return "Los subtítulos tienen que ser un archivo .srt.";
      return file.size > SUBTITLE_MAX_BYTES ? "El archivo de subtítulos supera el límite de 5 MB." : null;
    }
  }
}

export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/** Consejo (no bloquea) si una imagen no tiene la proporción o el tamaño sugeridos. */
export function imageSizeAdvice(actual: PixelSize, suggested: PixelSize): string | null {
  const wanted = `${suggested.width} × ${suggested.height} px`;
  const ratio = actual.width / actual.height;
  const wantedRatio = suggested.width / suggested.height;
  if (Math.abs(ratio - wantedRatio) / wantedRatio > 0.08) {
    return `La proporción es distinta de la sugerida (${wanted}); se recortará para encajar.`;
  }
  if (actual.width < suggested.width || actual.height < suggested.height) {
    return `Es más pequeña que la medida sugerida (${wanted}) y puede verse borrosa.`;
  }
  return null;
}
