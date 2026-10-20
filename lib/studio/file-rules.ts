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

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];
const IMAGE_FORMAT_MESSAGE = "Formato no admitido. Solo se admiten imágenes JPG, PNG, WebP o AVIF (los GIF no se aceptan).";

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

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
      const isKnownType = (IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
        || (file.type === "" && IMAGE_EXTENSIONS.includes(extensionOf(file.name)));
      if (!isKnownType) return IMAGE_FORMAT_MESSAGE;
      return file.size > LIMITS.imageBytes ? `La imagen pesa ${formatMegabytes(file.size)} y el máximo es 10 MB.` : null;
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

/** Bytes que hacen falta para reconocer el formato de una imagen. */
export const IMAGE_SNIFF_BYTES = 32;

const hasAscii = (bytes: Uint8Array, offset: number, text: string) =>
  text.length + offset <= bytes.length && [...text].every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));

/** Reconoce JPG, PNG, WebP o AVIF por el contenido (el motor hace lo mismo); `null` si no es ninguno. */
export function sniffImageType(bytes: Uint8Array): (typeof IMAGE_MIME_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && hasAscii(bytes, 1, "PNG") && bytes[4] === 0x0d && bytes[5] === 0x0a) return "image/png";
  if (hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP")) return "image/webp";
  if (hasAscii(bytes, 4, "ftyp") && (hasAscii(bytes, 8, "avif") || hasAscii(bytes, 8, "avis"))) return "image/avif";
  return null;
}

/**
 * Motivo por el que una imagen no vale según lo que contiene (formato real y medidas), o `null` si vale. Lleva la medida
 * esperada en el mensaje para que se vea qué corregir.
 */
export function imageContentProblem(type: string | null, size: PixelSize | null, expected?: PixelSize): string | null {
  if (!type) return `${IMAGE_FORMAT_MESSAGE} Este archivo no es una imagen de esos tipos o está dañado.`;
  const wanted = expected ? ` Medida esperada: ${expected.width} × ${expected.height} px.` : "";
  if (!size || size.width < 1 || size.height < 1) return `No se puede leer la imagen: el archivo está dañado o no se puede abrir.${wanted}`;
  const megapixels = (size.width * size.height) / 1_000_000;
  if (size.width * size.height > LIMITS.imagePixels) {
    return `La imagen mide ${size.width} × ${size.height} px (${megapixels.toFixed(1).replace(".", ",")} megapíxeles) y el máximo es ${LIMITS.imagePixels / 1_000_000}.${wanted}`;
  }
  return null;
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
