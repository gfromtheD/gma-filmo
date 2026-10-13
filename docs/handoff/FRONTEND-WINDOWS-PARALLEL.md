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
