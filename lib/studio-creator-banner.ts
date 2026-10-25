import { creditNameKey } from "@/lib/catalog-creators";
import type { CreatorProfile, SocialLink } from "@/types/creator";

export interface StudioCreatorRow {
  readonly creator_name: string | null;
  readonly studio_name: string | null;
  readonly banner_url: string | null;
  readonly avatar_url?: string | null;
  readonly bio?: string | null;
  readonly location?: string | null;
  readonly social_links?: Record<string, string> | null;
  /** Cuenta creada y llevada por el equipo de GMA en nombre del autor (ver docs/DIRECTORES-GESTIONADOS.md). */
  readonly gestionado?: boolean | null;
}

/** Lo que la ficha de Mi Estudio aporta a la página pública. */
export interface StudioProfileOverlay {
  readonly banner: string | null;
  readonly avatar: string | null;
  readonly bio: string | null;
  readonly location: string | null;
  readonly socials: readonly SocialLink[];
  readonly gestionado: boolean;
}

const filled = (value: string | null | undefined): string | null => (value && value.trim() ? value.trim() : null);
const sameName = (creatorName: string) => {
  const key = creditNameKey(creatorName);
  return (row: StudioCreatorRow) => [row.creator_name, row.studio_name].some((name) => name && creditNameKey(name) === key);
};

/**
 * La página pública de un creador sale de los créditos del catálogo, no de su cuenta del estudio. Entre las cuentas que
 * subieron sus obras, elige la que corresponde a esta página: la que tiene su mismo nombre artístico o de estudio.
 * Así el banner del autor de una obra no aparece en la página de otra persona del reparto.
 */
export function pickStudioBanner(creatorName: string, rows: readonly StudioCreatorRow[]): string | null {
  const match = rows.find((row) => row.banner_url && sameName(creatorName)(row));
  return match?.banner_url ?? null;
}

/** La ficha de Mi Estudio de esa misma cuenta (foto, bio, ubicación, redes, banner y si la gestiona el equipo). */
export function pickStudioProfile(creatorName: string, rows: readonly StudioCreatorRow[]): StudioProfileOverlay | null {
  const row = rows.find(sameName(creatorName));
  if (!row) return null;
  const socials = Object.entries(row.social_links ?? {})
    .filter(([, url]) => typeof url === "string" && url.trim())
    .map(([platform, url]) => ({ platform, url: url.trim() }));
  return { banner: pickStudioBanner(creatorName, rows), avatar: filled(row.avatar_url), bio: filled(row.bio), location: filled(row.location),
    socials, gestionado: row.gestionado === true };
}

/** Lo que el autor (o el equipo, en un perfil gestionado) rellenó en Mi Estudio manda; lo que dejó vacío sigue como estaba. */
export function applyStudioProfile(profile: CreatorProfile, overlay: StudioProfileOverlay | null): CreatorProfile {
  if (!overlay) return profile;
  return {
    ...profile,
    imagen_portada: overlay.banner ?? profile.imagen_portada,
    foto_perfil: overlay.avatar ?? profile.foto_perfil,
    bio: overlay.bio ?? profile.bio,
    nacionalidad: overlay.location ?? profile.nacionalidad,
    redes_sociales: overlay.socials.length ? overlay.socials : profile.redes_sociales,
    gestionado: overlay.gestionado,
  };
}

/** Etiqueta de la caché de las páginas públicas de creador: se invalida al cambiar el banner en Mi Estudio. */
export const CREATOR_PROFILES_TAG = "creator-profiles";
