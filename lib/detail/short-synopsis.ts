/** Longitud máxima de la frase corta que acompaña al título en la cabecera de la ficha. */
export const SHORT_SYNOPSIS_MAX = 180;

/**
 * Frase corta de la cabecera. Prioridad:
 *  1. la frase corta que escribió el creador (`tagline`);
 *  2. la sinopsis entera, si ya es corta;
 *  3. las primeras frases de la sinopsis que quepan, cortando en punto o, si no, por palabra con «…».
 * La sinopsis completa va siempre en la tarjeta «Sinopsis».
 */
export function shortSynopsis(synopsis: string, tagline?: string): string {
  const own = tagline?.trim();
  if (own) return own;

  const text = synopsis.trim();
  if (text.length <= SHORT_SYNOPSIS_MAX) return text;

  const sentences = text.match(/[^.!?…]+[.!?…]+(?:\s|$)/g)?.map((s) => s.trim()) ?? [];
  let result = "";
  for (const sentence of sentences) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length > SHORT_SYNOPSIS_MAX) break;
    result = next;
  }
  if (result) return result;

  const room = SHORT_SYNOPSIS_MAX - 1;
  const cut = text.slice(0, room);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
