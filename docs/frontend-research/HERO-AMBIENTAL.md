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

## Medidas en vivo del carrusel de la referencia (segunda pasada)
- Cambio automático cada **8 s** (cambios medidos a 10,1 s, 18,2 s…); **no se pausa** al pasar el ratón.
- Indicador (solo escritorio, abajo a la derecha: `bottom: 128px; right: 64px`, huecos de 8 px): puntos de
  8×8 blancos; el activo mide 32×8 (blanco al 30 %) y contiene una barra blanca que se llena con
  `scaleX(0→1)` en 8 s lineales (origen izquierdo). El ancho anima 0,3 s (`cubic-bezier(.4,0,.2,1)`).
- Fundido cruzado de ~1 s: la diapositiva saliente convive ~1 s con la entrante.
- Fondo: capa fija (#050505) con la portada activa ampliada ×1,2 y desenfocada 80 px al 50 % (fundido 1 s) y,
  encima, una franja superior (~48 vh) desenfocada 50 px con máscara que se desvanece hacia abajo.
  Los colores del tema no cambian entre diapositivas: el tinte lo da solo la portada desenfocada.
- Secciones: título 20 px/600 (blanco al 90 %), 16 px hasta la fila, fila con 16 px arriba y 40 px abajo
  de relleno, 48 px entre el final de una fila y el siguiente título; bordes de la fila difuminados
  (máscara al 5 % por cada lado). Carteles 200×300 con 16 px de hueco (en GMA se mantienen apaisados).
- Imagen del hero anclada arriba (`object-position: top`).

## Aplicado en GMA
`hero-indicator.tsx` (puntos + llenado de 8 s que dispara el avance), fundido cruzado con copia saliente,
segunda capa ambiental, imagen anclada arriba, título/espaciado de filas y máscara de bordes en `Carousel`.
Se mantienen: tarjetas apaisadas con tarjeta desplegable al pasar el ratón, textos y botones del hero.

## Segunda revisión (2026-10-31): por qué se notaba demasiado
Medido otra vez en la referencia con el DOM vivo. Lo que se había copiado mal:
- **La franja superior no va a plena opacidad.** En la referencia vive dentro de un contenedor `.ambient-bleed` con
  `mix-blend-mode: screen` y `opacity: .2` (solo en escritorio, `lg`), no al 100 %. Nosotros la poníamos entera, y era justo la
  capa que más teñía el hero y la cabecera. Ahora entra al 20 % con mezcla «screen».
- **El cambio es un cruce de capas, no una entrada sobre una capa fija.** En la referencia cada portada es su propia capa y las
  dos se cruzan por `opacity` (la que sale baja a la vez que la que entra sube, `1 s cubic-bezier(.4,0,.2,1)`); a mitad del
  cambio el color pasa por un tono intermedio más oscuro. Nosotros dejábamos la vieja al 100 % debajo y fundíamos la nueva
  encima, lo que se leía como un salto de color. Ahora son dos capas que se cruzan, y el fundido dura 1,6 s para que el
  cambio sea más tranquilo que el del hero (que sigue en 1 s).
- Los 80 px de desenfoque, el ×1,2 y el 50 % de opacidad de la capa grande ya coincidían y no se tocan.
- La capa nueva se enciende con un temporizador de 40 ms (no con `requestAnimationFrame`) para que el fundido también ocurra
  en pestañas en segundo plano; la capa actual nunca se retira.
