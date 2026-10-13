import type { StudioData } from "./studio-types";
import { CREATOR_GENRES } from "@/lib/genres";

const posters = {
  tren:   { from: "#1c3a2e", to: "#0a1410", accent: "#3fae7e" },
  marea:  { from: "#13314a", to: "#0a1622", accent: "#4f9bd0" },
  hab204: { from: "#3a1c24", to: "#150a0e", accent: "#c25d6e" },
  carto:  { from: "#2a2440", to: "#0f0d18", accent: "#8a7bd0" },
  nieve:  { from: "#23323d", to: "#0d141a", accent: "#9fc0d4" },
  dias:   { from: "#3a2e18", to: "#16110a", accent: "#c49a4b" },
  piel:   { from: "#143832", to: "#0a1714", accent: "#3fae9a" },
};

export const STUDIO_DATA: StudioData = {
  creator: {
    studioName: "", artistName: "", handle: "", role: "", bio: "",
    verified: false, verifiedSince: "", location: "", joined: "", plan: "",
    socials: {}, logoColors: { from: "#22B16B", to: "#0d4f33" },
    stats: { titles: 0, published: 0, totalViews: null, avgRating: null, followers: null },
  },
  titles: [],
  recentComments: [],
  viewsTrend: [],
  ratingBreakdown: [],

  genres: CREATOR_GENRES.map(g => g.label),
  languages: ["Español", "Gallego", "Catalán", "Euskera", "Inglés", "Francés", "Portugués", "Sin diálogo"],
  posters,
};
