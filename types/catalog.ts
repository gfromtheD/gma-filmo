export interface ArtistCredit {
  readonly name: string;
  readonly role: string;
  readonly photoUrl: string | null;
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
  readonly tagline?: string;
  readonly style: PosterStyle;
  readonly imageUrl?: string;
  readonly videoUrl?: string;
  readonly r2VideoUrl?: string;
  readonly tags?: readonly string[];
  readonly tag?: string;
  readonly progress?: number;
  readonly author?: string;
  readonly artistas?: readonly ArtistCredit[];
  readonly genre?: string;
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
