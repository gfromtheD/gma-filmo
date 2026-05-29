import type { MediaAsset } from "@/types/media";

export const MEDIA_ACTION_COPY = {
  watchNow: "Ver Ahora",
  watchTrailer: "Ver Trailer",
  addToWatchlist: "Agregar a Mi Lista",
  languagesMore: "Idiomas y más",
} as const;

export const FEATURED_MEDIA: readonly MediaAsset[] = [
  {
    id: "media-origin-001",
    title: "Origen Atlántico",
    type: "movie",
    maturityRating: "13+",
    releaseYear: 2026,
    durationMinutes: 118,
    genres: ["Drama", "Suspenso"],
    synopsis:
      "Una expedición científica descubre señales imposibles bajo una ciudad costera.",
    posterUrl: "/icons/window.svg",
    stream: {
      provider: "cloudflare-stream",
      playbackUrl: null,
      trailerUrl: null,
    },
  },
  {
    id: "media-signal-001",
    title: "Señal Norte",
    type: "series",
    maturityRating: "16+",
    releaseYear: 2025,
    durationMinutes: 52,
    genres: ["Ciencia ficción", "Misterio"],
    synopsis:
      "Una analista reconstruye una transmisión que cambia cada vez que alguien la escucha.",
    posterUrl: "/icons/globe.svg",
    stream: {
      provider: "cloudflare-stream",
      playbackUrl: null,
      trailerUrl: null,
    },
  },
] as const;
