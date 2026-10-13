# Plan de rediseño frontend (propuesta — pendiente de validación)

> Principios: cambios localizados, una fase por commit(s), sin tocar contratos, APIs,
> Supabase, Studio ni Player (lógica). Sin dependencias nuevas: se usa lo ya instalado
> (Tailwind 4, `radix-ui` 1.4.3, Motion, Playwright). Identidad visual de GMA intacta.

## Arquitectura presentacional objetivo

1. **Tokens y contenedor (CSS):** ampliar `app/globals.css` con `--header-h` y `--gutter`
   responsivos y una utilidad `gma-container` (`max-width 1440`, `padding-inline: var(--gutter)`),
   reutilizando `--gma-*`. No se migran los 1.047 hex de golpe: solo lo que se toque en cada fase.
2. **Navbar como raíz de composición** (se mantiene `components/layout/navbar.tsx` y el export
   `Navbar`) con piezas hermanas en `components/layout/navbar-parts/`:
   `brand`, `primary-nav` (píldora escritorio), `mobile-menu`, `account-menu`, `use-nav-scroll-state`.
3. **Primitivas accesibles con Radix ya instalado:** `Dialog` para el panel móvil y el modal de
   valoración; `DropdownMenu` para la cuenta (Escape, foco, `role=menu` gratis).
4. **Carrusel CSS-first:** `scroll-snap-align` en hijos, desplazamiento por ancho visible y flechas
   deshabilitadas en extremos (sin cambiar la API `Carousel({ title, action, children })`).
5. **Ficha con pestañas ARIA** y **bloque de valoraciones** recompuesto sobre el mismo contrato.

## Decisiones que necesito de ti (afectan a la arquitectura)

1. **Punto de cambio escritorio ↔ móvil de la navbar.** Medido: la barra actual necesita
   ~767 px y solo es cómoda desde 1024. *Recomendado:* `lg` (1024 px). Así tabletas verticales
   (768–1023) no quedan con una barra apretada. Alternativa: `md` (768 px).
2. **Patrón móvil.** *Recomendado:* barra superior fina (logo · buscar · cuenta) + botón de
   menú que abre un panel lateral (el patrón observado en Filmin), con Home/Películas/Cortos/
   Mi Espacio dentro. Alternativa: barra de pestañas inferior fija con las 4 secciones.
3. **Estado en scroll.** *Recomendado:* mantener el degradado con blur actual de GMA y solo
   hacerlo más sólido tras unos píxeles de scroll (transición ≤ 300 ms). Alternativa: fondo
   sólido como Filmin.
4. **Sub-navegación de Studio en móvil.** Se renderiza dentro de la navbar y se saldría de
   pantalla. *Recomendado:* fila horizontal desplazable bajo la cabecera, sin tocar
   `studio-sub-nav.tsx` ni el store. Es visual pero sensible: te lo marco antes de implementarlo.

## Secuencia propuesta

### Fase A — cerrar (hecho en este informe)
REA verificado, Filmin investigado, GMA auditada, línea base responsive medida.

### Fase B — Navegación global (primera implementación)
| Paso | Contenido | Verificación |
|---|---|---|
| B0 | Prueba E2E Playwright de la navbar (viewports 320–1920): sin controles recortados, foco, Escape | Falla hoy (R2), pasa al final |
| B1 | Tokens `--header-h`/`--gutter` + `gma-container` | `tsc`, lint, sin cambio visual en ≥1024 |
| B2 | Dividir `navbar.tsx` en piezas sin cambio de comportamiento | Capturas antes/después idénticas en escritorio |
| B3 | Menú móvil (Radix Dialog) + barra móvil | Matriz 320–430; teclado; ≥44 px táctil |
| B4 | Menú de cuenta con Radix DropdownMenu; píldora de creador como botón accesible; `aria-label` y `aria-current` | Teclado, lector de pantalla (árbol de accesibilidad) |
| B5 | `prefers-reduced-motion` (ruleta, píldora, clip-path) y recálculo de píldora en resize | Emulación `reduce`; test de resize |
| B6 | Informe de regresión, documentación, **vista previa** (sin producción) | Informe + tu autorización |

Riesgo de conflicto con el Mac: **bajo** (la navbar no existe en el alcance del motor; solo
importa la constante `STUDIO_TABS`, que se deja intacta).

### Fase C — Inicio y catálogo
Contenedor común, carrusel CSS-first, tarjetas `Poster`/`Landscape` con proporciones fijas,
hero con pausa y sin auto-avance bajo `reduced-motion`, cuadrícula de catálogo por tramos
(columnas por ancho útil, no por breakpoints arbitrarios).

### Fase D — Fichas
Cabecera responsiva, jerarquía título/metadatos, CTA a ancho completo en móvil, pestañas ARIA
(Detalles · Similares · Valoraciones · Comentarios/Extras **solo si existen en GMA**).

### Fase E — Valoraciones
Sobre el contrato existente (1–10, media, nº de votos, reseñas con «De acuerdo»):
resumen con media y votos, tarjetas legibles y estables en móvil, modal accesible
(Dialog, foco, Escape, objetivos táctiles), estados vacío/carga/error cuidados y contraste AA.
Distribución por nota u ordenación real **requieren backend** → te lo propondré aparte.
Nada de datos ficticios.

### Fase F — Consolidación
Duplicados, regresiones visuales, accesibilidad, documentación y capturas comparativas.

## Reglas de verificación en cada fase
`tsc --noEmit` · `next lint` · `next build` (antes de vista previa) · matriz Playwright ·
sin errores de consola nuevos · teclado/táctil · overflow cero · `reduced-motion`.
