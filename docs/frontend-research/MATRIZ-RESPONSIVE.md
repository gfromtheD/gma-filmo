# Matriz responsive — línea base (antes de intervenir)

> Fecha: 2026-10-13. Herramienta: Playwright + Chrome del sistema, viewport exacto,
> `reducedMotion: reduce`, invitado (`gma_guest=1`), servidor local `next dev`.
> Script de medición (fuera del repo): `scratchpad/measure-gma.cjs`. Pendiente de
> convertir en prueba E2E del repositorio durante la Fase B.

## Navbar GMA (`/inicio`, `/peliculas`, `/cortos` dan el mismo resultado)

| Ancho | Alto header | Columnas (x–derecha) | Scroll horizontal de página | Controles fuera de pantalla | Veredicto |
|---|---|---|---|---|---|
| 320 | 80 | 32–160 · 192–564 · 596–767 | no | Películas, Cortos, Mi Espacio, Buscador, Cuenta | **Roto** |
| 360 | 80 | idem | no | Películas, Cortos, Mi Espacio, Buscador, Cuenta | **Roto** |
| 390 | 80 | idem | no | Cortos, Mi Espacio, Buscador, Cuenta | **Roto** |
| 430 | 80 | idem | no | Cortos, Mi Espacio, Buscador, Cuenta | **Roto** |
| 768 | 80 | idem (cabe justo en 767) | no | ninguno | Justo, sin margen |
| 1024 | 80 | 32–285 · 317–707 · 739–992 | no | ninguno | OK |
| 1280 | 80 | 32–413 · 445–835 · 867–1248 | no | ninguno | OK |
| 1440 | 80 | 32–493 · 525–915 · 947–1408 | no | ninguno | OK |
| 1920 | 80 | 272–733 · 765–1155 · 1187–1648 | no | ninguno | OK (contenido centrado a 1440 máx.) |

- No hay solapes entre columnas ni errores de consola en ningún ancho.
- La página no desborda porque los controles quedan recortados, no porque se reorganicen:
  **es un fallo de uso, no de scroll**.
- Intermedios 431–767 px: la rejilla de 3 columnas no se adapta (ancho fijo ≈ 767); tabletas
  en vertical y ventanas estrechas quedarán igualmente cortadas.

## Referencia Filmin (ver `FILMIN-OBSERVACIONES.md`)

| Ancho | Header | Patrón |
|---|---|---|
| 1024–1920 | 64–66 px, padding 64 | Barra completa |
| ~390 (400 informado) | 56 px, padding 16 | Hamburguesa + logo + buscar + guardados + CTA |

## Pendiente de medir (se añadirá tras cada fase)

Fichas (`/cortos/[id]`, `/series/[id]`), catálogo (cuadrícula y filtros), valoraciones y modal
a 320–430 px; zoom 200 %; texto largo; teclado y táctil; redimensionado continuo.

---

## Después de la Fase B (navbar) — 2026-10-13

Mismo método (Playwright, viewport exacto, invitado, `reducedMotion: reduce`). Rama `feature/frontend-windows` @ `f5039d1`.

| Ancho | Alto header | Controles fuera de pantalla | Scroll horizontal | Errores de consola | Patrón |
|---|---|---|---|---|---|
| 320 | 64 | **ninguno** | no | 0 | Menú + marca + buscar + cuenta |
| 360 | 64 | **ninguno** | no | 0 | idem |
| 390 | 64 | **ninguno** | no | 0 | idem |
| 430 | 64 | **ninguno** | no | 0 | idem |
| 768 | 64 | **ninguno** | no | 0 | idem (antes: barra apretada) |
| 1023 | 64 | ninguno | no | 0 | idem |
| 1024 | 80 | ninguno | no | 0 | Barra de escritorio (sin eslogan) |
| 1280 | 80 | ninguno | no | 0 | Barra de escritorio + eslogan |
| 1440 | 80 | ninguno | no | 0 | idem |
| 1920 | 80 | ninguno | no | 0 | idem |

- Objetivos táctiles de buscador, cuenta y botón de menú ≥ 44×44 px por debajo de 1024 px (probado).
- Panel móvil: `role=dialog` con nombre «Menú principal», foco atrapado, Escape cierra y devuelve el foco (probado en 320–1023).
- Pendiente: Studio en móvil con sesión de creador (la fila desplazable se construyó y compila pero **no se ha probado con un creador autenticado**: las pruebas usan modo invitado).
