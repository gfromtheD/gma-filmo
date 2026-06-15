import type { StudioData } from "./studio-types";

const posters = {
  tren:   { from: "#1c3a2e", to: "#0a1410", accent: "#3fae7e", glyph: "tren" },
  marea:  { from: "#13314a", to: "#0a1622", accent: "#4f9bd0", glyph: "marea" },
  hab204: { from: "#3a1c24", to: "#150a0e", accent: "#c25d6e", glyph: "204" },
  carto:  { from: "#2a2440", to: "#0f0d18", accent: "#8a7bd0", glyph: "carto" },
  nieve:  { from: "#23323d", to: "#0d141a", accent: "#9fc0d4", glyph: "nieve" },
  dias:   { from: "#3a2e18", to: "#16110a", accent: "#c49a4b", glyph: "dias" },
  piel:   { from: "#143832", to: "#0a1714", accent: "#3fae9a", glyph: "piel" },
};

export const STUDIO_DATA: StudioData = {
  creator: {
    studioName: "Estudio Marea",
    artistName: "Nora Vidal",
    handle: "@estudiomarea",
    role: "Directora · Guionista",
    bio: "Cine de autor sobre la memoria, el agua y los pueblos que se vacían. Cortometrajes y piezas experimentales filmadas en la costa atlántica. Cada película es una marea que sube y se retira.",
    verified: true,
    verifiedSince: "marzo 2024",
    location: "Vigo, Galicia",
    joined: "Enero 2024",
    plan: "Creador verificado",
    socials: { instagram: "@estudio.marea", vimeo: "vimeo.com/estudiomarea", web: "estudiomarea.film" },
    logoColors: { from: "#22B16B", to: "#0d4f33" },
    stats: { titles: 7, published: 4, totalViews: 131039, avgRating: 4.5, followers: 8420 },
  },

  titles: [
    {
      id: "t1", title: "Marea baja", type: "Cortometraje", genre: "Drama", year: 2025,
      duration: "14 min", status: "publicado", views: 89231, rating: 4.8, ratingCount: 2140,
      comments: 312, poster: posters.marea, language: "Español", subtitles: ["Inglés", "Francés"],
      publishDate: "12 feb 2025", featured: true,
      description: "Una recolectora de almejas regresa al pueblo donde aprendió el oficio de su madre, ahora sumergido por la subida del mar.",
      spark: [12, 18, 24, 40, 62, 71, 80, 89],
    },
    {
      id: "t2", title: "El último tren a Cádiz", type: "Cortometraje", genre: "Drama", year: 2024,
      duration: "22 min", status: "publicado", views: 24512, rating: 4.6, ratingCount: 640,
      comments: 98, poster: posters.tren, language: "Español", subtitles: ["Inglés"],
      publishDate: "30 sep 2024",
      description: "Dos desconocidos comparten el último vagón de la noche y, sin proponérselo, también un secreto.",
      spark: [4, 7, 9, 13, 17, 20, 22, 24],
    },
    {
      id: "t3", title: "Cartografía del silencio", type: "Documental", genre: "Documental", year: 2024,
      duration: "48 min", status: "publicado", views: 12043, rating: 4.3, ratingCount: 287,
      comments: 41, poster: posters.carto, language: "Gallego", subtitles: ["Español", "Inglés"],
      publishDate: "18 jun 2024",
      description: "Un retrato sonoro de tres aldeas abandonadas del interior, contado por los últimos que se fueron.",
      spark: [2, 3, 5, 6, 8, 9, 11, 12],
    },
    {
      id: "t4", title: "Bajo la piel del agua", type: "Experimental", genre: "Experimental", year: 2025,
      duration: "9 min", status: "publicado", views: 5210, rating: 4.1, ratingCount: 132,
      comments: 23, poster: posters.piel, language: "Sin diálogo", subtitles: [],
      publishDate: "04 may 2025",
      description: "Estudio en 16mm sobre la luz filtrada bajo la superficie de una ría al amanecer.",
      spark: [1, 1, 2, 3, 4, 4, 5, 5],
    },
    {
      id: "t5", title: "Habitación 204", type: "Cortometraje", genre: "Thriller", year: 2026,
      duration: "18 min", status: "revision", poster: posters.hab204, language: "Español",
      subtitles: ["Inglés"], submittedDate: "06 jun 2026", reviewEta: "2–3 días hábiles",
      description: "Una limpiadora de hotel encuentra la misma habitación reservada cada noche por un huésped que nunca ve.",
    },
    {
      id: "t6", title: "Nieve en abril", type: "Cortometraje", genre: "Drama", year: 2026,
      duration: "—", status: "borrador", poster: posters.nieve, language: "Español",
      subtitles: [], lastEdited: "Editado hace 2 días", completeness: 60,
      description: "Borrador — guion bloqueado, falta corrección de color y mezcla de sonido.",
    },
    {
      id: "t7", title: "Los días contados", type: "Cortometraje", genre: "Drama", year: 2023,
      duration: "16 min", status: "rechazado", poster: posters.dias, language: "Español",
      subtitles: ["Inglés"], rejectedDate: "11 ago 2023",
      rejectReason: "El material incluye una pista musical sin licencia verificable (min. 04:12–06:40). Sustituye la pista o aporta la licencia y vuelve a enviar.",
      description: "Un relojero jubilado decide arreglar, uno a uno, todos los relojes parados de su calle.",
    },
  ],

  recentComments: [
    { id: "c1", user: "Lucía Ferrán", title: "Marea baja", rating: 5, date: "hace 3 h",
      text: "El plano final me dejó sin aire. El sonido del agua hace todo el trabajo emocional." },
    { id: "c2", user: "@cinefilo_atl", title: "Marea baja", rating: 5, date: "hace 8 h",
      text: "Catorce minutos que pesan como un largo. Necesito más de Estudio Marea." },
    { id: "c3", user: "Marc Oliveres", title: "El último tren a Cádiz", rating: 4, date: "ayer",
      text: "Gran tensión en el vagón, aunque el tercer acto se resuelve demasiado rápido." },
    { id: "c4", user: "Ana Pries", title: "Cartografía del silencio", rating: 5, date: "hace 2 días",
      text: "Documental necesario. La mezcla de sonido es de otra liga." },
    { id: "c5", user: "@reels.de.cine", title: "Marea baja", rating: 4, date: "hace 3 días",
      text: "Fotografía preciosa. Subtítulos en francés se adelantan un pelín al final." },
  ],

  viewsTrend: [
    { m: "Jul", v: 3200 }, { m: "Ago", v: 4100 }, { m: "Sep", v: 5400 },
    { m: "Oct", v: 9800 }, { m: "Nov", v: 8700 }, { m: "Dic", v: 11200 },
    { m: "Ene", v: 14600 }, { m: "Feb", v: 23800 }, { m: "Mar", v: 19400 },
    { m: "Abr", v: 16200 }, { m: "May", v: 12900 }, { m: "Jun", v: 9100 },
  ],

  ratingBreakdown: [
    { stars: 5, pct: 64 }, { stars: 4, pct: 24 }, { stars: 3, pct: 8 },
    { stars: 2, pct: 3 }, { stars: 1, pct: 1 },
  ],

  genres: ["Drama", "Thriller", "Documental", "Experimental", "Comedia", "Terror", "Ciencia ficción", "Romance", "Animación"],
  languages: ["Español", "Gallego", "Catalán", "Euskera", "Inglés", "Francés", "Portugués", "Sin diálogo"],
  posters,
};
