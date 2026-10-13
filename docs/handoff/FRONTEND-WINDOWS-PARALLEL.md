# GMA Filmo — Seguimiento del frontend en Windows (desarrollo paralelo)

> Documento vivo. Permite al agente de la migración Mac → Windows saber exactamente
> qué se cambió en Windows mientras el motor multimedia se desarrollaba en el Mac.
> No registrar secretos ni datos sensibles.

## 1. Contexto

GMA Filmo se desarrolló inicialmente en este equipo Windows. Durante una interrupción
de acceso, el desarrollo continuó en un Mac (Codex), donde se implementó el nuevo
motor multimedia. Existen dos líneas de desarrollo que deberán fusionarse:

| Línea | Equipo | Alcance |
|---|---|---|
| A | Mac + Codex | Motor multimedia (rama `feature/upload-engine-v2`, no publicada en GitHub) |
| B | Windows + Claude Code | Mejoras visuales y de frontend (rama `feature/frontend-windows`) |

Estado de la migración: el paquete del Mac **aún no se ha integrado** en Windows.
El código de este repo NO es la versión arquitectónica más reciente.

## 2. Estado del Mac (según sus informes, no verificado en Windows)

Documentado en `PLAN-MAESTRO-MOTOR-MEDIA-GMA-FILMO.md` (en el Mac). 80 pasos: 64 locales
(8 fases, completadas; 351 pruebas aprobadas, 0 fallidas, 1 omitida) y 16 de
infraestructura/VPS/despliegue pendientes.

Principales piezas: abstracción `MediaProvider` (R2, Stream, Mock, PeerTube), subidas
reanudables con SHA-256, integración en Studio, reproductor MP4/HLS/YouTube con
controles propios, gateway multimedia local y entorno de pruebas aislado.
PeerTube real aún no está instalado ni conectado en producción.

## 3. Estado de partida en Windows (2026-10-13)

- Repo real: `GMA/streaming-app/` (el `.git` de `C:\Users\gfrom` está vacío; ignorarlo).
- Remoto: `origin` = `gfromtheD/gma-filmo`. `main` local == `origin/main` == `41494c6`.
- Stack: Next.js 14 (App Router), React 18, TypeScript, Tailwind 4, shadcn/radix, motion, zustand, Supabase.
- Validación: `npx tsc --noEmit` limpio; `npm run lint` sin errores (4 warnings previos
  en Studio, Player y DM). No hay script de tests.
- Ramas locales previas conservadas sin tocar: `feature/auth-creator-spec`,
  `worktree-agent-a87e353878fa6f166`.

## 4. Zonas sensibles (conflicto probable con el Mac)

Existentes en Windows y modificadas en el Mac: `components/features/studio/`,
`components/features/player/`, `app/api/upload/`, `app/api/titles/`, `lib/r2/`,
`lib/supabase/`, `supabase/migrations/`, `types/database.ts` (referencias a
`r2_video_url` / `stream_uid`).

Inexistentes aún en Windows (nuevas en el Mac): `lib/media/`, `lib/uploads/`,
`app/api/uploads/`, `app/api/media/`, `hooks/use-stream-playback.ts`,
`types/media-engine.ts`, `types/playback.ts`.

Regla: las tareas visuales no tocan lógica, APIs, datos ni migraciones. Si se
trabaja en Studio/Player por petición expresa, solo capa presentacional y se
documenta aquí con aviso de riesgo.

## 5. Registro de cambios

### 2026-10-13 — Fondo ThreeDMarquee en la pantalla "Próximamente"

- **Rama / commit:** `feature/frontend-windows` / `810a6cf`
- **Archivo modificado:** `components/features/catalog/coming-soon-screen.tsx`
- **Componentes nuevos:** ninguno (reutiliza `components/ui/three-d-marquee.tsx`).
- **Cambio visible:** la pantalla de colecciones vacías muestra el carrusel 3D de
  portadas como fondo (5 columnas) con degradado radial oscuro; el texto de
  descripción pasa de `#6D7D94` a `#B8C5D4` para legibilidad.
- **Contrato:** props `title` y `description` sin cambios.
- **Dependencias añadidas:** ninguna.
- **Pruebas:** `tsc --noEmit` y `next lint` sin errores nuevos. Sin regresión visual
  automatizada ni despliegue.
- **Riesgo de conflicto con el Mac:** bajo (no es Studio, Player, API ni datos).
- **Despliegue:** ninguno.

## 6. Notas para la integración

1. Hacer copia de seguridad de este repo antes de fusionar.
2. Comparar Windows, Mac y GitHub; los cambios de esta rama son solo visuales y
   deberían rebasarse o fusionarse encima del Mac sin tocar el motor.
3. Si hay conflictos en archivos sensibles, prevalece la lógica del Mac y se
   reaplica la capa visual de este documento.
4. No hay migraciones SQL ni cambios de modelo en esta rama.

### 2026-10-13 — Herramienta de investigación: REA (MCP para Claude Code)

- **Alcance:** solo herramienta de investigación del entorno; no toca el código de GMA
  ni `package.json`/lockfile del proyecto.
- **Versión:** `rea-agents` 6.4.0, instalado globalmente (`npm install --global rea-agents@6.4.0`)
  para que el MCP apunte a una ruta estable y no a la caché temporal de npx.
- **Requisitos:** Node 24.19.0 (válido: 24.x >= 24.11), npm 12.1.0.
- **Cambios de configuración (solo Claude Code):**
  - `~/.claude.json`: registro MCP `rea` (copia de seguridad `~/.claude.json.rea.backup`).
  - `~/.claude/skills/reverse-engineer-anything/` (skill v37, 170 herramientas).
  - No se configuraron otros clientes, ni Hopper/Ghidra/IDA, ni GitHub, Docker, Vercel o Supabase.
- **Verificación hecha:** `claude mcp list` muestra `rea ✔ Connected`; `rea setup --client claude_code
  --skill-client claude_code --dry-run` => registro y skill `aligned`, sin acciones pendientes.
- **Pendiente:** comprobar desde una sesión NUEVA de Claude Code que las herramientas
  `mcp__rea__*` están disponibles y ejecutar una inspección de prueba en una página pública.
  Hasta entonces REA NO se considera plenamente operativo.
- **Actualizar:** `rea update` (o `npm install --global rea-agents@latest`), después
  `rea setup --client claude_code --skill-client claude_code` y reiniciar Claude Code.
- **Retirar:** `rea uninstall` o restaurar `~/.claude.json.rea.backup`.

### 2026-10-13 — Fase A: investigación de Filmin y auditoría del frontend (solo documentación)

- **Rama:** `feature/frontend-windows`. **Sin cambios de código** de la aplicación.
- **Archivos nuevos:** `docs/frontend-research/FILMIN-OBSERVACIONES.md`,
  `GMA-AUDITORIA-FRONTEND.md`, `MATRIZ-RESPONSIVE.md`, `PLAN-REDISENO.md`.
- **REA verificado en sesión nueva:** herramientas `mcp__rea__*` disponibles; `list_browser_targets`,
  `inspect_web_page` y `capture_web_screenshot` probadas sobre una página pública. REA ya se
  considera operativo.
- **Navegador de investigación:** Chrome aislado con perfil temporal y CDP solo en `127.0.0.1:9333`
  (cerrado y perfil eliminado al terminar). Capturas de referencia de Filmin **fuera del repo**
  (`GMA/_research-filmin/`); no publicar.
- **Hallazgos principales (comprobados):** no hay breakpoints responsive en la plataforma; la
  navbar mantiene ~767 px y en móvil deja fuera de pantalla navegación, buscador y cuenta; sin
  `prefers-reduced-motion`; píldora de creador no operable con teclado; contrastes por debajo de AA
  en textos de apoyo; 1.047 literales hex frente a 9 usos de tokens.
- **Dependencias añadidas al proyecto:** ninguna. **Despliegues:** ninguno.
- **Conflictos con el Mac:** ninguno; no se tocó Studio, Player, APIs ni datos.
- **Notas para la integración:** el contrato de valoraciones de GMA (1–10, `rating = nota/2`,
  `CommunityReview`) está descrito en la auditoría; la futura Fase E debe respetarlo.
- **Pendiente de decisión del usuario:** punto de cambio escritorio/móvil, patrón móvil, estado en
  scroll y Studio en móvil (ver `PLAN-REDISENO.md`).

### 2026-10-13 — Fase B: navegación global (navbar responsive y accesible)

- **Rama / commits:** `feature/frontend-windows` · `9188556` (E2E base, en rojo) → `d8098e0` (`--gma-header-h`) →
  `2cb683b` (extracción) → `564bfbf` (móvil) → `62b23e5` (accesibilidad) → `dee186b` (reduced-motion, píldora, scroll) →
  `f5039d1` (arreglo de hidratación) + commits de pruebas y documentación.
- **Decisiones del usuario aplicadas:** cambio escritorio/móvil en 1024 px; menú lateral en móvil; mantener degradado + blur
  y solidificar tras 8 px de scroll; Studio en móvil como fila horizontal desplazable.
- **Archivos modificados:** `components/layout/navbar.tsx` (el export `Navbar` y sus stores no cambian),
  `app/globals.css` (nueva variable `--gma-header-h`: 64 px en móvil, 80 px desde 1024 px), `components/features/catalog/coming-soon-screen.tsx`
  (usa la variable), `package.json` (solo el script `test:e2e`), `.gitignore`.
- **Archivos nuevos:** `components/layout/navbar-parts/{avatars,brand,mobile-menu,account-menu-content,studio-tabs-row}.tsx`,
  `hooks/use-scroll-threshold.ts`, `playwright.config.ts`, `e2e/{global-setup,navbar-responsive.spec}.ts`.
- **Cambios visibles:** en < 1024 px hamburguesa + marca + buscador + cuenta con panel lateral; en ≥ 1024 px la barra es la
  de siempre (el eslogan solo desde 1280 px); menú de cuenta con teclado; cabecera más sólida tras scroll;
  respeto de `prefers-reduced-motion` en la navbar.
- **Dependencias añadidas:** ninguna (usa `radix-ui` ya instalado).
- **Pruebas:** `tsc` limpio; lint sin avisos nuevos; `next build` correcto; E2E 44/44 (`npm run test:e2e`).
- **Despliegues:** ninguno. **Push:** ninguno.
- **Conflictos posibles con el Mac:** bajo. `navbar.tsx` solo importa la constante `STUDIO_TABS` de
  `features/studio/studio-sub-nav` (no modificada). Si el Mac también cambió `navbar.tsx`, prevalece su lógica
  y se reaplican las piezas de `navbar-parts/`.
- **Limitación:** no probado con un creador autenticado (ruleta, «Mi Estudio» en el panel móvil y fila de Studio).

### 2026-10-13 — EXPERIMENTO: distribución estilo Filmin (rama `experiment/filmin-layout`)

- **Rama:** `experiment/filmin-layout` (sale de `feature/frontend-windows` @ `3df25c9`). **No integrar sin decisión del usuario.**
  Para volver a la versión anterior: `git switch feature/frontend-windows`.
- **Alcance:** réplica de la *estructura y distribución* observadas (cabecera, hero, filas, ficha, pestañas, catálogo) con el
  contenido, logo y datos de GMA. No se copió código, textos, imágenes, logotipo ni tipografía de Filmin.
- **Archivos nuevos:** `components/features/home/home-hero.tsx`, `components/features/detail/{detail-header,detail-tabs}.tsx`,
  `lib/credits.ts`, `e2e/filmin-layout.spec.ts`.
- **Archivos modificados:** `components/layout/navbar.tsx` (+ `navbar-parts/brand.tsx`), `components/layout/app-shell.tsx`,
  `components/ui/{carousel,poster-art}.tsx` (PosterArt: prop opcional `fill`), `components/features/home/home-screen.tsx`,
  `components/features/detail/movie-detail.tsx`, `components/features/catalog/catalog-screen.tsx`, `app/globals.css`.
- **Corrección independiente reutilizable (commit `5eaf603`):** `overflow-x: hidden` en `html, body` impedía que la cabecera
  `sticky` se pegara (bug previo a esta rama); ahora `overflow-x: clip`. Es candidata a llevarse a `feature/frontend-windows`.
- **No tocado:** Studio, Player, APIs, datos, Supabase. `MovieDetail` mantiene lista, valoraciones, comentarios, donaciones y
  propuesta de sinopsis. Series (`series-detail`) sigue con el hero clásico.
- **Pruebas:** `tsc` limpio; lint sin avisos nuevos (4 previos); E2E 48/48.
- **Conflictos posibles con el Mac:** `movie-detail.tsx`, `home-screen.tsx` y `poster-art.tsx` son los más expuestos
  (el Mac cambió reproducción/catálogo). `Player`/`Studio` no se tocaron.
- **Límites:** perfil autenticado no replicable (no observable públicamente); sin vídeo en el hero; sin pestaña «Extras»
  (GMA no tiene ese contenido); fuente Manrope en lugar de Graphik; creadores autenticados sin probar.

### 2026-10-13 — Experimento: vista previa flotante al pasar el ratón (rama `experiment/filmin-layout`)

- **Observado en Filmin (ratón real, 1440 px):** panel `MediaHoverWrapper` absoluto, abre a ~300 ms, crece ~250 ms
  centrado sobre la portada (205×308 → 344×432), se ajusta al viewport con 16 px de margen, se cierra al salir; contiene
  vídeo mudo, nota, CTA, «ver después», título, duración/edad, géneros y sinopsis.
- **Implementación GMA:** `components/ui/hover-preview-card.tsx` (portal fijo, animación desde la portada),
  `hooks/use-hover-preview.ts` (retraso, cierre, Escape, scroll), `hooks/use-community-score.ts` (nota con caché y precarga),
  `lib/hover-preview-layout.ts` (posición pura). `PosterCard` admite `hoverPreview` (activo en portada, catálogo y similares).
- **Decisiones:** solo puntero de ratón (nunca táctil); sin vídeo (no se acopla a `r2_video_url`/`stream_uid`); la nota usa el
  mismo endpoint de lectura que la ficha (`/api/ratings/community`), sin cambios de contrato.
- **Medido en GMA:** aparece a ~330 ms, 379×463 px, dentro de márgenes en primera y última tarjeta; E2E 50/50.
- **Conflictos posibles con el Mac:** `poster-card.tsx` (compartido con búsqueda y perfil de creador, sin activar allí).
