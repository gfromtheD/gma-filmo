import { creditNameKey } from "@/lib/catalog-creators";
import { pickStudioProfile, type StudioCreatorRow } from "@/lib/studio-creator-banner";
import type { ArtistCredit, MovieMedia } from "@/types/catalog";
import type { CreatorProfile } from "@/types/creator";

/**
 * Identidad del creador: la cuenta (`auth.users.id`) es la verdad y su ficha (`creator_profiles`) tiene un slug propio y
 * estable (migración 20261120). La página pública y los créditos se asocian por ese id, nunca por coincidencia de nombre.
 */
export interface AccountCreator {
  readonly userId: string;
  readonly slug: string;
  readonly name: string;
}

/** Ficha de creador tal y como la devuelve la base (solo lo que usa la página pública). */
export interface AccountCreatorRow extends StudioCreatorRow {
  readonly user_id: string;
  readonly slug: string | null;
}

/**
 * En una obra de esta cuenta, el crédito que lleva el nombre del creador enlaza con la página de la cuenta (slug propio). Los
 * demás créditos (reparto, colaboradores) no se tocan: solo la cuenta puede decir quién es su titular.
 */
export function linkAccountCredits(credits: readonly ArtistCredit[], owner: Pick<AccountCreator, "slug" | "name"> | undefined): ArtistCredit[] {
  if (!owner) return [...credits];
  const ownerKey = creditNameKey(owner.name);
  return credits.map((credit) => (creditNameKey(credit.name) === ownerKey ? { ...credit, slug: owner.slug } : credit));
}

/** Obras de la página: las acreditadas por nombre en el catálogo más las que subió la cuenta, sin repetir y en el orden del catálogo. */
export function mergeCreatorWorks(films: readonly MovieMedia[], credited: readonly MovieMedia[], ownedSlugs: ReadonlySet<string>): MovieMedia[] {
  const creditedIds = new Set(credited.map((film) => film.id));
  return films.filter((film) => creditedIds.has(film.id) || ownedSlugs.has(film.id));
}

/** Perfil mínimo de una cuenta sin entrada en el catálogo histórico: nombre, foto y bio de su ficha; la ficha completa se superpone después. */
export function accountProfile(row: AccountCreatorRow, slug: string, filmIds: readonly string[]): CreatorProfile {
  return {
    slug, nombre: row.creator_name?.trim() || row.studio_name?.trim() || "Creador",
    foto_perfil: row.avatar_url ?? null, imagen_portada: null, nacionalidad: null, bio: row.bio ?? null,
    redes_sociales: [], donacion_paypal: null, donacion_patreon: null, donacion_bitcoin: null, titulos: filmIds,
  };
}

/** La ficha de Mi Estudio de esa cuenta. Al conocer la cuenta por su id, ya no hace falta comparar nombres. */
export function accountOverlay(row: AccountCreatorRow) {
  return pickStudioProfile(row.creator_name ?? row.studio_name ?? "", [row]);
}
