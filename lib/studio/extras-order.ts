/**
 * Intercambia un elemento con su vecino sin tocar la lista original. El tráiler no se mueve ni deja que otro le pase por delante.
 */
export function moveItem<T extends { readonly role?: string }>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const moving = list[index];
  const other = list[target];
  if (!moving || !other || moving.role === "trailer" || other.role === "trailer") return [...list];
  const next = [...list];
  next[index] = other;
  next[target] = moving;
  return next;
}
