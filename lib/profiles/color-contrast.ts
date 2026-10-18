/**
 * Contraste de texto sobre el color de un perfil (WCAG 2): decide si encima va texto oscuro o claro.
 * Lógica pura, sin React: la usan la inicial del avatar, la marca del color elegido y la animación de bienvenida.
 */

/** Luminancia relativa de un color «#rrggbb»; `null` si no es un hexadecimal de 6 cifras. */
export function relativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(match[1]!.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** `true` si el texto oscuro contrasta más que el blanco sobre `background` (o si el color no se puede leer). */
export function prefersDarkText(background: string): boolean {
  const luminance = relativeLuminance(background);
  if (luminance === null) return true;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05);
}

/** Elige entre dos colores de texto según el fondo. */
export function readableOn<T extends string>(background: string, dark: T, light: T): T {
  return prefersDarkText(background) ? dark : light;
}
