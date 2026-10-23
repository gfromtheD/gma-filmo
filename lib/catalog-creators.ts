import { createHash } from "node:crypto";
import historicalCreators from "@/creators-data.json";
import sourceCreators from "@/lib/data/catalog-creators.json";
import type { ArtistCredit, MovieMedia } from "@/types/catalog";
import type { CreatorProfile } from "@/types/creator";
import { cachedImageUrl } from "@/lib/r2/public-image";

export function creditNameKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function catalogCreditSlug(name: string): string {
  const key = creditNameKey(name);
  const label = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "autor";
  return `catalogo-${label}-${createHash("sha256").update(key).digest("hex").slice(0, 12)}`;
}

// These are public catalog records, independent of authentication accounts.
export const catalogCreators = historicalCreators.map(creator => {
  const source = sourceCreators.find(record => record.slug === creator.slug);
  return { ...creator, ...source };
}).concat(sourceCreators.filter(source => !historicalCreators.some(creator => creator.slug === source.slug)));

export function catalogCredit(name: string, role: string): ArtistCredit {
  const creator = catalogCreators.find(record => creditNameKey(record.name) === creditNameKey(name));
  return { name, role, slug: creator?.slug ?? catalogCreditSlug(name), photoUrl: cachedImageUrl(creator?.r2_photo_url ?? null) };
}

export function creatorShorts(slug: string, films: readonly MovieMedia[]): MovieMedia[] {
  return films.filter(film => film.genre === "Cortometraje" && film.artistas?.some(artist => artist.slug === slug));
}

export function catalogProfile(slug: string, films: readonly MovieMedia[]): CreatorProfile | null {
  const associated = creatorShorts(slug, films);
  if (!associated.length) return null;
  const record = catalogCreators.find(creator => creator.slug === slug);
  const credit = associated.flatMap(film => film.artistas ?? []).find(artist => artist.slug === slug);
  if (!record && !credit) return null;
  return {
    slug, nombre: record?.name ?? credit!.name,
    foto_perfil: cachedImageUrl(record?.r2_photo_url ?? credit?.photoUrl ?? null),
    imagen_portada: null, nacionalidad: null, bio: record?.bio ?? null,
    redes_sociales: record && "social_links" in record ? record.social_links : [],
    donacion_paypal: null, donacion_patreon: null, donacion_bitcoin: null,
    titulos: associated.map(film => film.id),
    editorial: true,
    source_url: record && "source_url" in record ? record.source_url : null,
  };
}

export function completeCatalogProfile(profile: CreatorProfile, catalog: CreatorProfile | null): CreatorProfile {
  if (!catalog) return profile;
  return {
    ...profile,
    foto_perfil: profile.foto_perfil || catalog.foto_perfil,
    bio: profile.bio?.trim() ? profile.bio : catalog.bio,
    redes_sociales: profile.redes_sociales.length ? profile.redes_sociales : catalog.redes_sociales,
    titulos: catalog.titulos,
    editorial: true,
    source_url: catalog.source_url,
  };
}

export function addCatalogCredits(filmSlug: string, credits: readonly ArtistCredit[]): ArtistCredit[] {
  const result = [...credits];
  for (const creator of catalogCreators) {
    if (!("film_slugs" in creator) || !creator.film_slugs.includes(filmSlug)) continue;
    const index = result.findIndex(credit => credit.slug === creator.slug);
    if (index >= 0) {
      const credit = result[index]!;
      if (!credit.role) result[index] = { ...credit, role: creator.role ?? "" };
    } else {
      result.push({ name: creator.name, slug: creator.slug, role: creator.role ?? "", photoUrl: cachedImageUrl(creator.r2_photo_url) });
    }
  }
  return result;
}

export function keepCreatorLinks(items: readonly MovieMedia[], catalog: readonly MovieMedia[]): MovieMedia[] {
  const eligible = new Set(catalog.filter(film => film.genre === "Cortometraje").flatMap(film => film.artistas ?? []).map(credit => credit.slug));
  return items.map(film => ({ ...film, artistas: film.artistas?.map(credit => ({ ...credit, slug: credit.slug && eligible.has(credit.slug) ? credit.slug : null })) }));
}
