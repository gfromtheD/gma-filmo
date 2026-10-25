/** Instagram de GMA (el mismo del pie de la web): contacto mientras no haya un correo propio. */
const FALLBACK_CONTACT = "https://www.instagram.com/genartmal/";

/**
 * Cómo pide un autor el traspaso de su perfil gestionado (ver docs/DIRECTORES-GESTIONADOS.md): un correo al equipo si
 * `NEXT_PUBLIC_GMA_CONTACT_EMAIL` está configurado, con el asunto ya escrito; si no, el Instagram de GMA.
 */
export function claimHref(creatorName: string, email = process.env.NEXT_PUBLIC_GMA_CONTACT_EMAIL): string {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return FALLBACK_CONTACT;
  const subject = encodeURIComponent(`Reclamar mi perfil de GMA Filmo: ${creatorName}`);
  return `mailto:${email}?subject=${subject}`;
}
