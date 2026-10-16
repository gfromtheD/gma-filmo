# GMA Filmo — Estado actual del Windows para integrar el motor multimedia del Mac

> Documento de traspaso para el agente que integre el motor multimedia del Mac (Codex u otro) sin perder el trabajo hecho en Windows.
> Captura: **2026-10-16, ~12:00 (hora de España)**. Autor: Claude Code en el equipo Windows.
> Este encargo es **solo documentación**: no se ha hecho merge, commit, push, despliegue ni cambio funcional. Lo único que se ha escrito en el repo es este archivo.
> Regla de la integración: **las dos líneas se conservan y ninguna pisa a la otra.**

**Leyenda de estado** (se usa en todo el documento):

| Marca | Significado |
|---|---|
| **IMPLEMENTADO** | Funciona de verdad contra servidor/base de datos en local. |
| **SIMULADO** | La interfaz existe y responde, pero no guarda ni envía nada real (o muestra un aviso en su lugar). |
| **PENDIENTE** | No existe todavía o está deliberadamente sin conectar. |
| **DESPLEGADO** | Está en `main` de GitHub, que es la rama de la que despliega Vercel. |

**Leyenda de verificación**: **[V]** verificado por comando o lectura de código en este equipo · **[R]** dicho por notas previas del proyecto o por el paquete del Mac, sin re-ejecutar · **[I]** inferencia razonada · **[P]** pendiente de comprobar.

---

## 0. Resumen

1. [V] El trabajo vivo de Windows **no está en `feature/frontend-windows`**: esa rama (`3df25c9`) ya está entera dentro de `main`. Lo vigente es `main` (`a0ff76a`, igual a GitHub) + rama local `trabajo-local` (+2 commits) + **203 entradas sin commitear** (contando este documento; 236 archivos uno a uno).
2. [V] Esos cambios sin commitear no están en ningún commit ni en GitHub: son lo más frágil del proyecto. Además, **se sigue trabajando sobre ellos**: durante la captura apareció un archivo nuevo (`components/features/studio/upload/processing-bucket.tsx`).
3. [V] **Mi Estudio** tiene una pasarela de subida nueva de tres pasos que **simula** la subida por defecto. Se conecta a un motor a través de la interfaz `UploadEngine` de `lib/studio/engine.ts`, pensada para enchufar el motor del Mac.
4. [V] El frontend que el Mac desplegó el 4 y 5 de octubre **ya está en Windows**: entró en el commit `5d093fc`, que equivale al `93fbea0` del Mac. Del Mac solo falta el motor: 3 commits más 99 cambios sin commitear.
5. [V] En una fusión simulada fuera del repo salen **11 archivos en conflicto**. El choque principal está en la subida de Studio: Windows borró las dos pantallas donde el Mac conectó su motor.
6. [V] `npx tsc --noEmit` pasa sin errores y **293 de 293** pruebas unitarias pasan (`e2e/unit`). Las suites E2E de navegador no se han ejecutado en esta captura.

---

## 1. Estado Git

### 1.1 Dónde está cada cosa

| Qué | Valor | Notas |
|---|---|---|
| Repo real | `C:\Users\gfrom\Desktop\Apps web\GMA\streaming-app` | [V] El `.git` de `C:\Users\gfrom` es ajeno al proyecto. |
| Rama actual | `trabajo-local` | [V] |
| HEAD | `1d31150` (2026-10-15, «style: centrar la fila de pestañas de la ficha») | [V] |
| `main` / `origin/main` | `a0ff76a` (2026-10-14, merge del PR #9) | [V] `trabajo-local` = `main` + 2. |
| Remoto | `origin` = `https://github.com/gfromtheD/gma-filmo.git` | [V] |
| Worktree de pruebas | `GMA\streaming-app-base`, rama `feature/extras` (`1d31150`) | [V] Copia donde se ejecutan las suites Playwright en el puerto 3100. Tiene cambios sin commitear **parecidos pero no idénticos**: es una copia de pruebas sin limpiar y **no es fuente de verdad**. |
| Servidor de desarrollo del usuario | `npm run dev` en `streaming-app`, `http://localhost:3000` | [V] Arrancado. **No pararlo ni ejecutar en esa carpeta suites que lancen su propio `next dev`**: pisan `.next` y dejan la web sin estilos [R]. |
| Supabase usado | Proyecto real (`NEXT_PUBLIC_SUPABASE_URL` = `https://zeod….supabase.co`) | [V] No hay Supabase local en Windows. |
| `core.autocrlf` | `true` (configuración del sistema de Git) | [V] El Mac usa LF; Git normaliza al hacer commit. |

### 1.2 Ramas locales

| Rama | Commit | Respecto a `main` | Comentario |
|---|---|---|---|
| `main` | `a0ff76a` | = | PR #1 a #9 fusionados. **DESPLEGADO** [I]. |
| `trabajo-local` | `1d31150` | +2 | Extras de la ficha. **No desplegado.** |
| `feature/extras` | `1d31150` | +2 | Misma punta; la usa el worktree de pruebas. |
| `feature/frontend-windows` | `3df25c9` | 0 / −60 | **Obsoleta, ya fusionada.** No partir de ella. |
| `verif-pildora` | `08fbd8a` | dentro de `main` | Verificación del PR #9; su remoto ya no existe. |
| `feature/auth-creator-spec` | `6dda5f9` | dentro de `main` | Antigua. Conservar sin tocar. |
| `worktree-agent-a87e353878fa6f166` | `c5a5265` | dentro de `main` | Antigua. Conservar sin tocar. |

### 1.3 Commits recientes (`git log -12 trabajo-local`) [V]

```
1d31150 2026-10-15 style: centrar la fila de pestañas de la ficha
90463fd 2026-10-15 feat: pestaña Extras en la ficha con tabla pelicula_extras y API
a0ff76a 2026-10-14 Merge pull request #9 (ajuste/pildora-movil)
8bf57b0 2026-10-14 Merge pull request #8 (integracion/movil-y-carruseles)
eabf71c 2026-10-14 Merge pull request #7 (ajuste/titulos-pestana)
a7651eb 2026-10-14 Merge pull request #6 (ajuste/hero-ambiental)
07bd9d7 2026-10-14 fix(tarjetas): oculta la clasificación por edad hasta tener el dato real
e74fecb 2026-10-14 feat(portadas): quita la etiqueta Cortometraje sobre el título de los cortos
1e3ac2a 2026-10-14 feat(home): barra de navegación centrada e indicador del hero centrado abajo
ea8c1a1 2026-10-14 feat(home): carrusel del hero (8 s, indicador de llenado, fundido cruzado)
622a9fb 2026-10-14 feat(home): hero ambiental
08fbd8a 2026-10-14 feat(movil): navegación inferior como píldora oscura flotante
```

Desde la base común con el Mac (`41494c6`, 2026-08-14) hay **81 commits** (175 rutas). El más importante para la integración es **`5d093fc`**, el snapshot del código de producción (despliegue `dpl_8ugmL4ndfFspXcLactKCPMvZoLy4`, rama `mejora/temas-secundarios` del Mac).

### 1.4 Árbol sin commitear [V]

`git status --short` da 203 entradas: 102 modificados, 3 borrados en el índice (`catalog-filter-drawer.tsx`, `studio-upload-orbital.tsx`, `studio-upload-view.tsx`), 1 borrado sin indexar (`search-aurora.tsx`) y 97 rutas nuevas (algunas son carpetas; incluye este documento). El detalle por áreas está en el §6.

---

## 2. Cambios hechos por Claude Code en Windows

Todo lo que contiene la línea de Windows desde `41494c6`, salvo el snapshot `5d093fc` (código del Mac), lo ha hecho Claude Code en este equipo. El registro histórico detallado (hasta el 13 de octubre) está en `docs/handoff/FRONTEND-WINDOWS-PARALLEL.md`.

| Bloque | Estado | Dónde está | Archivos principales |
|---|---|---|---|
| Fondo ThreeDMarquee en «Próximamente» | DESPLEGADO | `main` | `components/features/catalog/coming-soon-screen.tsx` |
| Navbar responsive y accesible (Fase B) | DESPLEGADO | `main` | `components/layout/navbar.tsx`, `navbar-parts/*` (avatares, marca, menú de cuenta, fila de pestañas de Studio), variable CSS `--gma-header-h` |
| Distribución estilo Filmin (cabecera, hero, filas, catálogo, ficha) | DESPLEGADO | `main` (PR #2 a #4) | `components/features/home/*`, `catalog/*`, `detail/*`, `components/ui/carousel.tsx`, `poster-card.*` |
| Vista previa flotante al pasar el ratón | DESPLEGADO | `main` | `components/ui/hover-preview-card.tsx`, `hooks/use-hover-preview.ts`, `lib/hover-preview-layout.ts` |
| Buscador nuevo (tolerante a tildes y erratas, historial) | DESPLEGADO | `main` | `components/features/search/*`, `lib/search/*`, `hooks/use-recent-searches.ts` |
| Valoraciones 1 a 10 y comentarios (borrar propio, denunciar) | DESPLEGADO (la migración de denuncias [P]) | `main` | `components/features/ratings/*`, `comments/*`, `app/api/comments/report`, `20261013_comment_reports.sql` |
| Guardar en la lista con aviso para invitados | DESPLEGADO | `main` | `hooks/use-watchlist.ts`, `components/ui/notice-toast.tsx` |
| Iconos migrados a Iconoir | DESPLEGADO | `main` (PR #5) | `components/ui/icons.tsx`; `lucide-react` eliminado |
| Móvil: barra inferior en píldora, cabecera compacta | DESPLEGADO | `main` (PR #8, #9) | `components/layout/mobile-tab-bar.tsx`, `lib/scroll-lock.ts` |
| Hero ambiental y carrusel del hero | DESPLEGADO | `main` (PR #6) | `components/features/home/home-hero.tsx`, `ambient-backdrop.tsx`, `hooks/use-hero-trailer.ts` |
| Pestaña Extras en la ficha | IMPLEMENTADO, no desplegado | `trabajo-local` (commit) | `components/features/detail/extras-*`, `app/api/extras`, `hooks/use-extras.ts`, `lib/extras/*`, `20261015_pelicula_extras.sql` |
| Mi Estudio rediseñado y pasarela de subida | IMPLEMENTADO / SIMULADO (ver §4) | sin commitear | `components/features/studio/**`, `lib/studio/**` |
| Avatares unificados, comentarios de comunidad, pie de página, tipografía, filtros… | IMPLEMENTADO, no desplegado | sin commitear | ver §5 y §6 |

---

## 3. Arquitectura frontend actual

- [V] **Stack**: Next.js `^14.2.35` (App Router), React `^18.3.1`, TypeScript `^5`, Tailwind `^4`, `motion` `^12.40.0`, `zustand` `^5.0.13`, Supabase JS `^2.106.1`, iconos `iconoir-react` `^7.12.1` a través de `@/components/ui/icons`. Playwright `^1.60.0` para pruebas.
- [V] **Rutas** (`app/`): `(platform)` con `inicio`, `peliculas`, `series`, `cortos`, `buscador`, `creadores` y el grupo `(protected)`, donde vive `mi-estudio/page.tsx`. Además `(legal)`, `(support)` (página de apoyo a creadores), `ver/[id]` (reproductor), `perfiles`, `configurar-perfil`, `configurar-perfil-creador`, `auth`, `donatest` y `api`.
- [V] **Estado global** (`store/`): `use-studio-tab-store` (pestaña activa de Mi Estudio, compartida con la navbar), `use-footer-hidden-store` (nuevo, sin commitear: oculta el pie durante la subida), `use-profile-store`, `use-session-store`, `use-filter-store`, `use-dm-store`, `use-transition-store`.
- [V] **Capa de datos de catálogo**: `lib/supabase/queries.ts` lee `peliculas` con `select *` + colecciones y artistas, con caché `unstable_cache`. Windows añade `fullSynopsis` (de `lib/data/film-long-synopses.ts`) y `language`.
- [V] **Convenciones de Windows que debe respetar la integración**:
  - Iconos solo desde `@/components/ui/icons` (Iconoir). `lucide-react` ya no está instalado.
  - Tipografía única Satoshi con `next/font/local` (`app/fonts/`). Los `.woff2` no se suben porque la licencia lo prohíbe; están en `.gitignore`.
  - El avatar de un perfil se dibuja siempre con `components/ui/profile-avatar.tsx` y datos resueltos en servidor (`lib/profiles/*`), nunca desde `localStorage` [R].
  - Altura de cabecera en `--gma-header-h` y de barra inferior en `--gma-tabbar-h`.
  - Las pruebas de Playwright usan `reducedMotion: "reduce"`.

---

## 4. Mi Estudio (estado exacto)

Ruta: `app/(platform)/(protected)/mi-estudio/page.tsx` → `components/features/studio/studio-screen.tsx`. Todo Mi Estudio está **sin commitear** salvo lo que ya venía del snapshot de producción.

### 4.1 Estructura

| Componente | Función |
|---|---|
| `studio-screen.tsx` (202 líneas) | Contenedor: carga datos, decide la pestaña, toasts y modal de edición. |
| `studio-sidebar.tsx` (nuevo) | Barra lateral en escritorio con las 4 pestañas (`STUDIO_TABS`). |
| `studio-sub-nav.tsx` | Define `STUDIO_TABS`: `inicio` (Panel), `titulos` (Mis títulos), `subir` (Subir), `perfil` (Perfil). En móvil las pestañas salen en la fila de la cabecera (`navbar-parts/studio-tabs-row.tsx`). |
| `studio-dashboard-view.tsx` | Panel con resumen de títulos. |
| `studio-stats-view.tsx` | Lista de títulos con estado (va debajo del Panel). |
| `studio-titles-view.tsx` | Lista de títulos con menú de acciones por estado. |
| `studio-edit-modal.tsx` | Modal para editar metadatos. |
| `studio-profile-view.tsx` | Perfil del creador: datos, redes y foto. |
| `studio-ui.tsx`, `studio-types.ts`, `studio-data.ts`, `studio-responsive.module.css` | Piezas visuales, tipos, datos vacíos por defecto y estilos responsive. |
| `upload/upload-wizard.tsx` + `upload/*` (nuevo) | Pasarela de subida (§4.3). |

**Borrados** (sin commitear): `studio-upload-view.tsx` y `studio-upload-orbital.tsx`, que eran la subida antigua.

### 4.2 Qué es real, qué está simulado y qué falta

| Funcionalidad | Estado | Detalle verificable |
|---|---|---|
| Carga de perfil y títulos | **IMPLEMENTADO** | Navegador → Supabase: `creator_profiles` (`creator_name, studio_name, bio, location, role, avatar_url, social_links`) y `peliculas` (`slug, title, synopsis, year, duration, genre, language, r2_poster_url, created_at, status`) filtrado por `creator_user_id`. Si falla, muestra error y botón Reintentar. |
| Estado del título | **IMPLEMENTADO** | Mapeo `published→publicado`, `draft→borrador`, `review→revision`, `rejected→rechazado` y, si es otro valor, `borrador`. |
| Eliminar título | **IMPLEMENTADO** | `DELETE /api/titles/:slug` con `Authorization: Bearer <token>`. La ruta usa el cliente admin de servidor. |
| Perfil: guardar datos y redes | **IMPLEMENTADO** | `update` directo de `creator_profiles` desde el navegador. |
| Perfil: foto/logo | **IMPLEMENTADO** | `POST /api/upload/file` (R2) y después `update creator_profiles.avatar_url`. Borrar pone el campo a vacío. |
| Panel: cifras | **IMPLEMENTADO con datos parciales** | Cuenta títulos y publicados reales. Visualizaciones y valoración se muestran como «—»: **no hay datos de demostración**. |
| Estadísticas | **PENDIENTE** | Solo lista títulos y estado. El texto dice que las métricas aún no están disponibles. |
| Despublicar / Enviar a revisión / Retirar de revisión | **SIMULADO** | Solo muestran un toast (`studio-titles-view.tsx`, l. 42, 47 y 55). No llaman a ninguna API. |
| Editar metadatos / Reenviar | **SIMULADO** | `studio-edit-modal.tsx` cierra y muestra un toast; no guarda nada. |
| Portada en la lista | Parcial | Usa `r2_poster_url` si existe; si no, un degradado fijo (`STUDIO_DATA.posters.nieve`). |
| Pasarela de subida | **SIMULADO por defecto** | Ver §4.3. |
| Publicar extras desde Studio | **PENDIENTE** | La ficha ya lee `pelicula_extras`, pero Studio no los publica; depende del motor del Mac [R]. |

### 4.3 Pasarela de subida (`upload/`)

- **Pasos** (`lib/studio/upload-draft.ts`, `UPLOAD_STEPS`): `video` («Sube tu obra»), `ficha` («Crea tu ficha»), `datos` («Completa los detalles»), y después una página de revisión (`review-page.tsx`) con aceptación de condiciones y envío.
- **Borrador** `UploadDraft` (versión 7): vídeo, tráiler, extras (`fotograma | poster | video`), título y título original, duración, país, año, categorías, edad, ópera prima, idioma, subtítulos SRT, imágenes (`poster`, `banner`), sinopsis corta y larga, géneros, temas, equipo (`{name, role}`, director obligatorio), premios, aviso de IA, permitir comentarios y condiciones aceptadas.
- **Validación** (IMPLEMENTADO, en código puro y probado): `reviewDraft()` dice qué falta en cada paso e `isReadyToSubmit()` decide si se puede enviar. Las reglas de archivo están en `lib/studio/file-rules.ts`: vídeo hasta 4 GB por tipo o extensión, imágenes JPG/PNG/GIF hasta 10 MB, SRT hasta 5 MB, y consejo de tamaño de imagen sin bloquear.
- **Guardado** (IMPLEMENTADO, solo navegador): `localStorage`, clave `gma-studio-upload-draft`, con medio segundo de retraso. Al volver, un archivo con `blob:` o que estaba a medias pasa a error con el aviso «Vuelve a subir este archivo» (`lib/studio/draft-storage.ts`).
- **Motor** (`lib/studio/engine.ts`, interfaz `UploadEngine { id, connected, uploadAsset(request, onProgress, signal), submit(draft) }`):
  - `localEngine` (**por defecto**, `connected: false`): **SIMULADO**. Valida, avanza el progreso en 20/45/70/100, simula 3 s de «procesado» en los vídeos (pantalla `processing-bucket.tsx`, cuyos textos son orientativos y no miden nada) y devuelve una URL `blob:` con `localOnly: true`. `submit()` responde `queued`: «Se enviará a revisión en cuanto se conecte el motor de subida». **No se envía nada fuera del navegador.**
  - `legacyEngine` (con `NEXT_PUBLIC_STUDIO_ENGINE=legacy`): **IMPLEMENTADO, sin activar**. Vídeo, tráiler, póster, banner y SRT van a R2 por `POST /api/upload/presign` + `PUT` a la URL prefirmada. El resto de huecos (`extra:*`) se queda en simulado. `submit()` traduce el borrador con `buildLegacyTitlePayload()` y llama a `POST /api/titles`. Si el vídeo no está alojado, devuelve error.
  - **PENDIENTE**: un motor que implemente esta interfaz con el sistema del Mac (§10.4).
- **Huecos de archivo** (`getAsset`/`setAsset`): `video`, `trailer`, `poster`, `banner`, `extra:<n>`, `srt:<n>`. El comentario de `AssetRequest` menciona también `doc:*`, pero el borrador actual no tiene documentos.
- **Hook** `upload/use-asset-uploader.ts`: sube a través del motor, permite cancelar con `AbortController` por hueco y calcula el consejo de tamaño de imagen.

### 4.4 Contratos que usa Mi Estudio hoy

| Tipo | Contrato |
|---|---|
| Tablas leídas desde el navegador | `creator_profiles` (select y update), `peliculas` (solo select). |
| APIs | `DELETE /api/titles/[slug]`, `POST /api/titles` (solo con `legacyEngine`), `POST /api/upload/presign` (solo con `legacyEngine`), `POST /api/upload/file` (foto del perfil). |
| Payload de `POST /api/titles` | `LegacyTitlePayload { title, synopsis?, year?, duration?, genre?, language?, r2VideoUrl, r2PosterUrl?, r2SubtitleUrl? }` (`lib/studio/legacy-payload.ts`). |
| Tipos de interfaz | `StudioTitle`, `StudioData`, `Creator`, `TitleStatus`, `StudioTabId` (`studio-types.ts`); `UploadDraft`, `UploadedAsset`, `StepReview` (`lib/studio/upload-draft.ts`); `UploadEngine`, `AssetRequest`, `SubmitResult` (`lib/studio/engine.ts`). |
| Catálogos | `lib/studio/catalogs.ts` (papeles del equipo, huecos de imagen, límites), `lib/studio/geo.ts` (países e idiomas), `lib/genres.ts` (`CREATOR_GENRES`). |
| Variable de entorno | `NEXT_PUBLIC_STUDIO_ENGINE` (`legacy` o el valor por defecto `local`). |
| Pruebas | `e2e/unit/studio-upload-draft.spec.ts`, `studio-engine-parts.spec.ts`, `studio-catalogs.spec.ts` (unitarias, en verde) y `e2e/studio-upload.spec.ts` y `nav-studio.spec.ts` (navegador, no ejecutadas en esta captura). |

---

## 5. Otras pantallas modificadas

| Área | Desplegado (`main`) | Sin commitear (en curso) |
|---|---|---|
| Navegación | Navbar estilo Filmin con subrayado y menú de cuenta en tarjeta; panel lateral móvil (Radix Dialog) sustituido por la barra inferior en píldora; fila de pestañas de Studio en la cabecera. | Retoques en `navbar.tsx`, `mobile-tab-bar.tsx`, `navbar-parts/*`, `app-shell.tsx`; nuevos `site-footer.tsx`, `reveal-footer.tsx` y `site-aurora.tsx`. |
| Inicio | Hero ambiental y carrusel de 8 s, orden de filas (recién llegados, Top 10, recomendadas, Mi lista, colecciones), Top 10 con tarjeta que se expande. | `home-hero.tsx`, `home-screen.tsx`, `top-ten-row.tsx`, `lib/home/*`; specs de tamaños de texto, cabecera de lista y progreso de «seguir viendo». |
| Catálogo | Contenedor a todo ancho, columnas por tramos, colecciones vacías ocultas, «Próximamente» con ThreeDMarquee. | **Cajón de filtros borrado** (`catalog-filter-drawer.tsx`) y sustituido por píldoras (`filter-pills.tsx`, `lib/catalog/*`), tamaños de rejilla y hover de tarjeta. |
| Fichas | Cabecera de película y pestañas ARIA, tráiler en la ficha flotante. | Extras (commit), tarjetas de la ficha (`detail-cards.tsx`, `details-tab.tsx`, `synopsis-card.tsx`, `clamped-text.tsx`), reproductor propio de extras, rejilla de relacionados, fondo ambiental. |
| Valoraciones | Escala 1 a 10, guardado verificado con deshacer, listado paginado y ordenable. | Resumen en servidor (`lib/ratings/summary*.ts`), aviso de inicio de sesión, `rating-form.tsx`, `review-card.tsx`, `score-scale.tsx`. |
| Comentarios | Tarjetas, borrar propio, denunciar. | Comunidad: respuestas, orden, «momento», likes por perfil y autor por perfil (`lib/comments/*`, migraciones 20261016–20261020). |
| Perfiles y avatares | — | `profiles.avatar_id`, `/api/avatar`, `profile-avatar.tsx`, `lib/profiles/*`; selector y edición de perfiles. |
| Mi lista | Aviso para invitados y escritura verificada. | Almacén compartido (`lib/watchlist/*`), tarjeta de Mi Espacio y botón para quitar. |
| Reproductor | Solo iconos (Iconoir) y tipografía. | Sin cambios funcionales. |
| Legales y otros | Títulos de pestaña únicos. | Botón volver en legales, `donatest`, `configurar-perfil*`. |
| Global | Margen lateral de 64 px, tarjetas de 320 px. | Satoshi (`app/fonts/`), paleta «bosque» (`forest-palette.spec.ts`), `app/globals.css`, `app/layout.tsx`, `next.config.mjs` (CSP con `lh3.googleusercontent.com` para las fotos de Google). |

---

## 6. Cambios sin confirmar y trabajo en curso [V]

- **Recuento**: 203 entradas en `git status --short` (236 archivos con `-uall`), contando este documento.
- **En curso ahora mismo**: `components/features/studio/upload/processing-bucket.tsx` apareció durante la captura. Antes de integrar, volver a ejecutar `git status` y comparar con este documento.
- **Por directorio** (archivos): `components/features` 71, `e2e/unit` 23 nuevos, ~37 specs E2E nuevas, `components/ui` 18, `components/layout` 10, `lib/studio` 7, `app/api` 6, `lib/comments` 5, `supabase/migrations` 5, `lib/profiles` 4, `app/(legal)` 4, y otros.
- **Migraciones nuevas sin commitear**: `20261016_comments_profile_id.sql`, `20261017_profiles_avatar_id.sql`, `20261018_comments_community.sql`, `20261019_comment_likes_profile_id.sql`, `20261020_comments_reply_to.sql`.
- **Documentos sin commitear**: `docs/PENDIENTES-EXTRAS.md` (lista de pendientes de Windows) y `docs/estudio/ESTRUCTURA-SUBIDA.md` (estructura de la subida, tomada como referencia de Festhome).
- **Limpieza obligatoria antes de desplegar**: borrar los extras de muestra «[PRUEBA]» del corto `yasha-gozen` en el Supabase real [R].

### Migraciones de Windows y su estado en la base real

| Archivo | Tablas | En Git | En Supabase real |
|---|---|---|---|
| `20261013_comment_reports.sql` | `comment_reports` | `main` | [P] |
| `20261015_pelicula_extras.sql` | `pelicula_extras` (FK a `peliculas`) | `trabajo-local` | [R] la tabla existe |
| `20261016_comments_profile_id.sql` | `comments` | sin commitear | [R] aplicada |
| `20261017_profiles_avatar_id.sql` | `profiles`, `sub_profiles` | sin commitear | [R] aplicada |
| `20261018_comments_community.sql` | `comments` | sin commitear | [P] |
| `20261019_comment_likes_profile_id.sql` | `comment_likes` | sin commitear | [P] |
| `20261020_comments_reply_to.sql` | `comments` | sin commitear | [P] |

---

## 7. Dependencias [V]

Cambios en `package.json` desde la base común `41494c6`, todos ya en `main`. **Sin cambios sin commitear en `package.json` ni en `package-lock.json`.**

| Cambio | Detalle |
|---|---|
| Añadida | `iconoir-react ^7.12.1` |
| Eliminada | `lucide-react ^1.16.0` |
| Scripts nuevos | `test:e2e` (`playwright test`), `test:secondary`, `test:support`, `test:responsive` (estos tres vienen del snapshot del Mac) |

No hay script de pruebas unitarias aparte: las unitarias viven en `e2e/unit/` y se ejecutan con `npx playwright test e2e/unit`.

---

## 8. Pruebas

### 8.1 Ejecutadas en esta captura (2026-10-16) [V]

| Prueba | Resultado | Cómo |
|---|---|---|
| Tipos | **OK** (exit 0) | `npx tsc --noEmit --incremental false` sobre el árbol actual, con los cambios sin commitear. |
| Unitarias | **293 de 293 pasan** (8 s) | `npx playwright test e2e/unit`, reutilizando el servidor ya arrancado en :3000. No arranca otro `next dev`. |

### 8.2 No ejecutadas ahora

- E2E de navegador (`e2e/*.spec.ts`, 44 archivos) y suites `tests/responsive`, `tests/secondary` y `tests/support`: [P]. La última ejecución que quedó registrada en el worktree de pruebas (`streaming-app-base/test-results/.last-run.json`) acabó en **fallo** en una prueba de paleta (`unit-palette… azulados usan las variables`), y esa copia no coincide con el árbol actual, así que no vale como referencia.
- Registro histórico [R]: E2E 81/81 (lista), 44/44 (Fase B), 48/48 (distribución Filmin), según `FRONTEND-WINDOWS-PARALLEL.md`, todos del 13 de octubre.
- `next lint` y `next build` no se han ejecutado en esta captura (escriben en `.next`, que comparte el servidor del usuario).

### 8.3 Limitaciones conocidas

- Las E2E simulan las APIs con *mocks*; no prueban escrituras reales contra Supabase [R].
- Windows trabaja contra el Supabase real: cualquier prueba que escriba toca datos reales.
- La subida de Studio no se ha probado contra R2 en esta línea; por defecto está en modo simulado.
- Estadísticas, despublicar, revisión y edición de metadatos siguen simulados o pendientes (§4.2).

---

## 9. Implementado, simulado, pendiente y desplegado (resumen)

| | Qué |
|---|---|
| **DESPLEGADO** | Todo lo que está en `main` (`a0ff76a`): navbar, distribución Filmin, buscador, valoraciones y comentarios básicos, Iconoir, móvil, hero. [P] No se ha comprobado en Vercel qué despliegue está activo. |
| **IMPLEMENTADO, no desplegado** | Extras (commit en `trabajo-local`), avatares, comentarios de comunidad, pie de página, aurora, Satoshi, filtros en píldoras, tarjetas de ficha, carga y borrado de títulos en Studio, perfil del creador, validación y borrador de la pasarela, `legacyEngine`. |
| **SIMULADO** | `localEngine` (subida y envío por defecto), pantalla de procesado, despublicar, enviar o retirar de revisión, editar metadatos. |
| **PENDIENTE** | Motor real enchufado a `UploadEngine`, estadísticas reales, publicación de extras desde Studio, migraciones 20261013/18/19/20 en la base real [P]. |

---

## 10. Riesgo de conflicto con el motor multimedia del Mac

### 10.1 Qué falta traer del Mac (leído del paquete, sin extraerlo dentro del repo)

- Paquete: `C:\Users\gfrom\Downloads\GMA-FILMO-MIGRACION-MAC-WINDOWS-20261014.zip` (2,57 GB). Su bundle `02-GIT-Y-ESTADOS/gma-filmo-all.bundle` pasa `git bundle verify`. Destino previsto para extraerlo: `C:\GMA` (64 rutas superan 200 caracteres, así que Descargas no sirve).
- [V] HEAD del Mac `c5b3483` (`feature/upload-engine-v2`), 23 commits sobre `41494c6`. Los 19 primeros (`9051519` → `25b706e`) y el árbol de `93fbea0` **ya están en Windows** dentro de `5d093fc`: el árbol es igual salvo 6 documentos de investigación y 2 líneas de `.gitignore`. `git cherry` no lo detecta porque es un único commit de snapshot.
- [V] Falta: documentos de `93fbea0`; motor de subidas v2 (`2ce609d`, `979d720`, `c5b3483`: `lib/uploads/*`, `app/api/uploads|upload-drafts|media|webhooks`, migraciones 20261005 y 20261006); y 99 cambios sin commitear (281 archivos sin contar `work/`) con el motor neutral de fases 1 a 8 (`lib/media/`, `tests/media/`, `scripts/media/`, `infrastructure/peertube|media-local`, `docs/media/`, 10 migraciones `20261007`–`202610080008`, `hooks/use-media-playback.ts`, `hooks/use-upload-controller.ts`, `types/media-engine.ts`, `types/playback.ts`).
- [R] Según el Mac: 351 de 352 pruebas aprobadas, audit de dependencias con 2 críticas y 19 altas (bloquea exposición pública), PeerTube no instalado, migraciones solo en el Supabase local de Docker del Mac.
- [V] El motor está detrás de interruptores: `UPLOAD_ENGINE_V2`/`NEXT_PUBLIC_UPLOAD_ENGINE_V2`, `LEGACY_MEDIA_WRITES_ENABLED` (por defecto `true`) y un modo media local que exige una lista larga de variables en `next.config.mjs`. [I] Con todo apagado debería comportarse como hoy, pero no se ha probado en Windows.

### 10.2 Fusión simulada [V]

En la carpeta temporal de la sesión (no en el repo) se montó un repo con las ramas del bundle y las de Windows, y dos árboles completos: Mac = `c5b3483` + sus cambios sin commitear sacados del zip; Windows = `trabajo-local` + sus cambios sin commitear. Después se ejecutó `git merge-tree --write-tree`. Con base `41494c6` salen 59 conflictos, casi todos falsos por el snapshot. **Con base `5d093fc`**, que es la base real, salen estos:

| Archivo | Tipo | Windows | Mac | Resolución que conserva ambos |
|---|---|---|---|---|
| `components/features/studio/studio-upload-view.tsx` | borrado/modificado | Borrado (pasarela nueva) | Conectado a `/api/upload-drafts` y `/api/uploads` | No resucitarlo: llevar su lógica a un motor `UploadEngine` (§10.4). |
| `components/features/studio/studio-upload-orbital.tsx` | borrado/modificado | Borrado | +~290 líneas: cola, idioma, reanudar, `/api/media/:id` | Igual que el anterior. |
| `components/features/studio/studio-screen.tsx` | contenido | Barra lateral y rediseño | Acciones `publish/unpublish/republish/delete` por API | Maqueta de Windows con las llamadas del Mac (eso además convierte en reales acciones hoy simuladas). |
| `components/features/studio/studio-ui.tsx` | contenido | Importa iconos de `@/components/ui/icons` | `lucide-react` + `EyeOff`, `Trash2` | Iconoir; añadir los dos iconos a `icons.tsx`. |
| `package.json`, `package-lock.json` | contenido | `iconoir-react`, sin `lucide-react` | ~15 scripts `test:uploads*` y `media:*` y dependencias nuevas | Unir y **regenerar** el lock con `npm install`. |
| `next.config.mjs` | contenido | CSP con `lh3.googleusercontent.com` | Modo media local, `R2_PUBLIC_URL` con `trim()` | Unir. |
| `types/catalog.ts` | contenido | `fullSynopsis`, `trailerUrl`, `communityScore`, `language`, `MovieExtra` | `playbackKind`, `playbackRef` | Quedarse con todo (campos opcionales distintos). |
| `.gitignore` | contenido | Fuentes Satoshi | `work/media-local`, `work/media-rollback`, `.next-responsive` | Unir. |
| `tests/responsive/fixture.tsx`, `responsive.spec.ts` | contenido | Selectores de sus pantallas | Selectores de las suyas | Unir y volver a ejecutar. |

Si solo se comparan commits (sin el trabajo pendiente de ninguno de los dos), quedan `package.json`, `package-lock.json` y `types/catalog.ts`.

### 10.3 Se fusionan solos pero hay que revisarlos a mano [V]

- `components/features/player/player-screen.tsx`: el Mac usa `useMediaPlayback` y `lucide-react`; Windows cambió iconos y tipografía. **No compilará** sin arreglar los iconos.
- `studio-edit-modal.tsx`, `studio-profile-view.tsx`, `studio-titles-view.tsx`, `studio-types.ts`: la lógica del Mac (revisiones, `PATCH /api/titles/:id`) entra sobre la maqueta de Windows.
- `app/configurar-perfil-creador/page.tsx`.
- `lib/supabase/queries.ts`: el Mac filtra el catálogo a `status = published o nulo` y añade `playbackKind/playbackRef`; Windows añade `fullSynopsis` y `language` y cambia el relleno de recomendaciones. Comprobar que no desaparecen títulos.
- `types/database.ts`: el Mac añade tablas `gma_*`; Windows añade `avatar_id`, `profile_id`, `reply_to_id`, `creator_hearted`, `pinned_at`, `edited_at`. Regenerar los tipos desde la base integrada.
- `middleware.ts` (solo lo cambia el Mac): deja pasar `/api/upload-drafts|uploads|titles|media|subtitle-proxy|sprites` sin redirección de sesión.
- **Iconos**: 9 archivos del Mac importan `lucide-react`: `app/configurar-perfil-creador/page.tsx`, `player-screen.tsx`, `studio-edit-modal.tsx`, `studio-profile-view.tsx`, `studio-screen.tsx`, `studio-titles-view.tsx`, `studio-ui.tsx`, `studio-upload-orbital.tsx` y `studio-upload-view.tsx`.

### 10.4 Choque funcional en la subida

- [V] En el Mac, `POST /api/upload/presign` responde **410** si `LEGACY_MEDIA_WRITES_ENABLED` no es `true` o si el motor v2 está activo, y `POST /api/titles` pasa a `TitleService`. **El `legacyEngine` de Windows deja de funcionar en cuanto se encienda el motor del Mac.**
- [V] La lógica de cliente del Mac está separada de su interfaz: `lib/uploads/browser.ts` (borradores, sesiones por partes, SHA-256, reanudar, completar, avatar) y `hooks/use-upload-controller.ts` (pausar, cancelar, reintentar, idioma, orden).
- Propuesta: un `mediaEngine` que implemente `UploadEngine` con esa lógica, seleccionado en `getUploadEngine()` con la bandera del motor. `localEngine` y `legacyEngine` siguen disponibles mientras el motor esté apagado.
- [I] Hay que mapear los huecos de Windows (`video`, `trailer`, `poster`, `banner`, `extra:N`, `srt:N`) a los roles y slots del Mac (`gma_draft_media.role/slot`). El Mac no conoce `extra:*`. El borrador de Windows (en `localStorage`) y el del Mac (`gma_upload_drafts`, en servidor y con revisiones) son dos modelos distintos: decidir cuál manda.
- `UploadedAsset.status` de Windows (`pending | uploading | processing | done | error`) encaja con el ciclo del Mac; `processing-bucket.tsx` puede pasar a mostrar el progreso real.

### 10.5 Migraciones y base de datos

- [V] **Tablas disjuntas salvo `peliculas`.** El Mac crea `gma_*` y añade columnas a `peliculas` (`stream_uid`, `playback_kind`, `media_revision`, `media_delete_state`…). Windows toca `comments`, `comment_likes`, `comment_reports`, `profiles` y `sub_profiles`, y crea `pelicula_extras` con FK a `peliculas`.
- [V] `202610080008_title_writes_server_only.sql` revoca `INSERT/UPDATE/DELETE` sobre `peliculas` a `anon` y `authenticated`. En Windows, Mi Estudio solo **lee** `peliculas` desde el navegador, y `/api/titles`, `/api/titles/[slug]` y `/api/extras` usan el cliente admin de servidor, así que no debería romperse.
- [I] Las versiones del Mac (20261005 a 202610080008) son **anteriores** a las de Windows ya aplicadas en el remoto (20261016 y 20261017). Es habitual que `supabase db push` se niegue a aplicarlas sin `--include-all` [P].
- [I] `2026100800031_media_title_lifecycle.sql` tiene 13 dígitos frente a 12: según se ordene (texto o número), puede ir antes o después de `202610080003`. Revisar el orden en el `RUNBOOK` del Mac.
- Probar el motor exige un Supabase local en Windows (`supabase start` con imágenes x86; las del Mac son arm64 y no sirven), con los dumps de `06-BASES-DE-DATOS-Y-BACKUPS`.

### 10.6 Archivos de alto riesgo (lista para vigilar)

`components/features/studio/**`, `lib/studio/engine.ts`, `components/features/player/player-screen.tsx`, `lib/supabase/queries.ts`, `types/catalog.ts`, `types/database.ts`, `next.config.mjs`, `middleware.ts`, `package.json`, `package-lock.json`, `.gitignore`, `app/api/titles/**`, `app/api/upload/**`, `app/configurar-perfil-creador/page.tsx`, `supabase/migrations/**`, `tests/responsive/**`.

---

## 11. Instrucciones para Codex: integrar el motor sin perder lo de Windows

Estas instrucciones corrigen la guía del paquete del Mac (`10-GUIA-RESTAURACION-WINDOWS`) en dos puntos: **no partir de `feature/frontend-windows`** (obsoleta) y **no hacer cherry-pick de `9051519`…`25b706e`** (ya están en `5d093fc`; repetirlos solo crea conflictos falsos).

**No hacer nunca**: `git reset --hard`, `git checkout -- .`, `git clean` en `streaming-app`, `checkout --force`, push forzado a `main`, copiar carpetas del Mac encima del repo, ni ejecutar suites que arranquen `next dev` dentro de `streaming-app`.

1. **Proteger lo no commiteado (bloqueante).** Copiar `streaming-app` completa a otro disco y ejecutar `git bundle create ..\streaming-app-respaldo-PREVIO.bundle --all`. Pedir a G que decida cuándo commitear los cambios de `trabajo-local` (commit local, sin push ni despliegue). Volver a ejecutar `git status` y comparar con §6, porque el trabajo sigue en curso.
2. **Trabajar en otra carpeta.** Crear un worktree nuevo (p. ej. `C:\GMA\integracion`) en vez de usar `streaming-app`, cuyo servidor de :3000 es el que usa G.
3. **Extraer el paquete** en `C:\GMA\paquete` y verificar el manifiesto con `verificar-manifiesto.ps1`.
4. **Traer las ramas del Mac como referencias aparte**: `git fetch <paquete>\02-GIT-Y-ESTADOS\gma-filmo-all.bundle "refs/heads/*:refs/remotes/mac/*"`. No cambia ninguna rama local.
5. **Rehacer la línea del Mac sobre el snapshot**: rama `mac/sobre-snapshot` desde `5d093fc`, y `git cherry-pick 93fbea0 2ce609d 979d720 c5b3483`. Después, el trabajo sin commitear del Mac (de `01-CODIGO-COMPLETO/gma-filmo/` o del parche `cambios-sin-confirmar-vs-HEAD.patch` + `no-versionados.txt`) en commits por bloques: base neutral + `20261007`; migraciones `0800xx`; `types/` y `lib/media/`; APIs; Studio y Player; tests; `infrastructure/`, `scripts/media` y `docs/media`. No copiar `work/`.
6. **Rama de integración** desde la punta de Windows ya commiteada (p. ej. `integracion/mac-media`), y fusionar en ella `mac/sobre-snapshot`. Esperar los conflictos del §10.2.
7. **Resolver** según §10.2 y §10.3: Iconoir en lugar de `lucide-react`; unir tipos, CSP y scripts; regenerar `package-lock.json`.
8. **Studio**: escribir `mediaEngine` en `lib/studio/engine.ts` (§10.4), conectar en la maqueta de Windows las acciones reales del Mac (publicar, despublicar, editar con revisión) y no resucitar las pantallas borradas. Conservar `localEngine` y `legacyEngine`.
9. **Probar en dos modos.** Con el motor **apagado**, todo debe verse y comportarse como Windows hoy: `tsc`, `npx playwright test e2e/unit` (293 de referencia) y las E2E con `E2E_PORT` distinto de 3000. Con el motor **encendido**, solo contra un Supabase local, nunca contra el real: suites del Mac `test:uploads*` y `tests/media`.
10. **Base de datos real y despliegue** solo cuando G lo pida: revisar §10.5, aplicar migraciones con copia previa, resolver el audit de dependencias, borrar los extras «[PRUEBA]» y abrir un PR contra `main`.

---

## 12. No comprobado en esta captura

- [P] Despliegue activo hoy en Vercel.
- [P] Estado de las migraciones 20261013, 20261018, 20261019 y 20261020 en el Supabase real.
- [P] E2E de navegador, `next lint` y `next build` sobre el árbol actual.
- [P] Si la fusión simulada compila (solo se calcularon conflictos).
- [P] Contenido de `work/` y de las sesiones de Codex del paquete del Mac.
