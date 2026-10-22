import type { PlaybackReference } from "./playback";

export interface ArtistCredit {
  readonly name: string;
  readonly role: string;
  readonly photoUrl: string | null;
  readonly slug?: string | null;
}

export type MotifName =
  | "belt" | "splatter" | "vault" | "monogram" | "cipher"
  | "ring" | "mic" | "tag" | "lightning" | "cap" | "cloud"
  | "frost" | "cross" | "crown" | "rotor" | "crest" | "gun"
  | "tire" | "web" | "arrow" | "jump" | "pen" | "sun" | "paper";

export interface PosterStyle {
  readonly tone: readonly [string, string];
  readonly accent: string;
  readonly motif: MotifName;
}

interface MediaBase {
  readonly id: string;
  readonly numericId: number;
  readonly title: string;
  readonly year: number;
  readonly rating: string;
  readonly categories: readonly string[];
  readonly synopsis: string;
  /** Sinopsis larga de la tarjeta «Sinopsis»; si falta, se usa `synopsis`. */
  readonly fullSynopsis?: string;
  readonly tagline?: string;
  readonly style: PosterStyle;
  readonly imageUrl?: string;
  readonly videoUrl?: string;
  readonly r2VideoUrl?: string;
  /** Tráiler opcional (mp4). Si existe, el hero de portada lo reproduce tras unos segundos. */
  readonly trailerUrl?: string;
  readonly playbackKind?: 'legacy' | 'stream' | 'r2_hls' | 'media';
  readonly playbackRef?: PlaybackReference;
  readonly subtitleUrl?: string;
  readonly tags?: readonly string[];
  readonly tag?: string;
  readonly progress?: number;
  readonly author?: string;
  readonly artistas?: readonly ArtistCredit[];
  readonly genre?: string;
  /** Nota media de la gente (0–10) y nº de votos; solo existe si el título ya tiene valoraciones. */
  readonly communityScore?: { readonly average: number; readonly votes: number };
  /** Idioma original del audio, si se conoce. */
  readonly language?: string;
}

export interface SeriesMedia extends MediaBase {
  readonly kind: "series";
  readonly seasons: number;
}

export interface MovieMedia extends MediaBase {
  readonly kind: "movie";
  readonly runtime: string;
  readonly approvalScore?: number;
}

export type MediaItem = SeriesMedia | MovieMedia;

export type PosterRatio = "portrait" | "landscape" | "square";

export interface Category {
  readonly id: string;
  readonly label: string;
}

export interface Episode {
  readonly n: number;
  readonly title: string;
  readonly runtime: string;
  readonly synopsis: string;
}

export interface ProfileEntry {
  readonly id: string;
  readonly name: string;
}

/** Contenido extra de un título (making of, entrevistas, escenas eliminadas…). */
export interface MovieExtra {
  readonly id: number;
  readonly title: string;
  readonly description: string | null;
  readonly kind: string;
  readonly kindLabel: string;
  /** URL del archivo: vídeo o imagen según `mediaType`. */
  readonly videoUrl: string;
  readonly mediaType: "video" | "image";
  readonly posterUrl: string | null;
  readonly durationLabel: string | null;
  /** Vídeo alojado por el motor (HLS en el VPS): se reproduce pidiendo su fuente a este endpoint en vez de usar `videoUrl`. */
  readonly managedEndpoint?: string;
}
