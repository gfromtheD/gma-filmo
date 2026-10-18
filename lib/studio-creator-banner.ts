import { creditNameKey } from "@/lib/catalog-creators";

export interface StudioCreatorRow {
  readonly creator_name: string | null;
  readonly studio_name: string | null;
  readonly banner_url: string | null;
}

/**
 * La página pública de un creador sale de los créditos del catálogo, no de su cuenta del estudio. Entre las cuentas que
 * subieron sus obras, elige la que corresponde a esta página: la que tiene su mismo nombre artístico o de estudio.
 * Así el banner del autor de una obra no aparece en la página de otra persona del reparto.
 */
export function pickStudioBanner(creatorName: string, rows: readonly StudioCreatorRow[]): string | null {
  const key = creditNameKey(creatorName);
  const match = rows.find((row) => row.banner_url && [row.creator_name, row.studio_name].some((name) => name && creditNameKey(name) === key));
  return match?.banner_url ?? null;
}

/** Etiqueta de la caché de las páginas públicas de creador: se invalida al cambiar el banner en Mi Estudio. */
export const CREATOR_PROFILES_TAG = "creator-profiles";
