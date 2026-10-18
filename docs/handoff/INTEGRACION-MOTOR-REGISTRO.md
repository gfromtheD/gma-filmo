# Registro técnico de la integración del motor multimedia

> Rama: `integracion/motor-media` en el clon `C:\GMA\integracion` (no publicada; push desactivado).
> Base Windows: `057dbd4` (= `github/main` = producción en Vercel, despliegue `dpl_5TUnmzc5hz1KL7xc2kjWda3ysg84`; árbol idéntico a `26405f5` de `trabajo-local`).
> Línea del Mac reconstruida: `mac/sobre-snapshot` (desde `5d093fc`).
> Autor: Claude Code (backend). Actualizado: 2026-10-17.

## 0. Reglas que se han seguido

- No se ha escrito nada en `streaming-app` ni en su `.git`. Todo ocurre en el clon.
- La presentación de Windows es intocable: `git diff 057dbd4 -- components app/(platform) lib/studio store e2e` está **vacío**.
- Todo lo nuevo funciona detrás de los flags del motor, apagados por defecto. Con el motor apagado, el comportamiento debe ser el de Windows.
- Ninguna prueba toca Supabase alojado. Las bases de datos de prueba son PGlite (PostgreSQL en proceso) o el Mock en disco temporal.

## 1. M1 — Reconstrucción del Mac (rama `mac/sobre-snapshot`)

| Paso | Resultado |
|---|---|
| Base `5d093fc` (snapshot de producción que ya contenía `9051519`…`25b706e`) | No se repiten esos 19 commits |
| Cherry-pick `93fbea0`, `2ce609d`, `979d720`, `c5b3483` | Limpio (los 4 commits) |
| Trabajo sin commitear del Mac (281 archivos, sin `work/`) en 10 commits por bloque | config/deps (13), migraciones (10), núcleo neutral `lib/media`+`types` (47), `lib/uploads` (12), APIs (21), UI del Mac de referencia (14), pruebas (116), scripts (18), infraestructura (19), documentación (11) |
| **Verificación** | Árbol de `mac/sobre-snapshot` = árbol completo del Mac (`c5b3483` + WIP del zip): 0 archivos faltan, 0 sobran; solo difieren `docs/ADAPTACION-MOVIL-TABLET.md` y `docs/PENDIENTES-NUEVA-VERSION.md`, que ya eran distintos en el snapshot de Windows |

## 2. Llevar el motor a la base Windows (`integracion/motor-media`)

Cada commit de `mac/sobre-snapshot` se aplicó sobre `057dbd4` con esta política (scripts en `C:\GMA\integracion-herramientas\`):

| Caso | Resolución |
|---|---|
| `components/**`, páginas de `app/(platform)`, `app/(support)`, `app/ver`, `app/configurar-perfil*` | **Versión Windows**. Las pantallas `studio-upload-view.tsx` y `studio-upload-orbital.tsx` siguen borradas. El commit «feat(ui) … referencia» quedó solo con los hooks del Mac (`use-media-playback`, `use-upload-controller`, `use-progress`, `use-stream-playback`) |
| `package.json` | Unión: dependencias y scripts del Mac sin `lucide-react` |
| `package-lock.json` | Regenerado con `npm install` sobre el lock de Windows (commit propio) |
| `types/catalog.ts` | Unión: `trailerUrl` (Windows) + `playbackKind`, `playbackRef` (Mac) |
| `next.config.mjs` | CSP unida: `lh3.googleusercontent.com` (Windows) + `*.r2.cloudflarestorage.com` y la pasarela local `127.0.0.1:4319`, solo con el modo media local (Mac) |
| `.gitignore` | Unión |
| `tests/responsive/fixture.tsx`, `responsive.spec.ts` | Versión Windows (prueban la interfaz de Windows) |
| Helpers puros del Studio del Mac (`studio-asset-slot`, `studio-status`) | Movidos a `lib/studio-media/` para no depender de componentes que no se integran |

No queda ningún import de `lucide-react`. `tsc --noEmit` pasa sin errores.

## 3. Cambios propios del backend (después de la integración)

| Commit | Módulo | Qué y por qué |
|---|---|---|
| `f36e0be` | M3 API | `DELETE /api/titles/:slug`: con el motor apagado vuelve al contrato de Windows (sin cuerpo, borrado inmediato con comprobación de propietario). La versión del Mac exigía `{revision, idempotency_key}` y tablas `gma_*`, así que **habría roto el borrado de Mi Estudio en producción** |
| `540b6a9` | M2/M3 portabilidad | `lib/media/mock-storage.ts`: Windows no permite fsync de un directorio ni de un descriptor de solo lectura (EPERM). Se usa `r+` y se omite el fsync de directorio solo en `win32`. Arregla 8 pruebas en Windows sin tocarlas |
| `348860a` | M4 BD | `scripts/media/validate-integrated-schema.ts`: valida el esquema integrado en PGlite (§5) |
| `c8dac60` | Ficha | Migración aditiva `20261021000100_gma_draft_ficha.sql`, `lib/media/ficha.ts` (zod), `FichaRepository`, `GET/PUT /api/upload-drafts/:id/ficha` y copia al título tras publicar |
| `13cd2f5` | Mi Estudio | `lib/studio-media/{mapping,media-engine,title-lifecycle}.ts` (§6) |
| `5daeaf2` | M5 reproducción | `GET /api/titles/:slug/playback` sin tablas `gma_*` con el motor apagado; `lib/media/player-adapter.ts` |
| `ba87e43` | Pruebas | `scripts/media/run-test-matrix.mjs`: ejecuta baterías archivo por archivo con tiempo límite |

## 4. Pruebas (2026-10-17, en el clon)

| Batería | Resultado | Notas |
|---|---|---|
| `tsc --noEmit` | **OK** | — |
| Acumulada del Mac (`tests/media/*` + `tests/media/studio/*`, sin los 5 runners con puerta) | **186/191** | 57 archivos. Los 5 fallos son de entorno POSIX (§4.1) |
| `tests/uploads/*` | **53/55** | Fallan `concurrency` (necesita PostgreSQL real) y `ffmpeg` (el ejecutor aislado usa `/usr/bin/python3` y límites POSIX) |
| Pruebas nuevas del backend | **18/18** | `legacy-title-delete` (2), `ficha` (4), `studio/media-engine` (9), `player-adapter` (3); incluidas en la acumulada |
| Esquema integrado (PGlite) | **OK** en los escenarios «remoto» y «limpio» | El escenario «nombre» falla como se esperaba en `2026100800031` (§5) |
| Windows `e2e/unit` | **293/293** | En el clon, puerto 3201, con variables públicas de Supabase de relleno (las pruebas no llaman a Supabase) |

### 4.1 Fallos que no son errores del código (requieren Linux/WSL2)

| Prueba | Causa |
|---|---|
| `hls-gateway` › symlink que escapa del namespace | Crear un enlace simbólico en Windows exige Modo de desarrollador o administrador (EPERM). La protección del código no se ha tocado |
| `local-runner` (3) | Enlaces simbólicos, permisos `0600` (`MEDIA_LOCAL_CREDENTIALS_PRIVATE_REQUIRED`) y socket Docker Unix |
| `preflight-local` | Permisos `0600` de la clave privada (`MEDIA_LOCAL_PRIVATE_KEY_PERMISSIONS`) |
| `uploads/concurrency` | PostgreSQL real aislado |
| `uploads/ffmpeg` | Ejecutor aislado POSIX (`media-limit.py`, `resource`, bubblewrap en producción) |

No se ha desactivado ni relajado ninguna prueba. Para ejecutarlas hace falta WSL2 (Ubuntu) con Docker y PostgreSQL 17, que necesita autorización.

## 5. M4 — Migraciones

### 5.1 Validación del esquema integrado (`npx tsx scripts/media/validate-integrated-schema.ts`)

Las migraciones históricas **no reconstruyen el esquema**: las tablas base (`peliculas`, `artistas`…) se crearon desde el panel de Supabase y varios archivos dicen «Run this in Supabase Dashboard». Por eso se parte de la baseline que reconstruyó el Mac (`infrastructure/media-local/baseline.sql`).

| Escenario | Orden | Resultado |
|---|---|---|
| remoto (lo que pasará en el Supabase real) | baseline → Windows 20261013–20261020 → motor (orden explícito del Mac) → ficha | 21/21 OK |
| limpio | baseline → motor → ficha → Windows | 21/21 OK |
| nombre (diagnóstico) | orden por nombre de archivo (como `supabase db push`) | **Falla** en `2026100800031`: su preflight exige `202610080003`, que por nombre va después (`1` < `_`) |

Comprobaciones superadas en los dos escenarios válidos: anon ve los títulos históricos (`status` nulo y `published`); anon y authenticated no pueden escribir en `peliculas` (0008); `pelicula_extras` sigue enlazada; columnas nuevas de `peliculas` con valores por defecto compatibles (`legacy/0/none`); ninguna tabla `gma_*` escribible por authenticated; `delete_account` del motor marca los títulos `unpublished/pending` y la cascada de Auth borra comentarios y respuestas de Windows sin romper claves foráneas.

### 5.2 Propuesta de renumeración (NO aplicada todavía)

Solo afecta a migraciones del motor, que no están aplicadas en ningún remoto. Las de Windows (ya aplicadas a mano en producción) **no se renombran**.

| Actual | Propuesto |
|---|---|
| `20261005_upload_engine_v2` | `20261005000100_upload_engine_v2` |
| `20261006_upload_engine_r2_first` | `20261006000100_upload_engine_r2_first` |
| `20261007_r2_capacity` | `20261007000100_r2_capacity` |
| `202610080001_media_provider_neutral` | `20261008000100_media_provider_neutral` |
| `202610080002_media_commands` | `20261008000200_media_commands` |
| `202610080003_media_publish_lifecycle` | `20261008000300_media_publish_lifecycle` |
| `2026100800031_media_title_lifecycle` | `20261008000310_media_title_lifecycle` |
| `202610080004` … `0008` | `20261008000400` … `20261008000800` |
| `20261021000100_gma_draft_ficha` | (ya tiene 14 dígitos) |

Para aplicarla hay que actualizar las listas explícitas (`scripts/media/local-stack.ts`, `tests/media/database.ts`, `tests/uploads/database.ts`, `tests/media/local-baseline.test.ts`, el validador). Queda pendiente de aprobación, porque cambia nombres que el Mac usa en sus registros.

### 5.3 Traslado futuro al Supabase real (solo con autorización)

1. `pg_dump` completo y restauración comprobada en una base desechable.
2. Inventario de solo lectura: `supabase_migrations.schema_migrations` (probablemente vacío o incompleto, porque se aplicó a mano), valores de `peliculas.status` y existencia de `pelicula_extras`, `comment_reports` y columnas `profile_id`/`avatar_id`/`reply_to_id`.
3. Aplicar las migraciones del motor **en orden explícito** (no con `db push` por nombre), una transacción por archivo; después, la de la ficha.
4. Registrar las versiones con `supabase migration repair --status applied …`.
5. `gma_upload_policy.legacy_inventory_verified` empieza en `false`: la reserva de subidas devuelve `UPLOAD_LEGACY_INVENTORY_REQUIRED` hasta completar el inventario legado (`media:legacy:inventory`). Es una puerta de seguridad del Mac y hay que mantenerla.
6. Rollback: las migraciones son aditivas. Se vuelve atrás apagando flags; 0008 se revierte con `GRANT`.

## 6. Mi Estudio — adaptadores (sin tocar la presentación)

### 6.1 Mapeo de huecos (`lib/studio-media/mapping.ts`)

| Windows | Motor | Estado |
|---|---|---|
| `video` | `main` | OK (4 GB / 4 h) |
| `trailer` | `trailer` | OK, pero **el servidor limita a 1 GB y 10 min** (la pasarela de Windows deja 4 GB): manda el servidor |
| `poster` | `poster_v` | OK (10 MB; el servidor normaliza a WebP) |
| `banner` | `poster_h` | OK |
| `extra:N` vídeo | `extras` (slot `extras:<clave>`) | OK (1 GB / 1 h cada uno) |
| `extra:N` fotograma/póster | — | **Bloqueado** (decisión de producto; ver §8) |
| `srt:N` | `subtitles` (slot `subtitles:<idioma>`) | OK, un SRT por idioma |

### 6.2 `mediaEngine` (`lib/studio-media/media-engine.ts`)

Implementa `UploadEngine` sobre `lib/uploads/managed-browser.ts`. Comportamiento:
- Progreso real de transferencia; `onProcessing` cuando el servidor valida o procesa; resultado con `sessionId`/`mediaId`.
- **Abortar ≠ cancelar**: la señal solo detiene el navegador (la sesión se puede reanudar). Para quitar un archivo y liberar cuota está `cancelAsset(slot)`; además `pauseAsset` y `retryAsset` (máximo 3, sin cobrar cuota otra vez).
- Reanudación: si el hueco tenía una sesión `uploading/paused` del mismo rol, se reanuda con el mismo SHA-256 y se vuelve a pedir el archivo.
- `submit()`: guarda los 5 campos del borrador del motor más la **ficha completa** (`PUT …/ficha`). Por defecto **no publica** (`publishMode: 'hold'` → `queued`); `'direct'` publica con `{draft_id, revision, main_media_id}`. Activarlo es decisión de producto.
- El servidor es la autoridad sobre sesiones, archivos, revisiones, cuotas y publicación; el `UploadDraft` del navegador es caché.

### 6.3 Ficha completa (migración `20261021000100`)

`gma_draft_ficha` (revisión propia, CAS, solo service_role escribe, el propietario lee) y `pelicula_ficha` (copia al publicar; legible solo si el título es visible). Se conservan: título original, duración, país, año, categorías, edad, ópera prima, idioma, sinopsis corta y larga, géneros, temas, equipo, premios, IA, comentarios, idiomas de subtítulos, extras (tipo + `mediaId`) y condiciones. **Cómo se muestran en la web es una decisión pendiente.**

### 6.4 «Mis títulos» (`lib/studio-media/title-lifecycle.ts`)

`unpublish`, `republish`, `editMetadata`, `detail` y `remove`, con revisión e idempotencia. Sin motor solo existe el borrado histórico, y el resto lanza `TitleActionUnavailable`, para que la interfaz no finja que guardó.

## 7. M5 — Reproducción

- El Player visual de Windows **no se ha tocado**. Hoy reproduce los títulos históricos como antes.
- `lib/media/player-adapter.ts` decide qué títulos necesitan el resolvedor autorizado (solo los del motor: media, r2_hls, stream) y da la fuente histórica sin petición extra. En el Player del Mac, `item.playbackRef` siempre existe y forzaba el resolvedor incluso con títulos legados.
- `GET /api/titles/:slug/playback` con el motor apagado resuelve MP4/YouTube históricos sin consultar `gma_*`.
- `subtitle-proxy` y `sprites` del Mac solo aceptan el host R2 configurado y `LEGACY_MEDIA_ALLOWED_HOSTS` (antes, cualquier host si no había variable). **Riesgo**: subtítulos históricos alojados en otro dominio darían 403. Hay que comprobar los dominios reales de `r2_subtitle_url` antes de desplegar.

## 8. Pendiente y bloqueado

| Tema | Estado |
|---|---|
| Ampliar `UploadEngine["id"]` con `"media"` y pasar el borrador a `getUploadEngine` | Necesita al frontend (contrato) |
| Botones de pausa, reintento y cancelación, cola de 3 subidas simultáneas y estados `retirado`/`borrado_pendiente` | Necesita al frontend (presentación) |
| Extras de imagen | Decisión de producto: nuevo rol en el motor o guardarlos en `pelicula_extras` (ya tiene `poster_url`, `media_ref` y `kind`) |
| Revisión editorial y publicación directa | Decisión de producto (`publishMode`) |
| `/api/upload/file` del Mac: solo `avatar`, máximo 4 MB, re-codificado WebP | El perfil de Windows valida 5 MB en el navegador: un archivo de 4–5 MB dará 413. Hay que avisar al frontend |
| Renumeración de migraciones | Pendiente de aprobación (§5.2) |
| Baterías POSIX/PostgreSQL/Docker | Necesitan WSL2 + Docker + PostgreSQL 17 (autorización) |
| Seguridad | `npm audit`: 27 avisos (2 críticos: `next` 14.2.35 y `proxy-addr`; 19 altos), los mismos que ya tenía producción. Exposición del motor bloqueada |
| PeerTube/VPS | Sin cambios; ver Plan Maestro, fase VPS |

## 9. Rollback

- Nada está fuera del clon. Borrar la rama `integracion/motor-media` o el clon no afecta a Windows ni a producción.
- Dentro de la rama, cada bloque es un commit propio y se puede revertir con `git revert`.
- En una futura activación: flags a `false` (`UPLOAD_ENGINE_V2`, `NEXT_PUBLIC_UPLOAD_ENGINE_V2`) devuelven el comportamiento de Windows; las migraciones son aditivas.
