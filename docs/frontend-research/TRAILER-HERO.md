# Tráiler en el hero de portada

> Fecha: 2026-10-13 · rama `experiment/filmin-layout`.

## Qué hace ya (parte visual, implementada)

El hero de la portada admite un tráiler **opcional** (`trailerUrl` en `MediaBase`, `types/catalog.ts`):

- **Sin tráiler:** no hay vídeo ni botón. Igual que antes.
- **Con tráiler:** se muestra la portada ~3 s (`TRAILER_DELAY_MS`) y luego el vídeo se funde encima
  (silenciado, `playsInline`). Solo entonces aparece el botón **pausa/play** (abajo a la derecha).
- Mientras suena, el carrusel **no cambia de diapositiva**; al terminar vuelve la imagen, el botón pasa a «play»
  (para repetir) y el carrusel avanza a la siguiente.
- **Respeta al usuario:** no arranca solo si «Reproducir vistas previas» está desactivado en Ajustes (`autoPreviews`),
  si el sistema pide menos movimiento o si hay ahorro de datos; en esos casos el tráiler queda **disponible a petición**
  con el botón de play.
- Si el vídeo falla (404, formato), se oculta el vídeo y el botón: se queda la portada.
- Archivos: `hooks/use-hero-trailer.ts`, `components/features/home/home-hero.tsx`, `home-screen.tsx`, `types/catalog.ts`.

## Verificación

Probado con una página temporal (ya eliminada) que genera un vídeo en el navegador: sin tráiler (nunca hay botón),
con tráiler (retraso, pausa, reanudar, fin y repetir, un único aviso de fin), tráiler roto, vistas previas desactivadas
y movimiento reducido. Una prueba detectó un bucle en el aviso de fin y se corrigió. **No hay prueba E2E permanente**
porque hoy ningún título del catálogo trae tráiler.

## Lo que falta: el dato (NO implementado, requiere autorización)

Hallazgos verificados en el código:

1. **Studio ya permite subir el tráiler** (`studio-upload-orbital.tsx`, hueco «Añade el tráiler»; `assetUrls["trailer"]`;
   un interruptor que promete «se reproducirá automáticamente cuando tu título aparezca en el carrusel»).
2. **Pero al publicar se descarta**: el payload de publicación (`studio-upload-view.tsx`) solo envía vídeo, póster y
   subtítulos; la función SQL `publish_creator_pelicula` y la tabla `peliculas` no tienen campo de tráiler.
   Hoy un creador sube un tráiler y nunca llega al catálogo.

Para completarlo harían falta cambios en zonas sensibles (Studio, API de publicación, migraciones y consultas):

| Paso | Dónde | Riesgo |
|---|---|---|
| Columna `peliculas.r2_trailer_url` + parámetro `p_r2_trailer_url` en la función de publicación | `supabase/migrations/` | Alto (modelo de datos) |
| Aceptar y validar la URL en el servidor (debe pertenecer al prefijo R2 del creador) | API de publicación | Alto |
| Enviar `assetUrls["trailer"]` solo si el interruptor está activo | Studio | Alto |
| Mapear `trailerUrl: p.r2_trailer_url ?? undefined` | `lib/supabase/queries.ts` | Medio |

**Recomendación:** hacerlo tras integrar el paquete del Mac, sobre sus contratos neutrales (`mediaId`/`playbackRef`),
porque reescribe precisamente Studio, subidas y reproducción; hacerlo ahora duplicaría trabajo y generaría conflictos.
