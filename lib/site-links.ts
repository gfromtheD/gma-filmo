import { socialUrl } from "@/lib/social-links";

/**
 * Redes oficiales de GMA Filmo / Generación Maldita para el pie de página.
 *
 * X e Instagram son las que enlaza la web de Generación Maldita (generacionmaldita.com). TikTok y YouTube se activan
 * al definir `NEXT_PUBLIC_SOCIAL_TIKTOK` y `NEXT_PUBLIC_SOCIAL_YOUTUBE` (usuario con @ o dirección completa): hasta
 * entonces el icono se muestra apagado y sin enlace («próximamente»), para no enlazar a cuentas que no sean las
 * oficiales. Cualquier valor se valida igual que las redes de los perfiles (solo https y solo el dominio de esa red).
 */
export type SiteSocialKey = "x" | "instagram" | "tiktok" | "youtube";

export interface SiteSocial {
  readonly key: SiteSocialKey;
  readonly label: string;
  /** Dirección de la cuenta; `null` mientras la red no tenga cuenta configurada. */
  readonly href: string | null;
}

const SOCIAL_LABELS: Record<SiteSocialKey, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/** Valor configurado de cada red (X e Instagram fijos; TikTok y YouTube por variable de entorno). */
function configuredSocials(): Record<SiteSocialKey, string | undefined> {
  return {
    x: "https://x.com/GenArtMal",
    instagram: "https://www.instagram.com/genartmal/",
    tiktok: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK,
    youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE,
  };
}

/** Las cuatro redes en orden fijo; las que no tienen una dirección válida llevan `href: null`. */
export function getSiteSocials(values: Record<SiteSocialKey, string | undefined> = configuredSocials()): SiteSocial[] {
  const order: SiteSocialKey[] = ["x", "instagram", "tiktok", "youtube"];
  return order.map((key) => {
    const value = values[key];
    return { key, label: SOCIAL_LABELS[key], href: value ? socialUrl(key, value) : null };
  });
}
