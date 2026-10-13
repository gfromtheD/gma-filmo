# Filmin en móvil — medidas observadas (2026-10-14)

Método: páginas públicas de filmin.es abiertas en un contexto de navegador aislado, emulando un
iPhone (390×844, DPR 3, táctil). Cookies rechazadas, sin sesión. Solo se midieron geometría y
tipografía renderizadas (posiciones, tamaños, espaciados); no se copia código, textos ni imágenes.

Anchura de maquetación observada: 400 px. Todas las cotas son px CSS; las columnas son
porcentajes del ancho útil, así que escalan a cualquier móvil.

## Cabecera
- Alto 56 px, padding lateral 16 px, transparente sobre el hero en portada; sólida en el resto.
- Izquierda: hamburguesa 24 px (x16) → logo (x56, 64×18). Derecha: lupa 24 px y botón CTA 120×32
  (14 px/800, radio 4, verde, texto oscuro) pegado al margen derecho de 16 px.
- Menú lateral: panel de 288 px desde la izquierda. Cabecera con cierre 24 px y logo; botón CTA
  256×40 (y64) y "Iniciar sesión" 256×40 (y116), ambos 16 px/800 radio 4; luego lista de enlaces
  de 57 px de alto (16 px/400) desde y172; enlaces secundarios de 16 px de alto con 16 px de
  separación al final.

## Filas de carátulas (portada)
- Título de fila: 18 px/700, interlineado 22,5; padding lateral 16; 24 px hasta la fila.
- Separación entre el final de una fila y el título de la siguiente: 48 px.
- Contenedor de fila: scroll horizontal, `scroll-snap-type: x mandatory`, padding lateral 12,
  scroll-padding 12, sin barra visible.
- Cada celda lleva 4 px de padding por lado (huecos de 8 px entre tarjetas; la primera tarjeta
  arranca a 16 px, alineada con el título).
- Cuatro formatos, anchura de celda = fracción del ancho útil (ancho − 24):
  - Cartel alto: 1/2 → tarjeta ≈ 180×360 (proporción 1:2), radio 4.
  - Panorámica grande: 1/1 → tarjeta ≈ 368×207 (16:9), radio 4. Asoma 12 px de la siguiente.
  - Cartel pequeño: 1/3 → tarjeta ≈ 117×176 (2:3), radio 4. Tres a la vista + asomo.
  - Panorámica pequeña: 1/2 → tarjeta ≈ 180×101 (16:9), radio 3.
- Sin flechas en móvil (solo gesto).

## Hero de portada (visitante)
- Título 46 px/800, interlineado 1,125, centrado; subtítulo 16/24 centrado; botón principal
  ancho completo menos 2×32 de margen; texto secundario 14/21.

## Ficha de película
- Hero 16:9 a ancho completo bajo la cabecera (≈225 px), con degradado hacia el fondo.
- Nota: cuadro 40×40, borde 1 px, radio 3, 18/800, en x16; a su derecha (x64) votos y etiqueta
  16/24. Título 32/800, interlineado 36, a ~60 px bajo el hero.
- Dirección y géneros 18/27; año y duración 16/24; chips 12 px, alto ~24, padding ~8, huecos 8.
- Botón principal a ancho completo (368) y 56 de alto, 20/800 mayúsculas, radio 4; botón
  secundario idéntico (fondo gris azulado #242432) 8 px debajo.
- Acciones Guardar/Valorar/Compartir: 3 columnas centradas, icono sobre etiqueta de 12 px.
- Pestañas: 16/800 mayúsculas, alto 59, subrayado verde de 3 px en la activa, scroll horizontal.

## Catálogo
- Rejilla de 1 columna: tarjetas 368×207 (16:9) con 8 px de separación vertical.
- Filtros: selectores a ancho completo, 52 de alto, fondo #242432, radio 4, 16 px de separación.
- Segmentado Todo/Suscripción/Alquiler (36 de alto) y selector de orden (40 de alto).
