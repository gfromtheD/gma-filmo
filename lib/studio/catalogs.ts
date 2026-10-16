/**
 * Catálogos de la subida de un título (opciones de selectores, límites y especificaciones de archivos).
 * Es la versión de GMA de lo que se pide en una plataforma de festivales: ver `docs/estudio/ESTRUCTURA-SUBIDA.md`.
 */

/** Límites de la subida. */
export const LIMITS = {
  /** Peso máximo de una imagen (JPG, PNG o GIF). */
  imageBytes: 10 * 1024 * 1024,
  /** Peso máximo del vídeo cuando se aporta por enlace de Dropbox. */
  linkedVideoBytes: 5 * 1024 ** 3,
  /** Caracteres de la sinopsis corta. */
  shortSynopsisChars: 250,
  /** Primer año que se admite como año de estreno (el del primer cine). */
  firstYear: 1895,
  /** Archivos de subtítulos (.srt) que se admiten. */
  srtFiles: 5,
  /** Extras (fotogramas, pósters y vídeos) por título. */
  extras: 12,
} as const;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;

/** Categorías de la obra (selección múltiple). */
export const CATEGORIES = ["Animación", "Documental", "Experimental", "Fantástico", "Ficción", "Otros", "Terror", "Videoclip"] as const;

export const AGE_RATINGS = ["Todas las edades", "0 - 6", "6+", "9+", "12+", "16+", "18+"] as const;

export type ImageSlotId = "poster" | "banner";

export interface ImageSlotSpec {
  readonly id: ImageSlotId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly required: boolean;
  /** Para qué se usa en GMA (ayuda bajo el campo). */
  readonly usage: string;
}

/** Imágenes que se piden, con la medida sugerida de cada una. */
export const IMAGE_SLOTS: readonly ImageSlotSpec[] = [
  { id: "poster", label: "Cartel", width: 595, height: 842, required: true, usage: "Portada vertical del título." },
  { id: "banner", label: "Banner", width: 1920, height: 1080, required: true, usage: "Imagen horizontal de cabecera de la ficha." },
];

export const GENRES = [
  "3D", "Acción", "Adolescente", "Arte", "Aventura", "Bélica", "Biopic", "Catastrófico", "Ciencia ficción", "Cine negro",
  "Comedia", "Coreografía", "Crimen", "Danza", "Deportes", "Derechos humanos", "Drama", "Erótico", "Fantasía", "Histórico",
  "Horror", "Infantil", "Melodrama", "Mockumentary", "Mudo", "Musical", "Otro", "Procesos judiciales", "Psicológico",
  "Realidad virtual", "Reality", "Retrato", "Road movie", "Romántico", "Series", "Series web", "Sexual", "Superhéroes",
  "Thriller", "Videoarte", "Western", "Wildlife movie", "Zombis",
] as const;

export const THEMES = [
  "Adolescente", "Alcohol", "Alojamiento", "Ambiental", "Animales", "Antiguo", "Arqueología", "Arquitectura", "Arte callejero",
  "Astronomía", "Asuntos sociales", "Autoayuda", "Bajo presupuesto", "Basado en un libro", "Bodas", "Cambio climático", "Campo",
  "Ciencia y tecnología", "Cinema beur", "Cinema vérité", "Circo", "Ciudad", "Comer y beber", "Comunidades indígenas",
  "Crisis económica", "Cultura", "Cultura islámica", "Danza", "Deportes", "Desalojos", "Desigualdades", "Diario",
  "Direct cinema", "Discapacidad", "Dispositivos inteligentes", "Drogas", "Dron", "Ecología", "Economía", "Educativo",
  "Emigración e inmigración", "Empleo", "Energía", "Enfermedad", "Equidad de género", "Erótico", "Escuela", "Familia",
  "Ficción documental", "Fiestas populares", "Filosofía", "Flamenco", "Formato vertical", "Fotografía", "Fundamentalismo",
  "Gore", "Guerra", "Histórica", "Homosexualidad", "Humor", "Imágenes de archivo", "Indio", "Infancia", "Inteligencia artificial",
  "Internet", "Juventud", "Literatura", "Macabro", "Mafia", "Mar", "Medicamentos", "Medicina", "Metraje encontrado",
  "Minorías étnicas", "Moda", "Montaña", "Muerte", "Mujer", "Mundo árabe", "Música", "Naturaleza", "Odio", "Otro", "Parejas",
  "Parodia", "Películas sobre cine", "Plano secuencia", "Pobreza", "Policial", "Política", "Primer amor", "Prisión",
  "Prostitución", "Prostitución infantil", "Psicología", "Publicidad", "Queer cinema", "Racismo", "Relaciones", "Religión",
  "Remake", "Robo", "Romance", "Salud", "Salud mental", "Sexualidad", "Sin violencia", "Slasher", "Soledad", "Solidaridad",
  "Sueños", "Suicidio", "Surrealista", "Sátira", "Teatro", "Teatro filmado", "Terrorismo", "Toreo", "Trabajo infantil",
  "Tráiler", "Turismo", "Vehículos", "Vejez", "Venganza", "Viaje", "Violencia",
] as const;

/** Roles principales que se muestran en la ficha (no los créditos completos). */
export const DIRECTOR_ROLE = "Director/a";

export const CREW_ROLE_GROUPS: readonly { readonly group: string; readonly roles: readonly string[] }[] = [
  { group: "Dirección y producción", roles: [DIRECTOR_ROLE, "Productor/a"] },
  { group: "Reparto", roles: ["Actor / actriz principal", "Actor / actriz secundaria", "Voz en off"] },
  { group: "Creación", roles: ["Guionista", "Productor ejecutivo", "Director de fotografía", "Edición", "Música", "Sonido", "Director de arte", "Animación"] },
  { group: "Otros", roles: ["Otro"] },
] as const;

export const CREW_ROLES: readonly string[] = CREW_ROLE_GROUPS.flatMap((g) => g.roles);

/** Enlaces del proyecto que se piden. */
export const PROJECT_LINKS = [
  { id: "web", label: "Web", placeholder: "https://" },
  { id: "imdb", label: "IMDb", placeholder: "https://www.imdb.com/title/…" },
  { id: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/…" },
  { id: "x", label: "X", placeholder: "https://x.com/…" },
  { id: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/…" },
] as const;

export type ProjectLinkId = (typeof PROJECT_LINKS)[number]["id"];
