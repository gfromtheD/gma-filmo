# Mapa de media de GMA Filmo

Qué le pedimos al creador, dónde se guarda cada cosa y con qué límites. Las reglas viven en el servidor
(`gma_media_reserve` en Supabase); la pantalla de Mi Estudio enseña los mismos números.

## Dónde va cada cosa

| Qué sube el creador | Rol en el motor | Dónde se guarda | Cómo se sirve |
|---|---|---|---|
| Datos de la ficha (título, sinopsis, créditos…) | — | Supabase (texto) | Directo de la base de datos |
| Película o corto | `main` | VPS · PeerTube | HLS por la pasarela (`/playback`) |
| Tráiler | `trailer` | VPS · PeerTube | HLS por la pasarela |
| Vídeos extra | `extras` | VPS · PeerTube | HLS por la pasarela |
| Póster vertical / horizontal | `poster_v` / `poster_h` | R2 (bucket privado) | `/api/media/<id>`, con caché pública si la obra está publicada |
| Imágenes extra | `extra_image` | R2 | `/api/media/<id>` |
| Subtítulos (.srt) | `subtitles` | R2 | `/api/media/<id>` |
| Avatar / banner del perfil | `avatar` / `banner` | R2 | `/api/media/<id>` |

Regla: **todo lo que es vídeo va al VPS; todo lo que no es vídeo va a R2.** El navegador sube directo a su destino
(vídeo a la pasarela del VPS, imágenes a R2 con una URL firmada de 1 h); Vercel solo reserva y firma.

## Límites por obra

| Qué | Máximo por archivo | Duración máx. | Cuántos |
|---|---|---|---|
| Película o corto | 4 GB | 4 h | 1 |
| Tráiler | 1 GB | 10 min | 1 |
| Vídeo extra | 1 GB | 1 h | hasta 12 extras en total (imágenes + vídeos) |
| Imagen extra | 10 MB | — | (cuenta dentro de los 12 extras) |
| Póster vertical / horizontal | 10 MB | — | 1 de cada |
| Subtítulos | 5 MB | — | 5 idiomas |
| **Toda la obra** | **6 GB** | | |
| **Toda la cuenta** | **10 GB** | | 6 subidas a la vez |

El tope de 12 extras y 5 subtítulos se comprueba en el servidor (`UPLOAD_SLOT_LIMIT`) desde la migración
`20261103_media_slot_limits.sql`; antes solo lo frenaba la pantalla.

## Qué pasa con un vídeo en el VPS

PeerTube lo convierte a HLS en 720p y 360p (`/var/www/peertube/config/production.yaml`, bloque `transcoding`).
El original no se guarda (`original_file.keep: false`).

## Borrado

Al borrar una obra desaparece de la vista al momento (salida animada). Por detrás, en segundos: el vídeo se borra de
PeerTube y las imágenes de R2 (se marca su clave final y se quita su `ingest/`). El bucket privado tiene la regla de ciclo
de vida `gma-ingest-expira-3-dias`: cualquier objeto bajo `ingest/` con más de 3 días se borra solo, así que una URL de
subida reutilizada después de borrar no deja nada para siempre.
