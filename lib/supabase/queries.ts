import { toPlaybackReference } from "@/lib/media/catalog-playback";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import { cachedFilmRowBySlug } from "@/lib/supabase/film-by-slug";
import type { MovieMedia, ArtistCredit } from "@/types/catalog";
import type { MotifName, PosterStyle } from "@/types/catalog";
import type { CreatorProfile } from "@/types/creator";
import { addCatalogCredits, keepCreatorLinks, catalogCreators, catalogCredit, catalogProfile, completeCatalogProfile, creatorWorks, creditNameKey } from "@/lib/catalog-creators";
import { FILM_CONTENT } from "@/lib/data/film-taglines";
import { getStudioProfile } from "@/lib/supabase/studio-banner";
import { applyStudioProfile, CREATOR_PROFILES_TAG } from "@/lib/studio-creator-banner";
import { FILM_LONG_SYNOPSES } from "@/lib/data/film-long-synopses";
import { cachedImageUrl } from "@/lib/r2/public-image";

// ── Deterministic visual style from slug ─────────────────────────────────────
const TONES: readonly (readonly [string, string])[] = [
  ["#0c2236", "#193859"],
  ["#1a2412", "#3a5a2a"],
  ["#1c0d12", "#5a1a2a"],
  ["#0e1a22", "#1a2c3a"],
  ["#1a1208", "#3a2818"],
  ["#1a1a0e", "#2a2a14"],
  ["#0a1428", "#1a2a5a"],
  ["#1a0a14", "#3a1a2c"],
];

const ACCENTS = [
  "#22B16B", "#3a8fb7", "#f0c14b", "#ff2e44",
  "#7cd0ff", "#ffd166", "#e63946", "#c46538",
] as const;

const MOTIFS: readonly MotifName[] = [
  "belt", "splatter", "vault", "monogram", "lightning",
  "sun", "crown", "web", "arrow", "mic", "paper", "ring",
];

function deriveStyle(slug: string): PosterStyle {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h * 31) + slug.charCodeAt(i)) >>> 0;
  }
  return {
    tone: TONES[h % TONES.length] as [string, string],
    accent: ACCENTS[(h >> 4) % ACCENTS.length]!,
    motif: MOTIFS[(h >> 8) % MOTIFS.length]!,
  };
}

// ── Supabase row types ────────────────────────────────────────────────────────
type PeliculaRow = {
  id: number;
  slug: string;
  title: string;
  synopsis: string | null;
  year: string | null;
  duration: string | null;
  author: string | null;
  r2_poster_url: string | null;
  r2_poster_vertical_url?: string | null;
  r2_video_url: string | null;
  playback_kind?: string;
  status?: string | null;
  r2_subtitle_url: string | null;
  youtube_url: string | null;
  thumbnail_url: string | null;
  source_page: string | null;
  created_at: string;
  genre: string | null;
  language?: string | null;
};

type PeliculaWithRelations = PeliculaRow & {
  peliculas_colecciones: { colecciones: { name: string } | null }[];
  peliculas_artistas: {
    artistas: { name: string; slug: string; r2_photo_url: string | null } | null;
  }[];
};

type ArtistaEntry = { name: string; r2_photo_url: string | null; slug: string };

// ── Artista lookup map (name/slug → artista) ──────────────────────────────────
// Cached: artistas rarely change, 1h TTL is fine
const fetchArtistaMapCached = unstable_cache(
  async (): Promise<[string, ArtistaEntry][]> => {
    const supabase = getSupabasePublicClient();
    const { data } = await supabase.from("artistas").select("slug, name, r2_photo_url");
    const entries: [string, ArtistaEntry][] = [];
    for (const a of (data ?? [])) {
      const entry: ArtistaEntry = { name: a.name, r2_photo_url: a.r2_photo_url, slug: a.slug };
      entries.push([creditNameKey(a.name), entry]);
      entries.push([a.slug.toLowerCase(), entry]);
      entries.push([a.slug.replace(/-/g, " ").toLowerCase(), entry]);
    }
    for (const creator of catalogCreators) {
      if (!entries.some(([key]) => key === creditNameKey(creator.name))) {
        const entry: ArtistaEntry = { name: creator.name, slug: creator.slug, r2_photo_url: creator.r2_photo_url };
        entries.push([creditNameKey(creator.name), entry]);
      }
    }
    return entries;
  },
  ["artistas-map-associated-shorts-v4"],
  { revalidate: 3600, tags: ["artistas"] },
);

async function fetchArtistaMap(): Promise<Map<string, ArtistaEntry>> {
  return new Map(await fetchArtistaMapCached());
}

// Normalize raw role labels to clean display names
function normalizeRole(raw: string): string {
  const r = raw.toLowerCase();
  if (/crea|direc|realiz/.test(r))   return "Director";
  if (/ilustra/.test(r))             return "Ilustrador";
  if (/guión|guion|script/.test(r))  return "Guionista";
  if (/música|musica|compos/.test(r)) return "Música";
  if (/anima/.test(r))               return "Animación";
  if (/produc/.test(r))              return "Producción";
  return raw; // keep original if no match
}

// Parse "Creado por: X; Ilustración por: Y" into [{name, role}] preserving roles
function parseAuthorCredits(author: string): Array<{ name: string; role: string }> {
  return author
    .split(/[;\n]+/)
    .map((part) => {
      const colonMatch = part.trim().match(/^([^:]{2,30}):\s*(.+)$/);
      if (colonMatch) {
        return { role: normalizeRole(colonMatch[1]!.trim()), name: colonMatch[2]!.trim() };
      }
      return { name: part.trim(), role: "" };
    })
    .filter((c) => c.name.length > 1);
}

// ── Mapper: DB row → MovieMedia ───────────────────────────────────────────────
function toMovieMedia(
  p: PeliculaWithRelations,
  artistaMap?: Map<string, ArtistaEntry>,
): MovieMedia {
  const categories = p.peliculas_colecciones
    .map((pc) => pc.colecciones?.name)
    .filter((n): n is string => Boolean(n));

  // Build role map from author field so junction-table entries get proper labels
  const roleByName = new Map<string, string>();
  if (p.author) {
    for (const credit of parseAuthorCredits(p.author)) {
      roleByName.set(credit.name.toLowerCase(), credit.role);
    }
  }

  // Primary: structured junction table links
  let artistas: ArtistCredit[] = p.peliculas_artistas
    .filter((pa) => pa.artistas != null)
    .map((pa) => ({
      name:     pa.artistas!.name,
      role:     roleByName.get(pa.artistas!.name.toLowerCase()) ?? "",
      photoUrl: cachedImageUrl(pa.artistas!.r2_photo_url),
      slug:     pa.artistas!.slug ?? null,
    }));

  // Preserve every named credit, including historical creators without accounts.
  if (p.author) {
    for (const credit of parseAuthorCredits(p.author)) {
      const existing = artistas.find(artist => creditNameKey(artist.name) === creditNameKey(credit.name));
      if (existing) continue;
      const match = artistaMap?.get(creditNameKey(credit.name));
      artistas.push(match
        ? { name: match.name, role: credit.role, photoUrl: cachedImageUrl(match.r2_photo_url), slug: match.slug }
        : catalogCredit(credit.name, credit.role));
    }
  }

  // Confirmed "Mis trabajos" links from the original directory are matched
  // to a real short by canonical slug, never to an absent or invented work.
  if (p.slug !== "la-pelicula" && p.genre !== "Película") {
    artistas = addCatalogCredits(p.slug, artistas);
  }

  const imageUrl    = cachedImageUrl(p.r2_poster_url ?? p.thumbnail_url ?? undefined);
  const r2VideoUrl  = p.r2_video_url ?? undefined;
  const subtitleUrl = p.r2_subtitle_url ?? undefined;
  const content    = FILM_CONTENT[p.slug];

  return {
    numericId: p.id,
    id: p.slug,
    kind: "movie" as const,
    title: p.title,
    year: parseInt(p.year ?? "0") || 0,
    rating: "TODOS",
    categories,
    synopsis: p.synopsis || content?.synopsis || "",
    fullSynopsis: FILM_LONG_SYNOPSES[p.slug],
    tagline: content?.tagline,
    runtime: p.duration ?? "Corto",
    genre: (p.slug === "la-pelicula" || p.genre === "Película") ? "Película" : "Cortometraje",
    imageUrl,
    portraitImageUrl: cachedImageUrl(p.r2_poster_vertical_url ?? undefined),
    r2VideoUrl,
    playbackRef: toPlaybackReference(p.slug, p.playback_kind),
    playbackKind: p.playback_kind==='media'?'media':p.playback_kind==='r2_hls'?'r2_hls':p.playback_kind==='stream'?'stream':'legacy',
    videoUrl: p.youtube_url ?? undefined,
    subtitleUrl,
    language: p.language?.trim() || undefined,
    style: deriveStyle(p.slug),
    author: p.author ?? undefined,
    artistas: artistas.length > 0 ? artistas : undefined,
  };
}

// ── Creator profile mapper ────────────────────────────────────────────────────
function mapCreatorRow(data: Record<string, unknown>): CreatorProfile {
  return {
    slug:             data.slug as string,
    nombre:           data.nombre as string,
    foto_perfil:      (data.foto_perfil as string | null)      ?? null,
    imagen_portada:   (data.imagen_portada as string | null)   ?? null,
    nacionalidad:     (data.nacionalidad as string | null)     ?? null,
    bio:              (data.bio as string | null)              ?? null,
    redes_sociales:   (data.redes_sociales as { platform: string; url: string }[]) ?? [],
    donacion_paypal:  (data.donacion_paypal as string | null)  ?? null,
    donacion_patreon: (data.donacion_patreon as string | null) ?? null,
    donacion_bitcoin: (data.donacion_bitcoin as string | null) ?? null,
    titulos:          (data.titulos as string[])               ?? [],
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────
const SELECT_WITH_COLS = "*, peliculas_colecciones(colecciones(name)), peliculas_artistas(artistas(name, slug, r2_photo_url))";

const fetchScoreMapCached = unstable_cache(
  async (): Promise<[string, number][]> => {
    const { data } = await getSupabasePublicClient()
      .from("film_scores")
      .select("slug, approval_score");
    return (data ?? [])
      .filter(r => r.approval_score != null)
      .map(r => [r.slug as string, r.approval_score as number]);
  },
  ["film-scores"],
  { revalidate: 300, tags: ["scores"] },
);

async function fetchScoreMap(): Promise<Map<string, number>> {
  return new Map(await fetchScoreMapCached());
}

// Cache the full peliculas list — 1h TTL, deduped per request with React cache()
const getPeliculasCached = unstable_cache(
  async (): Promise<MovieMedia[]> => {
    const supabase = getSupabasePublicClient();
    const [{ data, error }, artistaMap, scoreMap] = await Promise.all([
      supabase.from("peliculas").select(SELECT_WITH_COLS).or("status.eq.published,status.is.null").order("created_at", { ascending: false }),
      fetchArtistaMap(),
      fetchScoreMap(),
    ]);
    if (error || !data) return [];
    const films = (data as PeliculaWithRelations[]).map((p) => ({
      ...toMovieMedia(p, artistaMap),
      approvalScore: scoreMap.get(p.slug),
    }));
    return keepCreatorLinks(films, films);
  },
  ["peliculas-all-associated-shorts-v4"],
  { revalidate: 3600, tags: ["peliculas"] },
);

// React cache() deduplicates calls within the same render tree
export const getPeliculas = cache(getPeliculasCached);

export async function getPeliculaBySlug(slug: string): Promise<MovieMedia | null> {
  // La fila va en caché con la etiqueta «peliculas»: al despublicar o borrar, la ficha deja de servirse al momento.
  const [data, artistaMap, scoreMap] = await Promise.all([
    cachedFilmRowBySlug<PeliculaWithRelations>(slug, SELECT_WITH_COLS),
    fetchArtistaMap(),
    fetchScoreMap(),
  ]);

  if (!data) return null;
  const film = { ...toMovieMedia(data as PeliculaWithRelations, artistaMap), approvalScore: scoreMap.get(slug) };
  return keepCreatorLinks([film], await getPeliculas())[0] ?? null;
}

// Deterministic tie-breaker so each film gets stable but unique ordering
function tieBreak(slug: string, seed: string): number {
  let h = 0;
  const s = slug + seed;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function getRelatedPeliculas(
  excludeSlug: string,
  categories: readonly string[],
  limit = 4,
  opts?: { author?: string; year?: number; excludeSlugs?: string[] },
): Promise<MovieMedia[]> {
  const all = await getPeliculas();
  const realCategories = categories.filter((c) => c !== "Cortometraje");
  const excluded = new Set([excludeSlug, ...(opts?.excludeSlugs ?? [])]);
  const candidates = all.filter((m) => !excluded.has(m.id));

  function scoreOf(m: MovieMedia): number {
    let s = 0;
    const shared = m.categories.filter((c) => realCategories.includes(c)).length;
    s += shared * 4;
    if (opts?.author && m.author) {
      const a = opts.author.toLowerCase(), b = m.author.toLowerCase();
      if (a === b || a.includes(b) || b.includes(a)) s += 3;
    }
    if (opts?.year && m.year) {
      const diff = Math.abs(m.year - opts.year);
      if (diff === 0) s += 2;
      else if (diff <= 3) s += 1;
    }
    return s;
  }

  const scored = candidates
    .map((m) => ({ m, score: scoreOf(m) }))
    .sort((a, b) => b.score - a.score || tieBreak(a.m.id, excludeSlug) - tieBreak(b.m.id, excludeSlug));

  if (limit <= 1) return scored.slice(0, limit).map(({ m }) => m);

  const picked: MovieMedia[] = [];
  const usedIds  = new Set<string>([excludeSlug]);
  const usedCats = new Set<string>();

  function pick(m: MovieMedia) {
    picked.push(m);
    usedIds.add(m.id);
    m.categories.forEach((c) => usedCats.add(c));
  }

  // Slot 1 — most relevant
  const slot1 = scored.find(({ score }) => score > 0);
  if (slot1) pick(slot1.m);

  // Slot 2 — relevant but from a different collection than slot 1
  const slot2 = scored.find(({ m, score }) =>
    score > 0 &&
    !usedIds.has(m.id) &&
    m.categories.every((c) => c === "Cortometraje" || !usedCats.has(c)),
  ) ?? scored.find(({ m, score }) => score > 0 && !usedIds.has(m.id));
  if (slot2) pick(slot2.m);

  // Slot 3 — best remaining with any relevance, preferring yet-unseen collections
  const slot3 = scored.find(({ m }) => !usedIds.has(m.id));
  if (slot3) pick(slot3.m);

  // Slot 4 — discovery: deterministic wildcard from the rest of the catalog
  // Uses a different seed so each film points to a unique discovery pick
  const discovery = candidates
    .filter((m) => !usedIds.has(m.id))
    .sort((a, b) => tieBreak(a.id, excludeSlug + ":discover") - tieBreak(b.id, excludeSlug + ":discover"));
  if (discovery[0]) pick(discovery[0]);

  // Fill the remaining slots (limit > 4 or tiny catalog) in relevance order, so a long grid keeps its best matches first
  if (picked.length < limit) {
    scored
      .filter(({ m }) => !usedIds.has(m.id))
      .slice(0, limit - picked.length)
      .forEach(({ m }) => pick(m));
  }

  return picked.slice(0, limit);
}

export type Coleccion = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  r2_cover_url: string | null;
};

const ESTRENOS_COLECCION: Coleccion = {
  id: -1,
  slug: "estrenos",
  name: "Estrenos",
  description: "Los últimos títulos añadidos a GMA Filmo",
  r2_cover_url: null,
};

const getColeccionesCached = unstable_cache(
  async (): Promise<Coleccion[]> => {
    const supabase = getSupabasePublicClient();
    const { data } = await supabase
      .from("colecciones")
      .select("id, slug, name, description, r2_cover_url")
      .order("name");
    const rows = (data ?? []) as Coleccion[];
    return [ESTRENOS_COLECCION, ...rows.map((c) => ({ ...c, r2_cover_url: cachedImageUrl(c.r2_cover_url) }))];
  },
  ["colecciones-all"],
  { revalidate: 3600, tags: ["colecciones"] },
);

export const getColecciones = cache(getColeccionesCached);

export async function getColeccionBySlug(slug: string): Promise<Coleccion | null> {
  if (slug === "estrenos") return ESTRENOS_COLECCION;
  const supabase = getSupabasePublicClient();
  const { data } = await supabase
    .from("colecciones")
    .select("id, slug, name, description, r2_cover_url")
    .eq("slug", slug)
    .single();
  const row = data as Coleccion | null;
  return row ? { ...row, r2_cover_url: cachedImageUrl(row.r2_cover_url) } : null;
}

export async function getPeliculasByColeccion(slug: string): Promise<MovieMedia[]> {
  // "Estrenos" is a virtual collection — the 20 most recently added titles
  if (slug === "estrenos") {
    const all = await getPeliculas();
    return all.slice(0, 20);
  }

  const supabase = getSupabasePublicClient();

  const { data: col } = await supabase
    .from("colecciones")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!col) return [];

  const { data: junctions } = await supabase
    .from("peliculas_colecciones")
    .select("pelicula_id")
    .eq("coleccion_id", col.id);

  if (!junctions?.length) return [];

  const ids = junctions.map((j: { pelicula_id: number }) => j.pelicula_id);

  const [{ data, error }, artistaMap] = await Promise.all([
    supabase.from("peliculas").select(SELECT_WITH_COLS).or("status.eq.published,status.is.null").in("id", ids).order("created_at", { ascending: false }),
    fetchArtistaMap(),
  ]);

  if (error || !data) return [];
  return keepCreatorLinks((data as PeliculaWithRelations[]).map((p) => toMovieMedia(p, artistaMap)), await getPeliculas());
}

// ── Creator public profiles ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof getSupabasePublicClient> & { from: (t: string) => any };

export async function getCreatorBySlug(slug: string): Promise<CreatorProfile | null> {
  return unstable_cache(
    async () => {
      const profile = await resolveCreatorBySlug(slug);
      if (!profile) return null;
      // La ficha de Mi Estudio (banner, foto, bio, redes; y si la gestiona el equipo) manda sobre lo del catálogo.
      return applyStudioProfile(profile, await getStudioProfile(profile.nombre, profile.titulos));
    },
    [`creator-with-works-v5-${slug}`],
    { revalidate: 3600, tags: [CREATOR_PROFILES_TAG] },
  )();
}

async function resolveCreatorBySlug(slug: string): Promise<CreatorProfile | null> {
      const films = await getPeliculas();
      const associated = creatorWorks(slug, films);
      if (!associated.length) return null;
      const supabase = getSupabasePublicClient() as AnyClient;

      // Primary: dedicated creator profile table
      const { data } = await supabase
        .from("creator_public_profiles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (data) {
        const profile = mapCreatorRow(data as Record<string, unknown>);
        const catalog = catalogProfile(slug, films);
        return completeCatalogProfile(profile, catalog);
      }

      // Fallback: artistas table (166 seeded entries with bio + photo)
      const { data: artista } = await supabase
        .from("artistas")
        .select("id, slug, name, bio, r2_photo_url")
        .eq("slug", slug)
        .maybeSingle();
      if (!artista) return catalogProfile(slug, films);

      const catalog = catalogProfile(slug, films);
      return {
        slug:             artista.slug as string,
        nombre:           artista.name as string,
        foto_perfil:      cachedImageUrl((artista.r2_photo_url as string | null) ?? null),
        imagen_portada:   null,
        nacionalidad:     null,
        bio:              (artista.bio as string | null) ?? catalog?.bio ?? null,
        redes_sociales:   catalog?.redes_sociales ?? [],
        donacion_paypal:  null,
        donacion_patreon: null,
        donacion_bitcoin: null,
        titulos: associated.map(film => film.id),
        editorial: true,
        source_url: catalog?.source_url ?? null,
      };
}

export async function getCreatorFilmsByTitulos(titulos: readonly string[]): Promise<MovieMedia[]> {
  if (!titulos.length) return [];
  const all = await getPeliculas();
  return all.filter((m) => titulos.includes(m.id));
}

export async function getCreatorByArtistaSlugs(slugs: string[]): Promise<CreatorProfile | null> {
  for (const slug of slugs) {
    const creator = await getCreatorBySlug(slug);
    if (creator) return creator;
  }
  return null;
}
