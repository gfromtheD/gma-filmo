export type MediaType = "movie" | "series";

export type StreamProvider = "cloudflare-stream" | "cloudflare-r2";

export interface MediaStream {
  readonly provider: StreamProvider;
  readonly playbackUrl: string | null;
  readonly trailerUrl: string | null;
}

export interface MediaAsset {
  readonly id: string;
  readonly title: string;
  readonly type: MediaType;
  readonly maturityRating: string;
  readonly releaseYear: number;
  readonly durationMinutes: number;
  readonly genres: readonly string[];
  readonly synopsis: string;
  readonly posterUrl: string;
  readonly stream: MediaStream;
}
