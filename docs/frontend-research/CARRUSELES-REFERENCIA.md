# Carruseles de la portada — medidas de una referencia pública (2026-10-14)

Solo geometría y comportamiento (sin copiar código, textos ni imágenes). Viewport 1440×900; el contenido
va con 96 px de margen lateral (ancho útil 1248).

## Cabecera de sección
- Barra de acento vertical de ~3 px a la izquierda; título a 13 px de la barra: 24 px/600/lh 32, color #EEF1F6.
- Subtítulo 14 px/400, color #8A94A6, 2 px bajo el título. Bloque título+subtítulo ≈ 54 px.
- Algunos títulos son enlaces con un chevrón `>` al final.
- 20 px entre el bloque de título y la fila; 64 px entre el final de una fila y el siguiente título.

## Filas apaisadas (16:9)
- Celda de 320 px (arte 316×~178 con 2 px de margen), hueco de 6 px, radio 8 px.
- Debajo: título 13 px/500 (una línea, recortada) a 10 px del arte; meta 11 px #8A94A6
  (★ nota · año/episodio · tipo) separada por puntos al 20 % de blanco.
- Etiquetas rojas pequeñas abajo a la derecha del arte ("Nueva temporada").
- Hover: la imagen hace zoom ×1,06, el título pasa al color de acento y, a los ~1,5–2 s, se reproduce el
  tráiler (si existe) dentro del mismo recuadro, algo ampliado, con icono de silencio arriba a la derecha.
  Al sacar el cursor vuelve la portada.

## Top 10
- Fila con hueco de 8 px. Primera tarjeta ancha 616×300 y el resto verticales 200×300 (formato carátula).
- Tarjeta ancha: fondo con la imagen, velo en degradado desde la izquierda
  (`90deg, rgba(5,7,10,.94) 0% → .78 48% → .42 78% → .08 100%`), insignia de posición 30×36 arriba a la izquierda
  ("TOP" 8 px/800 sobre el número 13 px/800), logo 250×52, reparto 12 px #8A94A6, sinopsis 12,5 px
  (72 % de blanco, ancho 474), botón de tráiler 86×32 (12,5 px/600).
- Debajo de cada tarjeta, el mismo título + meta que en las filas.
- Hover en una vertical: el título debajo pasa al color de acento.

## Tarjetas de género / colección
- 268×150,8, radio 12 px, hueco de 10 px. Imagen a pantalla completa + velo:
  `linear-gradient(90deg, acento 0%, acento/.72 32%, acento/.18 68%, transparente 100%)` más
  `linear-gradient(transparente 42%, rgba(0,0,0,.45) 100%)`. El acento es un color por tarjeta.
- Etiqueta 17 px/700 blanca abajo a la izquierda (14 px de margen).
