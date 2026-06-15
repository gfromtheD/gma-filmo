export type TitleStatus = "publicado" | "revision" | "borrador" | "rechazado";

export type StudioTabId = "inicio" | "titulos" | "subir" | "estadisticas" | "perfil";

export interface PosterData {
  from: string;
  to: string;
  accent: string;
  glyph?: string;
}

export interface StudioTitle {
  id: string;
  title: string;
  type: string;
  genre: string;
  year: number;
  duration: string;
  status: TitleStatus;
  description: string;
  language: string;
  subtitles: string[];
  poster: PosterData;
  views?: number;
  rating?: number;
  ratingCount?: number;
  comments?: number;
  publishDate?: string;
  featured?: boolean;
  spark?: number[];
  submittedDate?: string;
  reviewEta?: string;
  lastEdited?: string;
  completeness?: number;
  rejectedDate?: string;
  rejectReason?: string;
}

export interface CreatorComment {
  id: string;
  user: string;
  title: string;
  rating: number;
  date: string;
  text: string;
}

export interface ViewsTrendPoint {
  m: string;
  v: number;
}

export interface RatingPoint {
  stars: number;
  pct: number;
}

export interface Creator {
  studioName: string;
  artistName: string;
  handle: string;
  role: string;
  bio: string;
  verified: boolean;
  verifiedSince: string;
  location: string;
  joined: string;
  plan: string;
  socials: { instagram: string; vimeo: string; web: string };
  logoColors: { from: string; to: string };
  stats: { titles: number; published: number; totalViews: number; avgRating: number; followers: number };
}

export interface StudioData {
  creator: Creator;
  titles: StudioTitle[];
  recentComments: CreatorComment[];
  viewsTrend: ViewsTrendPoint[];
  ratingBreakdown: RatingPoint[];
  genres: string[];
  languages: string[];
  posters: Record<string, PosterData>;
}
