# Hero con resplandor ambiental (2026-10-14)

Referencia observada (solo geometría y comportamiento; sin copiar código, textos ni imágenes): hero
de un servicio de streaming público.

## Qué hace la referencia
- Hero de 85vh a ancho completo, sin barra opaca en cabecera.
- La imagen es más alta que el hero (≈ +20vh) y lleva una máscara vertical (opaca hasta el 40 %,
  transparente al 98 %): su base se desvanece hacia lo que hay detrás.
- Detrás de toda la página hay una capa fija a pantalla completa con la portada de la diapositiva
  activa, muy desenfocada (≈ 80 px), ampliada ×1,2 y al 50 % de opacidad; cambia con fundido de ~1 s.
- Las filas flotan sobre ese "cristal" teñido; el color de la plataforma cambia suavemente con
  cada diapositiva sin ocultar las portadas.
- Degradados de legibilidad suaves (negro al 40 %) hacia abajo y hacia la derecha.

## Cómo se aplica en GMA
- `components/features/home/ambient-backdrop.tsx`: capa fija con la portada activa desenfocada;
  fundido de 1 s entre diapositivas; sin imagen usa el degradado del póster.
- `components/features/home/home-hero.tsx`: hero de `clamp(520px, 85vh, 900px)`; imagen (y tráiler)
  en una capa `calc(100% + 20vh)` con máscara; los degradados de legibilidad viven dentro de esa capa.
- `components/features/home/home-screen.tsx`: monta la capa ambiental y eleva las filas (`z-[1]`).
- Se mantienen títulos, botones, etiqueta, flechas y la lógica de tráiler del hero.
