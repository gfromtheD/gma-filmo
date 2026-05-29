import type { Category, Episode, MediaItem, MovieMedia, PosterStyle, SeriesMedia } from "@/types/catalog";

const S: Record<string, PosterStyle> = {
  expanse:    { tone: ["#0c2236", "#193859"], accent: "#3a8fb7",  motif: "belt" },
  boys:       { tone: ["#3a0612", "#7a0d22"], accent: "#ff2e44",  motif: "splatter" },
  fallout:    { tone: ["#3a2812", "#7a4d18"], accent: "#f0c14b",  motif: "vault" },
  reacher:    { tone: ["#1a1f2c", "#3a4254"], accent: "#c9a960",  motif: "monogram" },
  citadel:    { tone: ["#0c1a36", "#1a3a7a"], accent: "#e63946",  motif: "cipher" },
  rings:      { tone: ["#1a2412", "#3a5a2a"], accent: "#d4a849",  motif: "ring" },
  marvelous:  { tone: ["#2a1a36", "#5a2a7a"], accent: "#ffd166",  motif: "mic" },
  jack:       { tone: ["#1a1812", "#3a3022"], accent: "#9a7a52",  motif: "tag" },
  paper:      { tone: ["#0a1428", "#1a2a5a"], accent: "#f06292",  motif: "paper" },
  invincible: { tone: ["#1c0d12", "#5a1a2a"], accent: "#ffd166",  motif: "lightning" },
  genv:       { tone: ["#1a2236", "#1a3a59"], accent: "#7cd0ff",  motif: "cap" },
  upload:     { tone: ["#0e1a22", "#1e3a4a"], accent: "#86e3ce",  motif: "cloud" },
  revenant:   { tone: ["#1a1208", "#3a2818"], accent: "#c46538",  motif: "frost" },
  greys:      { tone: ["#1a0a14", "#3a1a2c"], accent: "#d44a6a",  motif: "cross" },
  napoleon:   { tone: ["#0e1320", "#262d44"], accent: "#b89a4c",  motif: "crown" },
  airwolf:    { tone: ["#0a1620", "#1a3a52"], accent: "#5ac8fa",  motif: "rotor" },
  saltburn:   { tone: ["#1a1208", "#3a2a14"], accent: "#e8c468",  motif: "crest" },
  argylle:    { tone: ["#0d1a36", "#1a3a7a"], accent: "#ffb84d",  motif: "gun" },
  road:       { tone: ["#1a0a0a", "#3a1818"], accent: "#e85a3b",  motif: "tire" },
  spider:     { tone: ["#260a36", "#5a1a7a"], accent: "#ff3a6a",  motif: "web" },
  tomorrow:   { tone: ["#0a1420", "#1a2a44"], accent: "#5acdff",  motif: "arrow" },
  air:        { tone: ["#1a1a0e", "#3a3a1a"], accent: "#c64a3a",  motif: "jump" },
  bestseller: { tone: ["#1a1208", "#36280e"], accent: "#d4a35a",  motif: "pen" },
  somewhere:  { tone: ["#0e1a20", "#1a2c3a"], accent: "#7ad4ff",  motif: "sun" },
};

export const SERIES: readonly SeriesMedia[] = [
  { numericId: 0, id: "expanse",    kind: "series", title: "The Expanse",                  year: 2015, seasons: 6,  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR", "Atmos"], categories: ["Ciencia ficción", "Drama"],    synopsis: "En un futuro cercano, la humanidad ha colonizado el sistema solar. Una conspiración amenaza la paz entre la Tierra, Marte y el Cinturón.",   style: S["expanse"]!,    progress: 0.62 },
  { numericId: 0, id: "boys",       kind: "series", title: "The Boys",                     year: 2019, seasons: 4,  rating: "18+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR"],           categories: ["Acción", "Drama"],            synopsis: "Un grupo de vigilantes intenta destapar la corrupción detrás de los superhéroes más poderosos del mundo.",                                 style: S["boys"]!,       progress: 0.34 },
  { numericId: 0, id: "fallout",    kind: "series", title: "Fallout",                      year: 2024, seasons: 1,  rating: "18+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR", "Atmos"], categories: ["Ciencia ficción", "Acción", "Drama"], synopsis: "Doscientos años después del apocalipsis, los habitantes de los lujosos refugios enfrentan el mundo radiactivo que sus ancestros dejaron.", style: S["fallout"]!,    progress: 0.88 },
  { numericId: 0, id: "reacher",    kind: "series", title: "Reacher",                      year: 2022, seasons: 3,  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD"],                  categories: ["Acción", "Misterio"],        synopsis: "Un ex-policía militar y nómada se ve envuelto en una conspiración mortal en un pequeño pueblo de Georgia.",                                style: S["reacher"]! },
  { numericId: 0, id: "citadel",    kind: "series", title: "Citadel",                      year: 2023, seasons: 2,  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR"],           categories: ["Acción", "Misterio"],        synopsis: "Una agencia de espionaje global cae, y dos agentes con la memoria borrada deben reconstruir su pasado.",                                   style: S["citadel"]! },
  { numericId: 0, id: "rings",      kind: "series", title: "The Rings of Power",           year: 2022, seasons: 2,  rating: "13+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR", "Atmos"], categories: ["Fantasía", "Drama"],          synopsis: "Miles de años antes de El Hobbit, regresamos a la Tierra Media para presenciar el ascenso del mal.",                                        style: S["rings"]!,      progress: 0.12 },
  { numericId: 0, id: "marvelous",  kind: "series", title: "The Marvelous Mrs. Maisel",    year: 2017, seasons: 5,  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD"],                  categories: ["Comedia", "Drama"],          synopsis: "A finales de los años 50, una ama de casa de Manhattan descubre que tiene un talento natural para la comedia stand-up.",                    style: S["marvelous"]! },
  { numericId: 0, id: "jack",       kind: "series", title: "Jack Ryan",                    year: 2018, seasons: 4,  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR"],           categories: ["Acción", "Misterio"],        synopsis: "Un analista de la CIA es sacado de su escritorio cuando descubre una transferencia sospechosa que lo lleva al frente de batalla.",            style: S["jack"]! },
  { numericId: 0, id: "invincible", kind: "series", title: "Invincible",                   year: 2021, seasons: 3,  rating: "18+",                         tags: ["UHD"],                  categories: ["Animación", "Acción"],       synopsis: "Un adolescente de 17 años descubre que su padre es el superhéroe más poderoso del planeta.",                                                style: S["invincible"]! },
  { numericId: 0, id: "genv",       kind: "series", title: "Gen V",                        year: 2023, seasons: 1,  rating: "18+", tag: "AMAZON ORIGINAL", tags: ["UHD"],                  categories: ["Acción", "Drama"],           synopsis: "En la única universidad para superhéroes, los estudiantes compiten por las mejores notas y los mejores contratos.",                           style: S["genv"]! },
  { numericId: 0, id: "upload",     kind: "series", title: "Upload",                       year: 2020, seasons: 3,  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD"],                  categories: ["Comedia", "Ciencia ficción"],synopsis: "En un futuro cercano, los humanos pueden subir su conciencia a una vida después de la muerte virtual.",                                     style: S["upload"]! },
  { numericId: 0, id: "greys",      kind: "series", title: "Grey's Anatomy",               year: 2005, seasons: 20, rating: "16+",                         tags: ["UHD"],                  categories: ["Drama"],                     synopsis: "Un grupo de médicos residentes lucha por sobrevivir en el exigente hospital Grey-Sloan Memorial.",                                           style: S["greys"]!,      progress: 0.47 },
];

export const MOVIES: readonly MovieMedia[] = [
  { numericId: 0, id: "revenant",   kind: "movie", title: "The Revenant",             year: 2015, runtime: "2h 36m", rating: "16+", tags: ["UHD", "HDR"],           categories: ["Acción", "Aventura", "Drama"],  synopsis: "Un cazador de pieles es atacado por un oso y abandonado en la frontera helada. Su única motivación: la venganza.",   style: S["revenant"]!,   progress: 0.71 },
  { numericId: 0, id: "napoleon",   kind: "movie", title: "Napoleon",                 year: 2023, runtime: "2h 38m", rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR", "Atmos"], categories: ["Drama", "Acción"],               synopsis: "Un retrato épico del ascenso y caída del emperador francés, visto a través de su relación con la emperatriz Josefina.", style: S["napoleon"]!,  progress: 0.23 },
  { numericId: 0, id: "saltburn",   kind: "movie", title: "Saltburn",                 year: 2023, runtime: "2h 11m", rating: "18+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR"],           categories: ["Drama", "Misterio"],            synopsis: "Un estudiante de Oxford encuentra refugio en la finca de su rico compañero, en una temporada que cambiará sus vidas.", style: S["saltburn"]! },
  { numericId: 0, id: "argylle",    kind: "movie", title: "Argylle",                  year: 2024, runtime: "2h 19m", rating: "13+",                         tags: ["UHD"],                  categories: ["Acción", "Misterio"],           synopsis: "Una novelista de espías descubre que sus libros se acercan demasiado a las actividades de un sindicato real.",        style: S["argylle"]!,   progress: 0.55 },
  { numericId: 0, id: "road",       kind: "movie", title: "Road House",               year: 2024, runtime: "2h 1m",  rating: "16+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR"],           categories: ["Acción"],                       synopsis: "Un ex-luchador de UFC acepta un trabajo en un bar de carretera en los Cayos de Florida.",                            style: S["road"]! },
  { numericId: 0, id: "spider",     kind: "movie", title: "Across the Spider-Verse",  year: 2023, runtime: "2h 20m", rating: "7+",                          tags: ["UHD", "HDR"],           categories: ["Animación", "Acción"],          synopsis: "Miles Morales viaja por el multiverso, donde se encuentra con un equipo de Spider-People.",                          style: S["spider"]! },
  { numericId: 0, id: "tomorrow",   kind: "movie", title: "The Tomorrow War",         year: 2021, runtime: "2h 18m", rating: "13+", tag: "AMAZON ORIGINAL", tags: ["UHD", "HDR"],           categories: ["Ciencia ficción", "Acción"],    synopsis: "Un padre de familia es reclutado para luchar en una guerra futura contra una especie alienígena.",                   style: S["tomorrow"]! },
  { numericId: 0, id: "air",        kind: "movie", title: "Air",                      year: 2023, runtime: "1h 52m", rating: "13+", tag: "AMAZON ORIGINAL", tags: ["UHD"],                  categories: ["Drama"],                        synopsis: "La historia de cómo Nike persiguió al jugador de baloncesto más grande de todos los tiempos para crear Air Jordan.", style: S["air"]! },
  { numericId: 0, id: "bestseller", kind: "movie", title: "The Bestseller Code",      year: 2022, runtime: "1h 47m", rating: "13+",                         tags: ["UHD"],                  categories: ["Drama", "Misterio"],            synopsis: "Una escritora descubre que su novela está siendo replicada con pequeños cambios, y los crímenes empiezan a ocurrir.", style: S["bestseller"]! },
  { numericId: 0, id: "somewhere",  kind: "movie", title: "Somewhere in Queens",      year: 2023, runtime: "1h 46m", rating: "16+",                         tags: ["UHD"],                  categories: ["Comedia", "Drama"],             synopsis: "Un constructor italoamericano hará lo que sea para que su hijo conserve su beca de baloncesto.",                     style: S["somewhere"]! },
];

export const ALL: readonly MediaItem[] = [...SERIES, ...MOVIES];

export const CATEGORIES: readonly Category[] = [
  { id: "all",              label: "Todo" },
  { id: "Drama",            label: "Drama" },
  { id: "Acción",           label: "Acción" },
  { id: "Comedia",          label: "Comedia" },
  { id: "Misterio",         label: "Misterio" },
  { id: "Ciencia ficción",  label: "Ciencia ficción" },
  { id: "Fantasía",         label: "Fantasía" },
  { id: "Aventura",         label: "Aventura" },
  { id: "Animación",        label: "Animación" },
];

export const EPISODES_BY_SERIES: Record<string, readonly Episode[]> = {
  greys: [
    { n: 1, title: "Sólo un sueño",                   runtime: "43m", synopsis: "Meredith Grey comienza su primer día como residente en el Seattle Grace Hospital." },
    { n: 2, title: "El primer corte es el más profundo", runtime: "43m", synopsis: "Los residentes enfrentan su primer paciente crítico mientras lidian con sus vidas personales." },
    { n: 3, title: "Vinagre y miel",                  runtime: "43m", synopsis: "Cristina y Meredith compiten por un caso especial. Bailey impone su autoridad." },
    { n: 4, title: "No te conozco",                   runtime: "43m", synopsis: "Un paciente con amnesia llega a urgencias. Derek y Meredith se acercan más." },
    { n: 5, title: "Choque de trenes",                runtime: "43m", synopsis: "Múltiples víctimas de un accidente ferroviario llegan al hospital." },
    { n: 6, title: "Si te derribaron",                runtime: "43m", synopsis: "Izzie enfrenta un caso personal. Alex revela un secreto inesperado." },
  ],
  expanse: [
    { n: 1, title: "Dulcinea",           runtime: "54m", synopsis: "En el cinturón de asteroides, una nave de carga responde a una señal de auxilio." },
    { n: 2, title: "La huella",          runtime: "46m", synopsis: "La detective Miller investiga la desaparición de una joven heredera." },
    { n: 3, title: "Remolque",           runtime: "47m", synopsis: "Los supervivientes del Canterbury son rescatados por un destructor marciano." },
    { n: 4, title: "CQB",               runtime: "45m", synopsis: "Una batalla a quemarropa entre dos fuerzas mortales en el espacio." },
    { n: 5, title: "De vuelta a la Tierra", runtime: "44m", synopsis: "Avasarala interroga a un prisionero del Cinturón en Nueva York." },
    { n: 6, title: "Salvaje",           runtime: "45m", synopsis: "Holden y su tripulación descubren un secreto en Eros." },
  ],
};
